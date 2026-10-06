import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationDirectory = path.join(root, 'migrations');
const migration = fs.readFileSync(
  path.join(migrationDirectory, '172_harden_offline_mutation_rpc.sql'),
  'utf8'
);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.apply_offline_mutations/);
assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/);
assert.match(migration, /IF auth\.uid\(\) IS NULL/);
assert.match(migration, /FROM public\.employees AS e/);
assert.match(migration, /p_tenant IS DISTINCT FROM v_department_id/);
assert.match(migration, /p_tenant = ANY\(COALESCE\(v_accessible_departments/);
assert.match(migration, /jsonb_array_length\(p_mutations\) NOT BETWEEN 1 AND 500/);
assert.match(migration, /INSERT INTO public\.mutation_log/);
assert.match(migration, /INSERT INTO public\.smr_readings/);
assert.match(migration, /ON CONFLICT \(tenant_id, mutation_id\) DO NOTHING/);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.apply_offline_mutations\(uuid, jsonb\) FROM PUBLIC, anon/
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.apply_offline_mutations\(uuid, jsonb\) TO authenticated/
);
assert.doesNotMatch(
  migration,
  /(?:INSERT INTO|UPDATE|FROM|JOIN)\s+(?:mutation_log|smr_readings)\b/i
);
const migrationNames = fs.readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql'));
const sequenceCounts = new Map();
for (const name of migrationNames) {
  const sequence = name.match(/^(\d+)_/)?.[1];
  if (sequence) sequenceCounts.set(sequence, (sequenceCounts.get(sequence) ?? 0) + 1);
}
assert.deepEqual(
  [...sequenceCounts].filter(([, count]) => count > 1),
  [],
  'numbered SQL migrations must not reuse a sequence number'
);

console.log('Offline mutation RPC authorization, ACL, and migration sequence checks passed.');
