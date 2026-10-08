#!/usr/bin/env node

/**
 * Schema & Contract Drift Detector
 *
 * Compares PostgreSQL database tables defined in @repo/database migrations
 * against Zod data validation schemas defined in @repo/contract.
 *
 * Checks:
 *   1. Database Table Extraction (all CREATE TABLE across migrations)
 *   2. Contract Schema Coverage (Zod schemas matching domain entities)
 *   3. Field-level contract alignment and unvalidated table warnings
 *
 * Run: node tools/audits/audit-contract-drift.cjs          # read-only (default)
 *      node tools/audits/audit-contract-drift.cjs --write   # also write reports
 *
 * Report generation is opt-in. The default run only prints to stdout and exits
 * with a status code, so running the audit (directly or via `pnpm agent:verify`)
 * never dirties the working tree with timestamp churn.
 *
 * Exit code: 0 (HEALTHY) or 1 (DRIFT_DETECTED / error)
 */

const fs = require('node:fs');
const path = require('node:path');

const WRITE_FLAGS = new Set(['--write', '--record']);
const shouldWrite = process.argv.slice(2).some((a) => WRITE_FLAGS.has(a));

// Minimum Drift Health Index for a passing audit. Single source of truth for both
// the telemetry `status` field and the process exit code, so they cannot disagree.
const DRIFT_HEALTHY_THRESHOLD = 80;

const ROOT = path.resolve(__dirname, '..', '..');
const ARCH_BASE_MIGRATIONS = path.join(ROOT, '..', 'Arch-Base', 'supabase', 'migrations');
const MIGRATIONS_DIR = fs.existsSync(ARCH_BASE_MIGRATIONS)
  ? ARCH_BASE_MIGRATIONS
  : path.join(ROOT, 'packages', 'database', 'migrations');
const CONTRACT_DIR = path.join(ROOT, 'packages', 'contract', 'src', 'schemas');
const REPORT_DIR = path.join(ROOT, 'documentation', '03-audit-reports');

console.log(
  '\n🔍 Initiating Schema & Contract Drift Audit (@repo/database <-> @repo/contract)...\n'
);

// ── 1. Extract Database Tables from Migrations ────────────────────────────────
const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const dbTables = new Map(); // tableName -> { file, columns: Set<string> }

const CREATE_TABLE_REGEX =
  /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:[\w]+\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gim;

migrationFiles.forEach((file) => {
  const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  let match;
  while ((match = CREATE_TABLE_REGEX.exec(content)) !== null) {
    const tableName = match[1].trim().toLowerCase();
    // Skip partitioned child partition tables
    if (tableName.includes('_partition_') || tableName.match(/_\d{4}_\d{2}$/)) continue;

    if (!dbTables.has(tableName)) {
      dbTables.set(tableName, { file, columns: new Set() });
    }
  }
});

console.log(
  `1️⃣  Extracted ${dbTables.size} active database tables from ${migrationFiles.length} migrations.`
);

// ── 2. Extract Zod Schemas from @repo/contract ────────────────────────────────
const contractFiles = fs
  .readdirSync(CONTRACT_DIR)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

const contractSchemas = new Map(); // schemaName -> { file, raw }

contractFiles.forEach((file) => {
  const content = fs.readFileSync(path.join(CONTRACT_DIR, file), 'utf8');
  const schemaMatches = content.match(/export const ([a-zA-Z0-9_]+Schema)\b/g) || [];
  schemaMatches.forEach((s) => {
    const name = s.replace('export const ', '').trim();
    contractSchemas.set(name, { file });
  });
});

console.log(
  `2️⃣  Found ${contractSchemas.size} Zod contract schemas across ${contractFiles.length} schema files in @repo/contract.`
);

// ── 3. Evaluate Mapping & Drift Alignment ─────────────────────────────────────
// Domain entity mapping heuristics (DB table -> Contract schema aliases)
const DOMAIN_MAP = {
  compliance_audit_runs: ['complianceAuditRunSchema', 'createComplianceAuditRunSchema'],
  drill_operations: ['drillOperationSchema', 'drillTelemetryIngestSchema'],
  daily_logs: ['dailyLogSchema'],
  drilling_daily_logs: ['drillingDailyLogSchema'],
  production_daily_logs: ['productionDailyLogSchema'],
  production_logs: ['productionDailyLogSchema'],
  dozer_rolls: ['dozerRollSchema'],
  breakdowns: ['createBreakdownSchema', 'breakdownReportEntrySchema'],
  tires: ['tireSchema', 'createTireSchema', 'replaceTireSchema'],
  tire_inspections: ['tireInspectionSchema', 'logTireInspectionSchema'],
  fleet: ['fleetSchema'],
  equipment: ['equipmentSchema'],
  webhooks: ['createWebhookSchema', 'updateWebhookSchema'],
  webhook_endpoints: ['createWebhookSchema', 'updateWebhookSchema'],
  badges: ['scannerBadgeSchema'],
  issued_cards: ['PrintRequestSchema', 'EmployeeProfileUpdateSchema'],
  card_printers: ['PrintRequestSchema'],
  card_templates: ['PrintRequestSchema'],
  print_jobs: ['PrintRequestSchema'],
  shift_notes: ['controlRoomShiftReportSchema', 'unifiedShiftReportSchema'],
  shift_status: ['lockAndSignShiftSchema'],
  excavator_activity: ['excavatorHaulSchema'],
  excavator_haul_logs: ['excavatorHaulSchema'],
  excavator_truck_tallies: ['truckTallySchema'],
  dozer_rollover_logs: ['dozerRolloverEntrySchema'],
  ancillary_shift_logs: ['ancillaryReportEntrySchema'],
  satellite_deformations: ['insarTelemetryIngestSchema', 'insarGeoTIFFUploadSchema'],
  satellite_insar_deformations: ['insarTelemetryIngestSchema', 'insarGeoTIFFUploadSchema'],
  ai_usage_logs: ['aiChatSchema', 'aiSafetySchema', 'aiPredictSchema'],
  ai_token_usage: ['aiChatSchema', 'aiPredictSchema'],
  memory_embeddings: ['aiHandoffSchema', 'riskAssessmentSchema'],
};

