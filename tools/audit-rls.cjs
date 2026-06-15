#!/usr/bin/env node
//
// Static RLS policy audit for packages/database/migrations/*.sql.
//
// Walks the source-of-truth migration directory in numeric order and reports:
//   - CRITICAL: tables declared via CREATE TABLE that never have a matching
//               ALTER TABLE ... ENABLE ROW LEVEL SECURITY in any later file
//   - WARNING : policies that look overly permissive, e.g.:
//                 * USING (true) on a non-reference table
//                 * SELECT policy that doesn't reference auth.uid() or
//                   employees for department isolation when the table has
//                   a department_id column
//
// Output: a markdown report at .audit/rls-report.md
// Exit code: 0 if no CRITICAL findings, 1 otherwise (CI gate).
//
// Usage: node tools/audit-rls.cjs
//        pnpm audit:rls
//
// No external dependencies, no live database connection. Pure static
// analysis using regex over the migration files. Same code style as
// tools/circular-dep-detect.cjs.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'packages', 'database', 'migrations');
const REPORT_DIR = path.join(ROOT, '.audit');
const REPORT_PATH = path.join(REPORT_DIR, 'rls-report.md');

// Tables that legitimately do not need department-scoped SELECT policies.
// These are reference / config tables or system-internal tables where
// USING (true) for SELECT is the intentional design. Add to this list
// sparingly — every entry should be reviewed.
const REFERENCE_TABLES = new Set([
  'departments',
  'operators',
  'sites',
  'safety_severities',
  'safety_incident_categories',
  'delay_categories',
  'report_templates',
  'mine_blocks',
  'materialized_view_refresh_log',
]);

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('Migration directory not found: ' + MIGRATIONS_DIR);
    process.exit(2);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // zero-padded NNN_... sort gives migration order
}

function readMigration(file) {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
}

// Strip SQL comments so regex matches inside a comment don't trip the parser.
function stripComments(sql) {
  // Block comments.
  let out = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Line comments (only when not inside a string — we approximate).
  out = out.replace(/(^|\s)--[^\n]*/g, '$1');
  return out;
}

// Capture a table name from a CREATE TABLE statement header. Supports:
//   CREATE TABLE foo (
//   CREATE TABLE IF NOT EXISTS foo (
//   CREATE TABLE public.foo (
//   CREATE TABLE foo PARTITION OF ...   (child partitions — skipped)
const RE_CREATE_TABLE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w]+\.)?([\w]+)\b[^;]*?\(/gi;
const PARTITION_HINT = /PARTITION\s+OF/i;

// Match ALTER TABLE ... ENABLE ROW LEVEL SECURITY for a specific table.
const RE_ENABLE_RLS = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:[\w]+\.)?([\w]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

// Match a CREATE POLICY ... statement. Captures:
//   1: policy name (quoted or unquoted)
//   2: table name (next non-keyword token after ON)
//   3: command (SELECT|INSERT|UPDATE|DELETE|ALL) — or empty for default
//   4: body of the policy (everything between the ON ... block and the
//      matching semicolon)
const RE_POLICY =
  /CREATE\s+POLICY\s+("?[\w]+"?)\s+ON\s+(?:[\w]+\.)?([\w]+)\s*(FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL))?([\s\S]*?);/gi;

