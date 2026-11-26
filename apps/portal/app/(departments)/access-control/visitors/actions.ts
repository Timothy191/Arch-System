'use server';

import { visitorApprovalSchema } from '@repo/contract/schemas/access-control.schema';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter, RedisStore } from '@repo/rate-limiter';
import { cacheInvalidateTags, getRedisClient } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import {
  DatabaseError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { assertAccessControlRole } from '../actions/shared';
import {
  type AutoExitedVisitorRecord,
  type AutoExitOptions,
  type AutoExitVisitorsResult,
  executeVisitorAutoExitSweep,
} from './auto-exit-service';
import { MANUAL_CHECKED_OUT_STATUS } from './visitor-auto-exit';

export type { AutoExitedVisitorRecord, AutoExitOptions, AutoExitVisitorsResult };

const VISITOR_BADGE_VALIDITY_HOURS = 8;
const VISITOR_MUTATION_LIMIT = 30;
const VISITOR_MUTATION_WINDOW_MS = 60_000;

function createVisitorRateLimiter(keyPrefix: string): RateLimiter {
  try {
    const redis = getRedisClient();
    return new RateLimiter({
      store: redis ? new RedisStore(redis as never) : new MemoryStore(),
      strategy: new FixedWindowStrategy(),
      limit: VISITOR_MUTATION_LIMIT,
      windowMs: VISITOR_MUTATION_WINDOW_MS,
      keyPrefix,
    });
  } catch {
    return new RateLimiter({
      store: new MemoryStore(),
      strategy: new FixedWindowStrategy(),
      limit: VISITOR_MUTATION_LIMIT,
      windowMs: VISITOR_MUTATION_WINDOW_MS,
      keyPrefix,
    });
  }
}

const visitorMutationLimiter = createVisitorRateLimiter('ratelimit:visitor_mutation:');

export async function autoExitOverdueVisitors(
  deptId: string,
  options?: AutoExitOptions
): Promise<AutoExitVisitorsResult> {
  const { supabase, employee } = await assertAccessControlRole({ requireWrite: true });
  const { allowed } = await visitorMutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Too many visitor auto-exit requests. Please wait.');
  }
  return executeVisitorAutoExitSweep(supabase, deptId, options);
}

