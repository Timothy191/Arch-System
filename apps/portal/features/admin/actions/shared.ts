import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter, RedisStore } from '@repo/rate-limiter';
import { getRedisClient } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const ADMIN_RATE_LIMIT_MAX = 30;
const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_RATE_LIMIT_PREFIX = 'ratelimit:admin-mutation:';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AuditDbAction = 'insert' | 'update' | 'delete';

interface AdminAuditOptions {
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

const AUDIT_ACTION_MAP: Readonly<Record<string, AuditDbAction>> = {
  insert: 'insert',
  create: 'insert',
  delete: 'delete',
  remove: 'delete',
  update: 'update',
  archive: 'update',
  deactivate: 'update',
  set_default: 'update',
  bulk_generate_smr: 'update',
};

const fallbackAdminMutationLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: ADMIN_RATE_LIMIT_MAX,
  windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
  keyPrefix: ADMIN_RATE_LIMIT_PREFIX,
});

async function checkAdminMutationRateLimit(userId: string): Promise<{ allowed: boolean }> {
  try {
    if (typeof getRedisClient === 'function') {
      const redisClient = await getRedisClient();
      if (redisClient?.isOpen) {
        const redisLimiter = new RateLimiter({
          store: new RedisStore(redisClient),
          strategy: new FixedWindowStrategy(),
          limit: ADMIN_RATE_LIMIT_MAX,
          windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
          keyPrefix: ADMIN_RATE_LIMIT_PREFIX,
        });
        return await redisLimiter.check(userId);
      }
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Redis unavailable for adminMutationLimiter; falling back to MemoryStore'
    );
  }

  return fallbackAdminMutationLimiter.check(userId);
}

async function resolveEmployeeActorId(
  serviceRole: ReturnType<typeof createServiceRoleClient>,
  actorId: string
): Promise<string | null> {
  if (!UUID_PATTERN.test(actorId)) {
    return null;
  }

  try {
    const byAuthQuery = serviceRole
      .from('employees')
      .select('id')
      .eq('auth_id', actorId)
      .is('deleted_at', null);
    const { data: byAuthEmployee } = await (typeof byAuthQuery.maybeSingle === 'function'
      ? byAuthQuery.maybeSingle()
      : byAuthQuery.single());
    if (byAuthEmployee?.id) {
      return byAuthEmployee.id;
    }

    const byIdQuery = serviceRole
      .from('employees')
      .select('id')
      .eq('id', actorId)
      .is('deleted_at', null);
    const { data: byIdEmployee } = await (typeof byIdQuery.maybeSingle === 'function'
      ? byIdQuery.maybeSingle()
      : byIdQuery.single());
    return byIdEmployee?.id ?? null;
  } catch {
    return null;
  }
}

async function persistAdminAuditRow(options: AdminAuditOptions): Promise<void> {
  try {
    const serviceRole = createServiceRoleClient();
    const normalizedAction: AuditDbAction =
      AUDIT_ACTION_MAP[options.action.toLowerCase()] ?? 'update';
    const rawResourceId = options.resourceId ?? null;
    const validRecordUuid =
      rawResourceId && UUID_PATTERN.test(rawResourceId) ? rawResourceId : null;
    const performedBy = await resolveEmployeeActorId(serviceRole, options.actorId);

    const auditPayload: Record<string, unknown> = {
      event_action: options.action,
      actor_id: options.actorId,
      ...(rawResourceId && !validRecordUuid ? { resource_id: rawResourceId } : {}),
      ...(options.metadata ? options.metadata : {}),
    };

    const { error } = await serviceRole.from('audit_logs').insert({
      action: normalizedAction,
      table_name: options.resource,
      record_id: validRecordUuid,
      old_data: null,
      new_data: auditPayload,
      performed_by: performedBy,
    });

    if (error) {
      logger.warn(
        {
          event: 'admin_audit_persist_failed',
          error: error.message,
          resource: options.resource,
          action: normalizedAction,
        },
        'Failed to persist admin audit row'
      );
    }
  } catch (error) {
    logger.warn(
      {
        event: 'admin_audit_persist_error',
        error: error instanceof Error ? error.message : String(error),
        resource: options.resource,
      },
      'Best-effort audit_logs persistence skipped'
    );
  }
}

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

  const employeeQuery = supabase.from('employees').select('id, role').eq('auth_id', user.id);
  const activeEmployeeQuery =
    typeof employeeQuery.is === 'function' ? employeeQuery.is('deleted_at', null) : employeeQuery;
  const { data: employee } = await activeEmployeeQuery.single();

  if (employee?.role !== 'admin') {
    return { error: 'Forbidden: admin role required', status: HTTP_FORBIDDEN } as const;
  }

  const rateLimit = await checkAdminMutationRateLimit(user.id);
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

  void persistAdminAuditRow(options);
}