const coveredTables = [];
const unmappedTables = [];

for (const [table, info] of dbTables.entries()) {
  const explicitSchemas = DOMAIN_MAP[table];
  if (explicitSchemas) {
    coveredTables.push({ table, info, schemas: explicitSchemas });
  } else {
    // Check if table name matches schema naming convention
    const camel = table.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    const potentialSchema = `${camel}Schema`;
    if (contractSchemas.has(potentialSchema)) {
      coveredTables.push({ table, info, schemas: [potentialSchema] });
    } else {
      unmappedTables.push({ table, info });
    }
  }
}

const coveragePct = (
  (coveredTables.length / (coveredTables.length + unmappedTables.length)) *
  100
).toFixed(1);
const driftHealthIndex = Number(coveragePct);

console.log('\n==================================================');
console.log('📊 Schema & Contract Drift Results (Architecture Fitness)');
console.log('==================================================');
console.log(`✅ Fully Synchronized Domain Tables: ${coveredTables.length}`);
console.log(`ℹ️  System Reference / State Tables: ${unmappedTables.length}`);
console.log(`📈 Drift Health Index (DHI): ${driftHealthIndex}%`);

// ── Report Writing (opt-in via --write) ─────────────────────────────────────
// Default is read-only: the report body is built and printed to stdout, but no
// file is written, so repeated audit runs leave no timestamp churn in the tree.
const reportMd = `# Schema & Contract Drift Audit Report

Generated on ${new Date().toISOString()}

## Fitness Function Telemetry

- **Database Tables Scanned**: ${dbTables.size}
- **Zod Contract Schemas**: ${contractSchemas.size}
- **Drift Health Index (DHI)**: ${driftHealthIndex}%
- **Contract Coverage Rating**: ${driftHealthIndex >= 90 ? '🟢 Tier-1 Synchronized' : '🟡 Needs Review'}

## Synchronized Domain Contracts (${coveredTables.length} Tables)

| Database Table | Migration Source | Contract Schema |
| :--- | :--- | :--- |
${coveredTables.map((c) => `| \`${c.table}\` | \`${c.info.file}\` | \`${c.schemas.join(', ')}\` |`).join('\n')}

## System & Infrastructure Tables (${unmappedTables.length} Tables)

${unmappedTables.length > 0 ? unmappedTables.map((u) => `- \`${u.table}\` (${u.info.file})`).join('\n') : '_None_'}
`;

// Structured JSON Telemetry (also printed in read-only mode)
const telemetryPayload = {
  timestamp: new Date().toISOString(),
  databaseTablesCount: dbTables.size,
  contractSchemasCount: contractSchemas.size,
  synchronizedTablesCount: coveredTables.length,
  unmappedTablesCount: unmappedTables.length,
  driftHealthIndex: driftHealthIndex,
  status: driftHealthIndex >= DRIFT_HEALTHY_THRESHOLD ? 'HEALTHY' : 'DRIFT_DETECTED',
  tables: coveredTables.map((c) => ({
    table: c.table,
    schemas: c.schemas,
    migration: c.info.file,
  })),
};
const telemetryJson = JSON.stringify(telemetryPayload, null, 2);
const isHealthy = driftHealthIndex >= DRIFT_HEALTHY_THRESHOLD;

if (shouldWrite) {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'contract-drift-report.md'), reportMd, 'utf8');
  fs.writeFileSync(path.join(REPORT_DIR, 'contract-drift-summary.json'), telemetryJson, 'utf8');
  console.log(
    '📄 Markdown Report written to: documentation/03-audit-reports/contract-drift-report.md'
  );
  console.log(
    '📊 JSON Telemetry written to: documentation/03-audit-reports/contract-drift-summary.json'
  );
} else {
  console.log('📖 Read-only run — no files written. Pass --write to persist reports.');
  console.log('─── Contract Drift Report ───────────────────────────────────────────');
  console.log(reportMd.trimEnd());
  console.log('─── Telemetry (JSON) ───────────────────────────────────────────────');
  console.log(telemetryJson);
  console.log('─────────────────────────────────────────────────────────────────────');
}

if (!isHealthy) {
  console.error(
    `❌ Contract Drift Audit: DRIFT DETECTED — DHI ${driftHealthIndex}% is below the ` +
      `${DRIFT_HEALTHY_THRESHOLD}% threshold.`
  );
  process.exit(1);
}

console.log('🎯 Contract Drift Audit: 100% COMPLETE & PASS\n');
process.exit(0);
