import { type ColumnType, type Generated, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './database.types';

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
    shift: Database['public']['Enums']['shift_type'];
    log_date: string;
    notes: string | null;
    sync_status: string | null;
    idempotency_key: string | null;
    last_synced_at: string | null;
    created_by: string | null;
    updated_by: string | null;
    created_at: ColumnType<string, string | undefined, never>;
    updated_at: string | null;
  };
  machines: {
    id: Generated<string>;
    department_id: string;
    name: string;
    machine_type: string;
    machine_type_id: string | null;
    serial_number: string | null;
    manufacturer: string | null;
    site_id: string | null;
    active: boolean;
    report_exempt: boolean;
    starting_smr: number | null;
    bin_factor: number | null;
    bin_factor_coal: number | null;
    bin_factor_waste: number | null;
    created_at: ColumnType<string, string | undefined, never>;
    updated_at: string | null;
    deleted_at: string | null;
  };
  hourly_loads: {
    id: Generated<string>;
    department_id: string;
    machine_id: string;
    excavator_id: string | null;
    daily_log_id: string | null;
    daily_log_date: string | null;
    load_date: string;
    shift_type: string;
    material_type: string;
    start_hour: number;
    end_hour: number;
    hour_01: number;
    hour_02: number;
    hour_03: number;
    hour_04: number;
    hour_05: number;
    hour_06: number;
    hour_07: number;
    hour_08: number;
    hour_09: number;
    hour_10: number;
    hour_11: number;
    hour_12: number;
    total_loads: number | null;
    is_locked: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: ColumnType<string, string | undefined, never>;
    updated_at: string;
  };
  production_logs: {
    id: Generated<string>;
    daily_log_id: string;
    daily_log_date: string;
    coal_tonnes: number;
    waste_tonnes: number;
    created_by: string | null;
    updated_by: string | null;
    created_at: ColumnType<string, string | undefined, never>;
    updated_at: string;
  };
  sites: {
    id: Generated<string>;
    name: string;
    site_code: string;
    active: boolean;
    created_at: ColumnType<string, string | undefined, never>;
    updated_at: string | null;
    deleted_at: string | null;
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
 * const totals = await db
 *   .selectFrom("production_logs")
 *   .select(db.fn.sum<number>("coal_tonnes").as("totalCoal"))
 *   .where("daily_log_id", "=", dailyLogId)
 *   .execute();
 * ```
 */
const DEFAULT_POOL_MAX_CONNECTIONS = 10;
const SERVERLESS_POOL_MAX_CONNECTIONS = 3;
const POOL_IDLE_TIMEOUT_MS = 30_000;
const POOL_CONNECTION_TIMEOUT_MS = 15_000;
const POOL_KEEP_ALIVE_INITIAL_DELAY_MS = 10_000;
const DIRECT_POSTGRES_PORT = ':5432/';
const SUPAVISOR_POOLER_PORT = ':6543/';
const VERCEL_ACTIVE_ENV_VALUE = '1';
const SUPABASE_DIRECT_HOST_MARKER = 'supabase.co';
const SUPABASE_POOLER_HOST_MARKER = 'pooler.supabase.com';
const PGBOUNCER_QUERY_KEY = 'pgbouncer=';
const PGBOUNCER_QUERY_PARAM = 'pgbouncer=true';

export interface KyselyPoolOptions {
  readonly connectionString: string;
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
  readonly keepAlive: boolean;
  readonly keepAliveInitialDelayMillis: number;
}

function isSupabasePoolerOrDirectHost(connectionUrl: string): boolean {
  return (
    connectionUrl.includes(SUPABASE_DIRECT_HOST_MARKER) ||
    connectionUrl.includes(SUPABASE_POOLER_HOST_MARKER)
  );
}

function ensureSupavisorPoolerParam(connectionUrl: string): string {
  if (connectionUrl.includes(PGBOUNCER_QUERY_KEY)) {
    return connectionUrl;
  }
  const separator = connectionUrl.includes('?') ? '&' : '?';
  return `${connectionUrl}${separator}${PGBOUNCER_QUERY_PARAM}`;
}

function isServerlessRuntime(envVars: Readonly<Record<string, string | undefined>>): boolean {
  return envVars.VERCEL === VERCEL_ACTIVE_ENV_VALUE || Boolean(envVars.VERCEL_ENV);
}

/**
 * Resolves the optimal Postgres connection string for the current runtime.
 *
 * In Vercel Serverless or production environments:
 * 1. Prefers `DATABASE_POOLER_URL` (Supavisor port 6543) when defined.
 * 2. Automatically upgrades Supabase direct connection URLs (`:5432/`) to
 *    Supavisor transaction pooler (`:6543/?pgbouncer=true`) to prevent
 *    serverless connection exhaustion under concurrent cold starts.
 * 3. Ensures pre-configured Supabase `:6543/` pooler URLs include `pgbouncer=true`.
 */
export function resolvePooledDatabaseUrl(
  envVars: Readonly<Record<string, string | undefined>> = process.env
): string | undefined {
  const isServerlessOrProd = isServerlessRuntime(envVars) || envVars.NODE_ENV === 'production';

  const rawUrl =
    (isServerlessOrProd ? envVars.DATABASE_POOLER_URL : undefined) ??
    envVars.DATABASE_URL ??
    envVars.DATABASE_POOLER_URL ??
    envVars.SUPABASE_DATABASE_URL;

  if (!rawUrl) {
    return undefined;
  }

  if (!isSupabasePoolerOrDirectHost(rawUrl)) {
    return rawUrl;
  }

  if (isServerlessOrProd && rawUrl.includes(DIRECT_POSTGRES_PORT)) {
    const pooledPortUrl = rawUrl.replace(DIRECT_POSTGRES_PORT, SUPAVISOR_POOLER_PORT);
    return ensureSupavisorPoolerParam(pooledPortUrl);
  }

  if (rawUrl.includes(SUPAVISOR_POOLER_PORT)) {
    return ensureSupavisorPoolerParam(rawUrl);
  }

  return rawUrl;
}

/**
 * Builds `pg.Pool` connection options tuned for cross-region Supavisor TLS
 * handshakes and serverless concurrency ceilings.
 */
export function resolveKyselyPoolOptions(
  envVars: Readonly<Record<string, string | undefined>> = process.env
): KyselyPoolOptions {
  const connectionString = resolvePooledDatabaseUrl(envVars);
  if (!connectionString) {
    throw new APIError(
      'Missing DATABASE_URL. Set it in your env (Supabase connection pool string).'
    );
  }

  return {
    connectionString,
    max: isServerlessRuntime(envVars)
      ? SERVERLESS_POOL_MAX_CONNECTIONS
      : DEFAULT_POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
    keepAlive: true,
    keepAliveInitialDelayMillis: POOL_KEEP_ALIVE_INITIAL_DELAY_MS,
  };
}

const globalForKysely = globalThis as unknown as {
  kyselyInstance: Kysely<KyselyDatabase> | undefined;
};

export function createKyselyClient() {
  if (globalForKysely.kyselyInstance) return globalForKysely.kyselyInstance;

  const dialect = new PostgresDialect({
    pool: new Pool(resolveKyselyPoolOptions(process.env)),
  });

  const db = new Kysely<KyselyDatabase>({ dialect });
  globalForKysely.kyselyInstance = db;
  return db;
}
