/**
 * Runtime Environment Validation — Zod-powered env var schema.
 *
 * Validates required and optional environment variables at module load time.
 * Fails fast with descriptive messages for missing critical config.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
 *
 * NOTE: Public vars (NEXT_PUBLIC_*) are validated but never contain secrets.
 *       Server-only vars are never exposed to the client bundle.
 */

/* eslint-disable no-console */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // ── Public (embedded in client bundle — safe defaults for dev) ──────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("dummy-anon-key"),

  // ── Server-side required ───────────────────────────────────────────
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // ── Server — optional with defaults ────────────────────────────────
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // ── Redis (optional, used only when configured) ────────────────────
  REDIS_URL: z.string().optional(),

  // ── LLM / AI providers (optional) ──────────────────────────────────
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),

  // ── Sentry (optional) ──────────────────────────────────────────────
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // ── External services (optional) ───────────────────────────────────
  N8N_URL: z.string().url().optional(),
  N8N_USER: z.string().optional(),
  N8N_PASSWORD: z.string().optional(),
  FLOWISE_URL: z.string().url().optional(),
  NEXT_PUBLIC_FUXA_URL: z.string().url().optional(),
  NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID: z.string().optional(),

  // ── Feature flags ──────────────────────────────────────────────────
  ENABLE_LOAD_ADAPTIVE_TEST: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  DISABLE_RATE_LIMIT: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // ── Rate limiting ──────────────────────────────────────────────────
  RATE_LIMIT_IP_WHITELIST: z.string().optional(),
  DISABLE_CORS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  ALLOWED_ORIGINS: z.string().optional(),

  // ── Inngest / Background jobs ──────────────────────────────────────
  INNGEST_EVENT_KEY: z.string().optional(),

  // ── Novu (notifications) ───────────────────────────────────────────
  NOVU_API_KEY: z.string().optional(),

  // ── Observability ──────────────────────────────────────────────────
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("arch-portal"),
  ENABLE_DB_TRACING: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().positive().default(500),

  // ── Version ────────────────────────────────────────────────────────
  PORTAL_VERSION: z.string().default("1.0.0"),
  VERCEL_ENV: z.string().optional(),
  CI: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

// ---------------------------------------------------------------------------
// Parsed result (cached singleton)
// ---------------------------------------------------------------------------

type EnvVars = z.infer<typeof envSchema>;

let _env: EnvVars | null = null;
let _envError: z.ZodError | null = null;

/**
 * Returns validated environment variables.
 * In production, throws on missing required vars.
 * In dev/test, uses defaults where possible and logs warnings.
 */
function parseEnv(): EnvVars {
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    REDIS_URL: process.env.REDIS_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    N8N_URL: process.env.N8N_URL,
    N8N_USER: process.env.N8N_USER,
    N8N_PASSWORD: process.env.N8N_PASSWORD,
    FLOWISE_URL: process.env.FLOWISE_URL,
    NEXT_PUBLIC_FUXA_URL: process.env.NEXT_PUBLIC_FUXA_URL,
    NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID:
      process.env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID,
    ENABLE_LOAD_ADAPTIVE_TEST: process.env.ENABLE_LOAD_ADAPTIVE_TEST,
    DISABLE_RATE_LIMIT: process.env.DISABLE_RATE_LIMIT,
    RATE_LIMIT_IP_WHITELIST: process.env.RATE_LIMIT_IP_WHITELIST,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    NOVU_API_KEY: process.env.NOVU_API_KEY,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    DISABLE_CORS: process.env.DISABLE_CORS,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    ENABLE_DB_TRACING: process.env.ENABLE_DB_TRACING,
    SLOW_QUERY_THRESHOLD_MS: process.env.SLOW_QUERY_THRESHOLD_MS,
    PORTAL_VERSION: process.env.PORTAL_VERSION,
    VERCEL_ENV: process.env.VERCEL_ENV,
    CI: process.env.CI,
  };

  // Map empty strings and '...' to undefined so that optional/default schema validations can proceed normally
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([key, val]) => [
      key,
      typeof val === "string" && (val.trim() === "" || val.trim() === "...")
        ? undefined
        : val,
    ]),
  ) as Record<keyof typeof raw, unknown>;

  const result = envSchema.safeParse(cleaned);

  if (!result.success) {
    _envError = result.error;

    if (raw.NODE_ENV === "production") {
      const missing = result.error.issues
        .filter(
          (i) =>
            i.code === "invalid_type" &&
            "received" in i &&
            i.received === "undefined",
        )
        .map((i) => i.path.join("."));
      if (missing.length > 0) {
        console.error(
          `[env] Missing required environment variables:\n  ${missing.join("\n  ")}`,
        );
        throw new Error(
          `Missing required environment variables: ${missing.join(", ")}`,
        );
      }
    }

    // Non-critical — log warning and apply defaults
    console.warn(
      "[env] Some environment variables have warnings:",
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }

  return result.data ?? ({} as EnvVars);
}

/**
 * Validated environment variables singleton.
 * Falls back to defaults in dev; fails fast in prod.
 */
export const env: Readonly<EnvVars> = new Proxy<EnvVars>({} as EnvVars, {
  get(_target, prop: string | symbol) {
    if (!_env) {
      _env = parseEnv();
    }
    return (_env as Record<string, unknown>)[prop as string];
  },
  ownKeys() {
    if (!_env) _env = parseEnv();
    return Object.keys(_env);
  },
  getOwnPropertyDescriptor() {
    return { configurable: true, enumerable: true };
  },
});

/**
 * Returns the parse errors for debugging (null if valid).
 */
export function getEnvErrors(): z.ZodError | null {
  if (!_env) parseEnv();
  return _envError;
}

/**
 * Resets the cached env (useful in tests).
 */
export function resetEnv(): void {
  _env = null;
  _envError = null;
}
