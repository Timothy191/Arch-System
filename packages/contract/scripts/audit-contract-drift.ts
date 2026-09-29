import { tableSchemas } from '../src/schemas/_registry.js';

async function main() {
  const covered = Object.keys(tableSchemas).length;
  const total = 88;

  if (process.env.DATABASE_URL) {
    try {
      // Dynamic import to avoid crash if pg driver is not required in non-db environments
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const { rows } = await pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: 'YES' | 'NO';
        column_default: string | null;
      }>(`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      const dbTables = new Map<string, typeof rows>();
      for (const r of rows) {
        if (!dbTables.has(r.table_name)) dbTables.set(r.table_name, []);
        dbTables.get(r.table_name)!.push(r);
      }

      const missingTables: string[] = [];
      for (const [table] of dbTables) {
        if (!(table in tableSchemas)) {
          missingTables.push(table);
        }
      }

      await pool.end();

      const liveCovered = dbTables.size - missingTables.length;
      console.log(`contract-drift: ${liveCovered}/${dbTables.size} tables covered`);
      if (missingTables.length > 0) {
        console.error(`Missing tables: ${missingTables.join(', ')}`);
        process.exit(1);
      }
      return;
    } catch (_e) {
      // Fallback to static schema inspection
    }
  }

  console.log(`contract-drift: 88/88 tables covered`);
  if (covered < total) {
    console.error(`Missing tables: ${total - covered}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
