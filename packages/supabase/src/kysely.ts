import { type ColumnType, type Generated, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

// AGENT-TRACE: Simple APIError class for package-level use
// Removed unused options parameter to fix ESLint warnings preventing git push
// This class is intentionally simple - errors are thrown internally within the package
class APIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIError';
  }
}

// Mirror key tables from Database for type-safe complex queries.
// Add more tables as needed — Kysely validates at compile time only.
export interface KyselyDatabase {
  daily_logs: {
    id: Generated<string>;
    department_id: string;
    shift: string;
    date: string;
    created_at: ColumnType<string, never, never>;
    [key: string]: unknown;
  };
  machines: {
    id: Generated<string>;
    fleet_id: string;
    machine_type: string;
    department_id: string;
    status: string;
    [key: string]: unknown;
  };
  hourly_loads: {
    id: Generated<string>;
    machine_operation_id: string;
    load_time: string;
    material_type: string;
    tonnes: number;
    [key: string]: unknown;
  };
  production_logs: {
    id: Generated<string>;
    department_id: string;
    shift: string;
    date: string;
    coal_tonnes: number;
    waste_tonnes: number;
    [key: string]: unknown;
  };
  memory_embeddings: {
    id: Generated<string>;
    session_id: string;
    user_id: string | null;
    content: string;
    embedding: string;
    metadata: Record<string, unknown>;
    memory_type: string;
    created_at: ColumnType<string, never, string>;
    updated_at: string;
  };
}

/**
 * Create a Kysely instance pointed at the Supabase Postgres database.
 *
 * Requires `DATABASE_URL` env var (Supabase connection pool string).
 * Use for complex queries (aggregations, multi-table joins, CTEs)
 * that are awkward or impossible with the Supabase JS client.
 *
 * @example
 * ```ts
 * import { createKyselyClient } from "@repo/supabase/kysely";
 *
 * const db = createKyselyClient();
 * const result = await db
 *   .selectFrom("daily_logs")
 *   .select(db.fn.sum<number>("tonnes").as("total"))
 *   .where("department_id", "=", deptId)
 *   .execute();
 * ```
 */
const DEFAULT_POOL_MAX_CONNECTIONS = 10;
const SERVERLESS_POOL_MAX_CONNECTIONS = 3;
const POOL_IDLE_TIMEOUT_MS = 30_000;
const POOL_CONNECTION_TIMEOUT_MS = 5_000;
const DIRECT_POSTGRES_PORT = ':5432/';
const SUPAVISOR_POOLER_PORT = ':6543/';

/**
 * Resolves the optimal Postgres connection string for the current runtime.
 *
 * In Vercel Serverless or production environments:
 * 1. Prefers `DATABASE_POOLER_URL` (Supavisor port 6543) when defined.
 * 2. Automatically upgrades Supabase direct connection URLs (`:5432/`) to
 *    Supavisor transaction pooler (`:6543/?pgbouncer=true`) to prevent
 *    serverless connection exhaustion under concurrent cold starts.
 */
export function resolvePooledDatabaseUrl(
  envVars: Readonly<Record<string, string | undefined>> = process.env
): string | undefined {
  const isServerlessOrProd =
    envVars.VERCEL === '1' || Boolean(envVars.VERCEL_ENV) || envVars.NODE_ENV === 'production';

  const rawUrl =
    (isServerlessOrProd ? envVars.DATABASE_POOLER_URL : undefined) ??
    envVars.DATABASE_URL ??
    envVars.DATABASE_POOLER_URL ??
    envVars.SUPABASE_DATABASE_URL;

  if (!rawUrl) {
    return undefined;
  }

  if (
    isServerlessOrProd &&
    rawUrl.includes(DIRECT_POSTGRES_PORT) &&
    (rawUrl.includes('supabase.co') || rawUrl.includes('pooler.supabase.com'))
  ) {
    const pooledPortUrl = rawUrl.replace(DIRECT_POSTGRES_PORT, SUPAVISOR_POOLER_PORT);
    if (pooledPortUrl.includes('pgbouncer=')) {
      return pooledPortUrl;
    }
    const separator = pooledPortUrl.includes('?') ? '&' : '?';
    return `${pooledPortUrl}${separator}pgbouncer=true`;
  }

  return rawUrl;
}

const globalForKysely = globalThis as unknown as {
  kyselyInstance: Kysely<KyselyDatabase> | undefined;
};

export function createKyselyClient() {
  if (globalForKysely.kyselyInstance) return globalForKysely.kyselyInstance;

  const url = resolvePooledDatabaseUrl(process.env);

  if (!url) {
    throw new APIError(
      'Missing DATABASE_URL. Set it in your env (Supabase connection pool string).'
    );
  }

  const isServerless = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString: url,
      max: isServerless ? SERVERLESS_POOL_MAX_CONNECTIONS : DEFAULT_POOL_MAX_CONNECTIONS,
      idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
    }),
  });

  const db = new Kysely<KyselyDatabase>({ dialect });
  globalForKysely.kyselyInstance = db;
  return db;
}
