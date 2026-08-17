/**
 * PostgREST schema-cache reload helper.
 *
 * Reloads the PostgREST schema cache (after schema changes made outside
 * migrations) and inspects table columns. Target the local Supabase stack
 * by default; override with SUPABASE_DB_URL for other environments.
 *
 * Usage: node scripts/seeds/pgrst-reload.js
 */
const { Client } = require("pg");

const run = async () => {
  const connectionString =
    process.env.SUPABASE_DB_URL ||
    "postgres://postgres:postgres@localhost:54322/postgres";
  const client = new Client(connectionString);
  try {
    await client.connect();
    console.log("Connected to local Supabase");

    // Check columns
    const res = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hourly_loads'
    `);
    console.log("hourly_loads columns:", res.rows.map((r) => r.column_name).join(", "));

    // Reload PostgREST schema cache
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("PostgREST schema cache reloaded");
  } catch (err) {
    console.error("Error:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();
