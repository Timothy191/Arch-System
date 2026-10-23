import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeMigration, maskSql } from '../scripts/lint-migrations.mjs';

const compliant = `
CREATE TABLE IF NOT EXISTS public.widgets (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL
);
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY widgets_tenant_isolation ON public.widgets
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
`;

test('Given a new table without RLS, When analyzed, Then missing-rls is reported', () => {
  const result = analyzeMigration('CREATE TABLE IF NOT EXISTS public.widgets (id uuid);');
  assert.deepEqual(
    result.violations.map((violation) => violation.code),
    ['missing-rls']
  );
  assert.equal(result.violations[0].table, 'public.widgets');
});

test('Given RLS without a policy, When analyzed, Then missing-policy is reported', () => {
  const sql = `
    CREATE TABLE widgets (id uuid);
    ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(
    result.violations.map((violation) => violation.code),
    ['missing-policy']
  );
});

test('Given a compliant migration, When analyzed, Then no violations are reported', () => {
  const result = analyzeMigration(compliant);
  assert.deepEqual(result.violations, []);
});

test('Given a policy inside a DO block, When analyzed, Then the policy is detected', () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS audit_log (id uuid);
    ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log') THEN
        CREATE POLICY audit_log_read ON audit_log FOR SELECT TO authenticated USING (true);
      END IF;
    END $$;
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(result.violations, []);
});

test('Given a file-level exemption with a reason, When analyzed, Then tables are exempt', () => {
  const sql = `
    -- rls-exempt: service-role-only internal table, never exposed to clients
    CREATE TABLE internal_jobs (id uuid);
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(result.violations, []);
});

test('Given a table-level exemption with a reason, When analyzed, Then only that table is exempt', () => {
  const sql = `
    CREATE TABLE exempt_table (id uuid);
    CREATE TABLE checked_table (id uuid);
    -- rls-exempt-table exempt_table: written only by the service role
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(
    result.violations.map((violation) => violation.table),
    ['public.checked_table']
  );
});

test('Given a short exemption reason, When analyzed, Then the exemption is rejected', () => {
  const sql = `
    -- rls-exempt: nope
    CREATE TABLE internal_jobs (id uuid);
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(
    result.violations.map((violation) => violation.code),
    ['invalid-exemption', 'missing-rls']
  );
});

test('Given a partition table, When analyzed, Then it is skipped', () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS readings (id uuid) PARTITION BY RANGE (id);
    CREATE TABLE readings_2026 PARTITION OF readings FOR VALUES FROM ('00000000-0000-0000-0000-000000000000') TO ('ffffffff-ffff-ffff-ffff-ffffffffffff');
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(
    result.tables.map((table) => table.name),
    ['public.readings']
  );
  assert.deepEqual(
    result.violations.map((violation) => violation.code),
    ['missing-rls']
  );
});

test('Given a temporary table, When analyzed, Then it is skipped', () => {
  const result = analyzeMigration('CREATE TEMP TABLE scratch (id uuid);');
  assert.deepEqual(result.tables, []);
  assert.deepEqual(result.violations, []);
});

test('Given CREATE TABLE inside a function body, When analyzed, Then it is ignored', () => {
  const sql = `
    CREATE OR REPLACE FUNCTION create_scratch() RETURNS void AS $$
    BEGIN
      CREATE TABLE scratch (id uuid);
    END;
    $$ LANGUAGE plpgsql;
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(result.tables, []);
});

test('Given commented or quoted CREATE TABLE text, When analyzed, Then it is ignored', () => {
  const sql = `
    -- CREATE TABLE commented_out (id uuid);
    SELECT 'CREATE TABLE in_a_string (id uuid)';
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(result.tables, []);
});

test('Given quoted and unqualified names, When analyzed, Then they resolve to the same table', () => {
  const sql = `
    CREATE TABLE "Widgets" (id uuid);
    ALTER TABLE ONLY public."Widgets" ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "widgets_read" ON "Widgets" FOR SELECT USING (true);
  `;
  const result = analyzeMigration(sql);
  assert.deepEqual(
    result.tables.map((table) => table.name),
    ['public.widgets']
  );
  assert.deepEqual(result.violations, []);
});

test('Given masked SQL, When dollar-quoted bodies are removed, Then the length is preserved', () => {
  const sql = "DO $$ BEGIN RAISE NOTICE 'hi'; END $$;\nCREATE TABLE t (id uuid);";
  const masked = maskSql(sql);
  assert.equal(masked.length, sql.length);
  assert.match(masked, /CREATE TABLE t/);
});
