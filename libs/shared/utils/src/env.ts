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

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const clientEnvShape = {
  // No silent fallbacks: a dummy key or a hardcoded project would let the app
  // boot against the wrong backend. Production requires these explicitly.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_FUXA_URL: z.string().url().optional(),
  NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID: z.string().optional(),
};

const serverEnvShape = {
  // ── Server-side required ───────────────────────────────────────────
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // ── Server — optional with defaults ────────────────────────────────
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ── Redis (optional, used only when configured) ────────────────────
  REDIS_URL: z.string().optional(),

  // ── LLM / AI providers (optional) ──────────────────────────────────
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEYS: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GOOGLE_PROJECT_ID: z.string().optional(),

  // ── Sentry (optional) ──────────────────────────────────────────────
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // ── External services (optional) ───────────────────────────────────
  FLOWISE_URL: z.string().url().optional(),

  // ── Feature flags ──────────────────────────────────────────────────
  ENABLE_LOAD_ADAPTIVE_TEST: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  DISABLE_RATE_LIMIT: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // ── Rate limiting ──────────────────────────────────────────────────
  RATE_LIMIT_IP_WHITELIST: z.string().optional(),
  DISABLE_CORS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ALLOWED_ORIGINS: z.string().optional(),

  // ── Inngest / Background jobs ──────────────────────────────────────
  INNGEST_EVENT_KEY: z.string().optional(),

  // ── Novu (notifications) ───────────────────────────────────────────
  NOVU_API_KEY: z.string().optional(),

  // ── Observability ──────────────────────────────────────────────────
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('arch-portal'),
  ENABLE_DB_TRACING: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().positive().default(500),

  // ── Version ────────────────────────────────────────────────────────
  PORTAL_VERSION: z.string().default('1.0.0'),
  VERCEL_ENV: z.string().optional(),
  CI: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
};

const envSchema = z
  .object({
    ...clientEnvShape,
    ...serverEnvShape,
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;

    const supabaseUrl = data.NEXT_PUBLIC_SUPABASE_URL ?? data.SUPABASE_URL;
    if (!supabaseUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SUPABASE_URL'],
        message:
          'Supabase URL is required in production (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)',
      });
    }

    const supabaseKey =
      data.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      data.SUPABASE_ANON_KEY;
    if (!supabaseKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
        message:
          'Supabase key is required in production (NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)',
      });
    }
  });

// ---------------------------------------------------------------------------
// Parsed result (cached singleton)
// ---------------------------------------------------------------------------

type EnvVars = z.infer<typeof envSchema>;

let _env: EnvVars | null = null;
let _envError: z.ZodError | null = null;

/**
 * Creates a strict `@t3-oss/env-nextjs` validated environment instance
 * enforcing client/server bundle boundaries.
 */
export function createT3Env(skipValidation = process.env.NODE_ENV !== 'production') {
  return createEnv({
    client: clientEnvShape,
    server: serverEnvShape,
    emptyStringAsUndefined: true,
    skipValidation,
    runtimeEnv: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_FUXA_URL: process.env.NEXT_PUBLIC_FUXA_URL,
      NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID: process.env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      REDIS_URL: process.env.REDIS_URL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
      GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
      SENTRY_ORG: process.env.SENTRY_ORG,
      SENTRY_PROJECT: process.env.SENTRY_PROJECT,
      SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
      FLOWISE_URL: process.env.FLOWISE_URL,
      ENABLE_LOAD_ADAPTIVE_TEST: process.env.ENABLE_LOAD_ADAPTIVE_TEST,
      DISABLE_RATE_LIMIT: process.env.DISABLE_RATE_LIMIT,
      RATE_LIMIT_IP_WHITELIST: process.env.RATE_LIMIT_IP_WHITELIST,
      DISABLE_CORS: process.env.DISABLE_CORS,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
      NOVU_API_KEY: process.env.NOVU_API_KEY,
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
      ENABLE_DB_TRACING: process.env.ENABLE_DB_TRACING,
      SLOW_QUERY_THRESHOLD_MS: process.env.SLOW_QUERY_THRESHOLD_MS,
      PORTAL_VERSION: process.env.PORTAL_VERSION,
      VERCEL_ENV: process.env.VERCEL_ENV,
      CI: process.env.CI,
    },
  });
}

/**
 * Returns validated environment variables.
 * In production, throws on missing required vars.
 * In dev/test, logs warnings and returns whatever was provided (no secret
 * fallbacks — features that need a value must fail at their own boundary).
 */
function parseEnv(): EnvVars {
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    REDIS_URL: process.env.REDIS_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    // AGENT-TRACE: These four were present in the schema and createT3Env but
    // missing here, so parseEnv() silently dropped them.
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    FLOWISE_URL: process.env.FLOWISE_URL,
    NEXT_PUBLIC_FUXA_URL: process.env.NEXT_PUBLIC_FUXA_URL,
    NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID: process.env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID,
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
      typeof val === 'string' && (val.trim() === '' || val.trim() === '...') ? undefined : val,
    ])
  ) as Record<keyof typeof raw, unknown>;

  const result = envSchema.safeParse(cleaned);

  if (!result.success) {
    _envError = result.error;

    if (raw.NODE_ENV === 'production') {
      const fatal = result.error.issues.filter(
        (i) =>
          i.code === 'custom' ||
          (i.code === 'invalid_type' && 'received' in i && i.received === 'undefined')
      );
      if (fatal.length > 0) {
        const messages = fatal.map((i) => `${i.path.join('.')}: ${i.message}`);
        console.error(`[env] Invalid production environment:\n  ${messages.join('\n  ')}`);
        throw new Error(`Invalid production environment: ${messages.join(', ')}`);
      }
    }

    // Non-critical — log warning and apply defaults
    console.warn(
      '[env] Some environment variables have warnings:',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
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