export async function manualCheckOutVisitor(visitorId: string) {
  const normalizedId = visitorId.trim();
  if (!normalizedId) {
    throw new ValidationError('Visitor ID is required for check-out');
  }

  const { supabase, employee, departmentId } = await assertAccessControlRole({
    requireWrite: true,
  });
  const { allowed } = await visitorMutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Too many visitor mutations. Please wait.');
  }

  const exitedAt = new Date().toISOString();

  const { data: updatedRows, error: updateVisitorError } = await supabase
    .from('visitors')
    .update({
      status: MANUAL_CHECKED_OUT_STATUS,
      check_out_time: exitedAt,
    })
    .eq('id', normalizedId)
    .select('id');

  if (updateVisitorError) {
    throw new DatabaseError('Failed to check out visitor', {
      operation: 'update',
      table: 'visitors',
      context: { error: updateVisitorError.message, visitorId: normalizedId },
    });
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new ForbiddenError('Visitor check-out blocked or record not found', {
      resource: 'visitors',
      action: 'manual_checkout',
    });
  }

  const { error: deactivateBadgeError } = await supabase
    .from('badges')
    .update({
      is_active: false,
      revoked_at: exitedAt,
    })
    .eq('visitor_id', normalizedId)
    .eq('is_active', true)
    .select('id');

  if (deactivateBadgeError) {
    logError(
      new DatabaseError('Failed to deactivate visitor badge during manual check-out', {
        operation: 'update',
        table: 'badges',
        context: { error: deactivateBadgeError.message, visitorId: normalizedId },
      })
    );
  }

  logger.info({
    event: 'visitor_checked_out',
    actorId: employee.id,
    visitorId: normalizedId,
  });

  await cacheInvalidateTags([
    'table:visitors',
    'table:badges',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
  revalidatePath('/access-control/visitors');

  return { success: true as const, visitorId: normalizedId, exitedAt };
}

export async function approveAndCheckInVisitor(visitorId: string) {
  const { supabase, employee, departmentId } = await assertAccessControlRole({
    requireWrite: true,
  });

  const parsed = visitorApprovalSchema.safeParse({ visitorId });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid visitor ID');
  }

  const { allowed } = await visitorMutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Too many visitor approval requests. Please wait.');
  }

  const now = new Date();
  const checkedInAt = now.toISOString();
  const badgeExpiresAt = new Date(
    now.getTime() + VISITOR_BADGE_VALIDITY_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: updatedRows, error: updateVisitorError } = await supabase
    .from('visitors')
    .update({
      status: 'Checked In',
      check_in_time: checkedInAt,
      check_out_time: null,
    })
    .eq('id', parsed.data.visitorId)
    .eq('status', 'Pre-Registered')
    .select('id');

  if (updateVisitorError) {
    throw new DatabaseError('Failed to approve visitor check-in', {
      operation: 'update',
      table: 'visitors',
      context: { error: updateVisitorError.message, visitorId: parsed.data.visitorId },
    });
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new ForbiddenError('Visitor approval blocked or visitor is no longer Pre-Registered', {
      resource: 'visitors',
      action: 'approve_check_in',
    });
  }

  const { data: activatedBadges, error: badgeError } = await supabase
    .from('badges')
    .update({
      is_active: true,
      issued_at: checkedInAt,
      expires_at: badgeExpiresAt,
      revoked_at: null,
    })
    .eq('visitor_id', parsed.data.visitorId)
    .select('id');

  if (badgeError) {
    throw new DatabaseError('Failed to activate visitor credential on approval', {
      operation: 'update',
      table: 'badges',
      context: { error: badgeError.message, visitorId: parsed.data.visitorId },
    });
  }

  const primaryBadgeId = activatedBadges?.[0]?.id ?? null;
  if (primaryBadgeId) {
    await supabase.from('access_logs').insert([
      {
        badge_id: primaryBadgeId,
        access_type: 'visitor',
        direction: 'IN',
        gate_location: 'Gatehouse Desk Approval',
        access_granted: true,
        department_id: departmentId,
        alcohol_tested: 'Not Tested',
        operator: employee.id,
        scanned_at: checkedInAt,
      },
    ]);
  }

  logger.info({
    event: 'visitor_pre_registration_approved',
    actorId: employee.id,
    visitorId: parsed.data.visitorId,
  });

  await cacheInvalidateTags([
    'table:visitors',
    'table:badges',
    'table:access_logs',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
  revalidatePath('/access-control/visitors');
  revalidatePath('/access-control/badges');

  return { success: true as const, visitorId: parsed.data.visitorId, checkedInAt };
}

export async function rejectPreRegisteredVisitor(visitorId: string, reason?: string) {
  const { supabase, employee, departmentId } = await assertAccessControlRole({
    requireWrite: true,
  });

  const parsed = visitorApprovalSchema.safeParse({ visitorId, reason });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid visitor ID');
  }

  const { allowed } = await visitorMutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Too many visitor rejection requests. Please wait.');
  }

  const rejectedAt = new Date().toISOString();

  const { data: updatedRows, error: updateVisitorError } = await supabase
    .from('visitors')
    .update({
      status: 'Rejected',
      check_out_time: rejectedAt,
    })
    .eq('id', parsed.data.visitorId)
    .eq('status', 'Pre-Registered')
    .select('id');

  if (updateVisitorError) {
    throw new DatabaseError('Failed to reject pre-registered visitor', {
      operation: 'update',
      table: 'visitors',
      context: { error: updateVisitorError.message, visitorId: parsed.data.visitorId },
    });
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new ForbiddenError('Visitor rejection blocked or visitor is no longer Pre-Registered', {
      resource: 'visitors',
      action: 'reject_pre_registration',
    });
  }

  await supabase
    .from('badges')
    .update({
      is_active: false,
      revoked_at: rejectedAt,
    })
    .eq('visitor_id', parsed.data.visitorId)
    .select('id');

  logger.info({
    event: 'visitor_pre_registration_rejected',
    actorId: employee.id,
    visitorId: parsed.data.visitorId,
    reason: parsed.data.reason ?? 'Gatehouse rejection',
  });

  await cacheInvalidateTags([
    'table:visitors',
    'table:badges',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
  revalidatePath('/access-control/visitors');
  revalidatePath('/access-control/badges');

  return { success: true as const, visitorId: parsed.data.visitorId };
}
