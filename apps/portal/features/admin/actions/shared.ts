import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { createServerSupabaseClient } from '@repo/supabase/server';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const ADMIN_RATE_LIMIT_MAX = 30;
const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000;

const adminMutationLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: ADMIN_RATE_LIMIT_MAX,
  windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:admin-mutation:',
});

/**
 * Shared admin guard for admin server actions (fleet, minerals, sites, targets,
 * departments, card-templates).
 * Intentionally NOT a `'use server'` module: it is an internal helper consumed by
 * sibling action files and must never be exposed as a client-callable action.
 */
export async function assertAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: HTTP_UNAUTHORIZED } as const;

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (employee?.role !== 'admin') {
    return { error: 'Forbidden: admin role required', status: HTTP_FORBIDDEN } as const;
  }

  const rateLimit = await adminMutationLimiter.check(user.id);
  if (!rateLimit.allowed) {
    return { error: 'Rate limit exceeded', status: HTTP_TOO_MANY_REQUESTS } as const;
  }

  return { supabase, employee, userId: user.id };
}

/** Emits a structured audit event for an admin server action mutation. */
export function logAdminAuditEvent(options: {
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  logger.info({
    event: 'admin_mutation',
    actorId: options.actorId,
    action: options.action,
    resource: options.resource,
    resourceId: options.resourceId ?? null,
    ...(options.metadata ? { metadata: options.metadata } : {}),
  });
}
