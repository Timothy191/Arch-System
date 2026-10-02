const fs = require('fs');
const file = 'packages/supabase/src/kysely.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'let globalKyselyInstance: Kysely<KyselyDatabase> | null = null;',
  'const globalForKysely = globalThis as unknown as { kyselyInstance: Kysely<KyselyDatabase> | undefined };'
);

const beforeCreate =
  'export function createKyselyClient() {\n  if (globalKyselyInstance) return globalKyselyInstance;';
const afterCreate =
  'export function createKyselyClient() {\n  if (globalForKysely.kyselyInstance) return globalForKysely.kyselyInstance;';
code = code.replace(beforeCreate, afterCreate);

const beforeReturn =
  'globalKyselyInstance = new Kysely<KyselyDatabase>({ dialect });\n  return globalKyselyInstance;';
const afterReturn =
  "const db = new Kysely<KyselyDatabase>({ dialect });\n  if (process.env.NODE_ENV !== 'production') globalForKysely.kyselyInstance = db;\n  else globalForKysely.kyselyInstance = db;\n  return db;";
code = code.replace(beforeReturn, afterReturn);

fs.writeFileSync(file, code);
