import http from 'node:http';
import { Pool } from 'pg';

const port = Number(process.env.PORT ?? 8787);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX ?? 10), ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined });

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function query(sql: string, params: unknown[] = []) { return pool.query(sql, params); }
function safeIdentifier(value: string) { if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(value)) throw new Error('invalid identifier'); return '"' + value.replaceAll('"', '""') + '"'; }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      const r = await query('select current_database() database, current_user role, now() at time zone \'utc\' as utc');
      return send(res, 200, { ok: true, database: r.rows[0] });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/schemas') {
      const r = await query("select schema_name from information_schema.schemata where schema_name not in ('pg_catalog','information_schema') order by schema_name");
      return send(res, 200, { items: r.rows.map(x => x.schema_name) });
    }
    const tableMatch = url.pathname.match(/^\/api\/v1\/schemas\/([^/]+)\/tables$/);
    if (req.method === 'GET' && tableMatch) {
      const schema = tableMatch[1];
      const r = await query('select table_name, table_type from information_schema.tables where table_schema=$1 order by table_name', [schema]);
      return send(res, 200, { schema, items: r.rows });
    }
    const rowsMatch = url.pathname.match(/^\/api\/v1\/schemas\/([^/]+)\/tables\/([^/]+)\/rows$/);
    if (req.method === 'GET' && rowsMatch) {
      const schema = safeIdentifier(rowsMatch[1]); const table = safeIdentifier(rowsMatch[2]);
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 200);
      const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
      const r = await query(`select * from ${schema}.${table} limit $1 offset $2`, [limit, offset]);
      return send(res, 200, { items: r.rows, limit, offset });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/migrations') {
      const r = await query('select version,name,checksum,applied_at,applied_by,execution_ms from archdb.migrations order by version');
      return send(res, 200, { items: r.rows });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/audit') {
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 200);
      const r = await query('select id,project_id,actor_id,actor_role,action,object_type,object_schema,object_name,object_id,request_id,details,created_at from archdb.audit_events order by id desc limit $1', [limit]);
      return send(res, 200, { items: r.rows });
    }
    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'database_operation_failed' });
  }
});

server.listen(port, () => console.log(`ArchDB API listening on :${port}`));
process.on('SIGTERM', async () => { await pool.end(); server.close(); });
