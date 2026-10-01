const fs = require('fs');
const env = fs.readFileSync('apps/portal/.env', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_KEY=(.*)/);

async function main() {
  // Query Supabase via POST /rest/v1/rpc/...
  // We can just use the GraphQL or a known RPC to check pg_proc, but we can't directly.
  // Wait, we can use the postgres connection string from .env!
  const dbMatch = env.match(/DATABASE_URL=(.*)/);
  console.log('DB URL exists:', !!dbMatch);
}
main();