// WITH CHECK / USING / FOR ALL / role markers inside a policy body.
const BODY_HAS_USING_TRUE = /USING\s*\(\s*true\s*\)/i;
const BODY_HAS_WITH_CHECK_TRUE = /WITH\s+CHECK\s*\(\s*true\s*\)/i;
const BODY_HAS_AUTH_UID = /auth\.uid\(\)/i;
const BODY_HAS_EMPLOYEES_REF = /\bFROM\s+employees\b|\bJOIN\s+employees\b|\bis_admin\s*\(\s*\)|has_department_access\s*\(/i;

// Check if a CREATE TABLE block defines a department_id column.
const RE_DEPT_ID_COLUMN = /department_id\s+UUID/i;

// Build the table→set-of-files list. Tables declared in a CREATE TABLE in
// file F are considered "born" in F; if a later file enables RLS for them,
// the CRITICAL finding goes away.
function buildTableBirths(files) {
  const births = new Map(); // tableName -> Set<fileIndex>
  files.forEach((file, idx) => {
    const sql = stripComments(readMigration(file));
    let match;
    RE_CREATE_TABLE.lastIndex = 0;
    while ((match = RE_CREATE_TABLE.exec(sql)) !== null) {
      const tableName = match[1];
      // Skip dynamic SQL fragments and child partitions.
      if (PARTITION_HINT.test(match[0])) continue;
      if (!births.has(tableName)) births.set(tableName, new Set());
      births.get(tableName).add(idx);
    }
  });
  return births;
}

// Walk the migrations in order, recording the set of files (indices)
// that enable RLS for each table and the policies attached to each
// table.
function scanMigrations(files) {
  const enabled = new Map(); // tableName -> Set<fileIndex>
  const policies = []; // [{ table, command, name, body, file, hasUsingTrue, hasWithCheckTrue, hasAuthUid, hasEmployeesRef }]
  const tablesWithDeptColumn = new Set();

  files.forEach((file, idx) => {
    const sql = stripComments(readMigration(file));

    // ENABLE RLS.
    RE_ENABLE_RLS.lastIndex = 0;
    let m;
    while ((m = RE_ENABLE_RLS.exec(sql)) !== null) {
      const t = m[1];
      if (!enabled.has(t)) enabled.set(t, new Set());
      enabled.get(t).add(idx);
    }

    // CREATE POLICY.
    RE_POLICY.lastIndex = 0;
    while ((m = RE_POLICY.exec(sql)) !== null) {
      const name = m[1];
      const table = m[2];
      const command = (m[3] || '').toUpperCase().replace(/^FOR\s+/, '') || 'ALL';
      const body = m[4] || '';
      policies.push({
        table,
        command,
        name,
        body,
        file,
        hasUsingTrue: BODY_HAS_USING_TRUE.test(body),
        hasWithCheckTrue: BODY_HAS_WITH_CHECK_TRUE.test(body),
        hasAuthUid: BODY_HAS_AUTH_UID.test(body),
        hasEmployeesRef: BODY_HAS_EMPLOYEES_REF.test(body),
      });
    }

    // Track which CREATE TABLE blocks declare a department_id column.
    RE_CREATE_TABLE.lastIndex = 0;
    while ((m = RE_CREATE_TABLE.exec(sql)) !== null) {
      if (PARTITION_HINT.test(m[0])) continue;
      if (RE_DEPT_ID_COLUMN.test(m[0])) {
        tablesWithDeptColumn.add(m[1]);
      }
    }
  });

  return { enabled, policies, tablesWithDeptColumn };
}

function findCriticalTables(births, enabled, files) {
  // A table is CRITICAL only if it has zero RLS enables across the entire
  // migration sequence (cumulative — RLS enabled in a later file counts).
  const critical = [];
  for (const [table, birthIndices] of births.entries()) {
    const enabledIndices = enabled.get(table);
    if (!enabledIndices || enabledIndices.size === 0) {
      const firstFile = files[[...birthIndices][0]];
      critical.push({ table, firstFile });
    }
  }
  critical.sort((a, b) => a.table.localeCompare(b.table));
  return critical;
}

function findSuspiciousPolicies(policies, tablesWithDeptColumn) {
  const warnings = [];
  for (const p of policies) {
    const issues = [];
    // USING (true) on a SELECT or FOR ALL policy is almost always too
    // permissive UNLESS the table is on the allowlist. INSERT with
    // WITH CHECK (true) is similarly suspect.
    if (p.hasUsingTrue && (p.command === 'SELECT' || p.command === 'ALL')) {
      if (!REFERENCE_TABLES.has(p.table)) {
        issues.push('USING (true) on SELECT/ALL — unrestricted read');
      }
    }
    if (p.hasWithCheckTrue && (p.command === 'INSERT' || p.command === 'ALL')) {
      if (!REFERENCE_TABLES.has(p.table)) {
        issues.push('WITH CHECK (true) on INSERT/ALL — unrestricted write');
      }
    }
    // SELECT policy on a table with department_id that never references
    // auth.uid() OR employees isolation. This catches policies that look
    // "fine" syntactically but leak across departments.
    if (
      p.command === 'SELECT' &&
      !p.hasUsingTrue &&
      tablesWithDeptColumn.has(p.table) &&
      !p.hasAuthUid &&
      !p.hasEmployeesRef
    ) {
      issues.push('SELECT policy with no auth.uid() or employees isolation on a department-scoped table');
    }
    if (issues.length) {
      warnings.push({
        table: p.table,
        policy: p.name,
        command: p.command,
        file: p.file,
        issues,
      });
    }
  }
  return warnings;
}

function renderReport({ files, critical, warnings, allTables, enabledTables, policyCount, suspiciousTableSet }) {
  const lines = [];
  lines.push('# RLS Policy Audit');
  lines.push('');
  lines.push('Generated by `tools/audit-rls.cjs` from `' + path.relative(ROOT, MIGRATIONS_DIR) + '`.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | --- |');
  lines.push('| Migrations scanned | ' + files.length + ' |');
  lines.push('| Tables declared | ' + allTables.length + ' |');
  lines.push('| Tables with RLS enabled | ' + enabledTables.length + ' |');
  lines.push('| Tables missing RLS (CRITICAL) | ' + critical.length + ' |');
  lines.push('| Tables with suspicious policies (WARNING) | ' + suspiciousTableSet.size + ' |');
  lines.push('| Total CREATE POLICY statements | ' + policyCount + ' |');
  lines.push('');

  lines.push('## CRITICAL — Tables Missing Row Level Security');
  lines.push('');
  if (critical.length === 0) {
    lines.push('_None. Every CREATE TABLE has a matching ALTER TABLE … ENABLE ROW LEVEL SECURITY somewhere in the migration sequence._');
    lines.push('');
  } else {
    lines.push('These tables have no `ENABLE ROW LEVEL SECURITY` statement in any migration. RLS must be enabled before data is exposed via Supabase.');
    lines.push('');
    lines.push('| Table | First declared in |');
    lines.push('| --- | --- |');
    for (const c of critical) {
      lines.push('| `' + c.table + '` | `' + c.firstFile + '` |');
    }
    lines.push('');
  }

  lines.push('## WARNING — Suspicious Policies');
  lines.push('');
  if (warnings.length === 0) {
    lines.push('_None._');
    lines.push('');
  } else {
    lines.push('These policies are syntactically valid but look overly permissive or missing department isolation. Review each entry.');
    lines.push('');
    lines.push('| Table | Policy | Command | File | Issue |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const w of warnings) {
      lines.push(
        '| `' + w.table + '` | `' + w.policy + '` | ' +
          w.command + ' | `' + w.file + '` | ' +
          w.issues.join('<br>') + ' |'
      );
    }
    lines.push('');
  }

  lines.push('## Tables With RLS Enabled');
  lines.push('');
  lines.push('| Table | RLS enabled in |');
  lines.push('| --- | --- |');
  for (const t of enabledTables) {
    lines.push('| `' + t.name + '` | ' + (t.files.join(', ') || '—') + ' |');
  }
  lines.push('');

  return lines.join('\n');
}

function main() {
  const files = listMigrations();
  const births = buildTableBirths(files);
  const { enabled, policies, tablesWithDeptColumn } = scanMigrations(files);
  const critical = findCriticalTables(births, enabled, files);
  const warnings = findSuspiciousPolicies(policies, tablesWithDeptColumn);

  const allTableNames = [...births.keys()].sort();
  const enabledTableNames = [...enabled.keys()].sort();
  const enabledTables = enabledTableNames.map((name) => ({
    name,
    files: [...(enabled.get(name) || new Set())]
      .sort((a, b) => a - b)
      .map((i) => files[i]),
  }));
  const suspiciousTableSet = new Set(warnings.map((w) => w.table));

  const report = renderReport({
    files,
    critical,
    warnings,
    allTables: allTableNames,
    enabledTables,
    policyCount: policies.length,
    suspiciousTableSet,
  });

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, report);

  if (critical.length > 0) {
    console.error('FAIL ' + critical.length + ' table(s) missing RLS:');
    for (const c of critical) {
      console.error('  - ' + c.table + ' (declared in ' + c.firstFile + ')');
    }
    console.error('Report: ' + path.relative(ROOT, REPORT_PATH));
    process.exit(1);
  }

  console.log(
    'OK Scanned ' + files.length + ' migrations: ' +
      allTableNames.length + ' tables, ' +
      enabledTableNames.length + ' with RLS, ' +
      critical.length + ' critical, ' +
      warnings.length + ' warnings (' + suspiciousTableSet.size + ' tables).'
  );
  console.log('Report: ' + path.relative(ROOT, REPORT_PATH));
  process.exit(0);
}

main();
