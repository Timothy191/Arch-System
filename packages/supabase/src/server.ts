/* global RequestInfo, RequestInit */

import { serverLogger } from '@repo/logger';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { resolveSupabasePublicConfig } from './config';
import { normalizeSupabaseCookies } from './cookie-utils';

export { createClient };

const SLOW_QUERY_THRESHOLD_MS = 500;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;

export interface InstrumentedFetchOptions {
  readonly isHealthProbe?: boolean;
}

export interface ServerSupabaseClientOptions {
  readonly healthProbe?: boolean;
}

interface ExecuteInstrumentedFetchParams {
  readonly input: RequestInfo | URL;
  readonly init?: RequestInit;
  readonly isHealthProbe: boolean;
}

interface QueryOutcomeLogParams {
  readonly tableName: string;
  readonly method: string;
  readonly elapsedMs: number;
  readonly success: boolean;
  readonly statusCode: number | null;
  readonly isHealthProbe: boolean;
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function extractTableName(urlStr: string): string {
  if (!urlStr) {
    return 'unknown';
  }
  try {
    const parsedUrl = new URL(urlStr);
    const segments = parsedUrl.pathname.split('/');
    const restIndex = segments.indexOf('v1');
    if (restIndex !== -1 && segments[restIndex + 1]) {
      return segments[restIndex + 1]!.split('?')[0] || 'unknown';
    }
  } catch {
    // Ignore malformed URLs and fall back to unknown table label.
  }
  return 'unknown';
}

function logQueryOutcome(params: QueryOutcomeLogParams): void {
  const { tableName, method, elapsedMs, success, statusCode, isHealthProbe } = params;
  const roundedDurationMs = Math.round(elapsedMs);
  const logFields = {
    tableName,
    method,
    durationMs: roundedDurationMs,
    success,
  };

  const isExpectedProbeLockdown =
    isHealthProbe &&
    (statusCode === HTTP_STATUS_UNAUTHORIZED || statusCode === HTTP_STATUS_FORBIDDEN);

  if (isExpectedProbeLockdown) {
    serverLogger.debug(
      logFields,
      `Database query: ${tableName} (${method}) in ${roundedDurationMs}ms`
    );
    return;
  }

  if (elapsedMs > SLOW_QUERY_THRESHOLD_MS) {
    serverLogger.warn(
      logFields,
      `Slow database query detected: ${tableName} (${method}) took ${roundedDurationMs}ms`
    );
    return;
  }

  if (!success) {
    serverLogger.error(logFields, `Database query failed: ${tableName} (${method})`);
    return;
  }

  serverLogger.debug(
    logFields,
    `Database query: ${tableName} (${method}) in ${roundedDurationMs}ms`
  );
}

async function executeInstrumentedFetch(params: ExecuteInstrumentedFetchParams): Promise<Response> {
  const { input, init, isHealthProbe } = params;
  const start = performance.now();
  let response: Response | null = null;
  let success = false;

  try {
    response = await fetch(input, init);
    success = response.ok;
    return response;
  } finally {
    const elapsedMs = performance.now() - start;
    const urlStr = resolveRequestUrl(input);
    const method = init?.method ?? 'GET';
    const tableName = extractTableName(urlStr);

    logQueryOutcome({
      tableName,
      method,
      elapsedMs,
      success,
      statusCode: response?.status ?? null,
      isHealthProbe,
    });
  }
}

/**
 * Create an instrumented fetch wrapper for Supabase HTTP requests.
 */
export function createInstrumentedFetch(options?: InstrumentedFetchOptions) {
  const isHealthProbe = Boolean(options?.isHealthProbe);
  return async function configuredInstrumentedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    return executeInstrumentedFetch({ input, init, isHealthProbe });
  };
}

export async function instrumentedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return executeInstrumentedFetch({ input, init, isHealthProbe: false });
}

export async function createServerSupabaseClient(options?: ServerSupabaseClientOptions) {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = resolveSupabasePublicConfig();
  const fetchImpl = options?.healthProbe
    ? createInstrumentedFetch({ isHealthProbe: true })
    : instrumentedFetch;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: fetchImpl,
    },
    cookies: {
      getAll() {
        const all = cookieStore.getAll();
        return normalizeSupabaseCookies(all);
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>
      ) {
        try {
          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }: {
              name: string;
              value: string;
              options?: Record<string, unknown>;
            }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: (options?.maxAge as number | undefined) ?? 34560000,
                path: (options?.path as string | undefined) ?? '/',
                sameSite:
                  (options?.sameSite as 'lax' | 'strict' | 'none' | boolean | undefined) ?? 'lax',
              })
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

export function createBearerSupabaseClient(token: string) {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabasePublicConfig();

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      fetch: instrumentedFetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Verified identity derived from the session JWT.
 * Only the fields callers actually rely on are exposed.
 */
export interface AuthIdentity {
  id: string;
  email: string | null;
}

/**
 * Safely gets the current user's verified identity from Supabase auth.
 *
 * Uses `auth.getClaims()`, which verifies the JWT signature:
 * - with asymmetric signing keys: locally against the cached JWKS (no Auth round-trip)
 * - with a legacy symmetric secret: by falling back to `getUser()` (Auth round-trip)
 * Either way the identity is verified — unlike `getSession()`, which trusts the
 * cookie as-is and must never be used for authorization on the server.
 *
 * Swallows any error into `null` so callers can treat an unauthenticated
 * request and a transient Supabase error the same way.
 */
const userIdentityCache = new WeakMap<object, Promise<AuthIdentity | null>>();

async function resolveUserSafely(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<AuthIdentity | null> {
  try {
    if (typeof supabase.auth.getClaims === 'function') {
      const { data, error } = await supabase.auth.getClaims();
      const sub = data?.claims?.sub;
      if (error || !sub) {
        return null;
      }
      const email = data.claims.email;
      return { id: sub, email: typeof email === 'string' ? email : null };
    }
    if (typeof supabase.auth.getUser === 'function') {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user?.id) {
        return null;
      }
      return { id: data.user.id, email: data.user.email ?? null };
    }
    return null;
  } catch (_error) {
    return null;
  }
}

export async function getUserSafely(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<AuthIdentity | null> {
  if (!supabase || typeof supabase !== 'object') {
    return null;
  }
  const cached = userIdentityCache.get(supabase);
  if (cached) {
    return cached;
  }
  const pending = resolveUserSafely(supabase);
  userIdentityCache.set(supabase, pending);
  return pending;
}
