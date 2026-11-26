import { cacheInvalidateTags } from '@repo/redis';
import type { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { DatabaseError, ForbiddenError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import {
  AUTO_EXITED_VISITOR_STATUS,
  isTimestampOverdueForAutoExit,
  isVisitorOverdueForAutoExit,
} from './visitor-auto-exit';

export interface AutoExitedVisitorRecord {
  readonly id: string;
  readonly name: string;
  readonly company: string;
  readonly checkInTime: string;
  readonly exitedAt: string;
}

export interface AutoExitVisitorsResult {
  readonly autoExited: readonly AutoExitedVisitorRecord[];
}

export interface AutoExitOptions {
  readonly skipRevalidate?: boolean;
}

interface RawPrimaryVisitorRow {
  readonly id: string;
  readonly first_name?: string | null;
  readonly surname?: string | null;
  readonly name?: string | null;
  readonly company?: string | null;
  readonly check_in_time?: string | null;
  readonly check_out_time?: string | null;
  readonly created_at?: string | null;
  readonly status?: string | null;
}

interface RawFallbackVisitorRow {
  readonly id: string;
  readonly name?: string | null;
  readonly company?: string | null;
  readonly check_in_time?: string | null;
  readonly check_out_time?: string | null;
  readonly created_at?: string | null;
  readonly status?: string | null;
}

interface NormalizedVisitorRow {
  readonly id: string;
  readonly name: string;
  readonly company: string;
  readonly check_in_time: string | null;
  readonly check_out_time: string | null;
  readonly created_at: string | null;
  readonly status: string | null;
}

interface ActiveVisitorBadgeRow {
  readonly id: string;
  readonly visitor_id: string | null;
  readonly issued_at: string | null;
}

function buildVisitorDisplayName(row: RawPrimaryVisitorRow): string {
  const fullName = [row.first_name, row.surname].filter(Boolean).join(' ').trim();
  if (fullName.length > 0) return fullName;
  if (row.name && row.name.trim().length > 0) return row.name.trim();
  return 'Visitor';
}

function normalizeVisitors(
  rows: readonly RawPrimaryVisitorRow[] | readonly RawFallbackVisitorRow[],
  isFallback: boolean
): NormalizedVisitorRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: isFallback ? row.name?.trim() || 'Visitor' : buildVisitorDisplayName(row),
    company: row.company?.trim() || 'General Visitor',
    check_in_time: row.check_in_time ?? null,
    check_out_time: row.check_out_time ?? null,
    created_at: row.created_at ?? null,
    status: row.status ?? null,
  }));
}

type SupabaseClientLike = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function executeVisitorAutoExitSweep(
  supabase: SupabaseClientLike,
  deptId: string,
  options?: AutoExitOptions
): Promise<AutoExitVisitorsResult> {
  const nowMs = Date.now();
  const exitedAt = new Date(nowMs).toISOString();

  const primaryRes = await supabase
    .from('visitors')
    .select('id, first_name, surname, company, check_in_time, check_out_time, created_at, status')
    .eq('department_id', deptId)
    .eq('status', 'Checked In');

  let normalizedVisitors: NormalizedVisitorRow[] = [];

  if (primaryRes.error) {
    const fallbackRes = await supabase
      .from('visitors')
      .select('id, name, company, check_in_time, check_out_time, created_at, status')
      .eq('status', 'Checked In');

    if (fallbackRes.error) {
      throw new DatabaseError('Failed to check overdue visitors', {
        operation: 'select',
        table: 'visitors',
        context: { error: fallbackRes.error.message },
      });
    }

    normalizedVisitors = normalizeVisitors(
      (fallbackRes.data ?? []) as RawFallbackVisitorRow[],
      true
    );
  } else {
    normalizedVisitors = normalizeVisitors(
      (primaryRes.data ?? []) as RawPrimaryVisitorRow[],
      false
    );
  }

  if (normalizedVisitors.length === 0) {
    return { autoExited: [] };
  }

  const visitorIds = normalizedVisitors.map((visitor) => visitor.id);
  const { data: activeBadgeRows, error: badgeQueryError } = await supabase
    .from('badges')
    .select('id, visitor_id, issued_at')
    .in('visitor_id', visitorIds)
    .eq('is_active', true);

  if (badgeQueryError) {
    logError(
      new DatabaseError('Failed to query active visitor badges during auto-exit check', {
        operation: 'select',
        table: 'badges',
        context: { error: badgeQueryError.message },
      })
    );
  }

  const badgesByVisitorId = new Map<string, ActiveVisitorBadgeRow[]>();
  for (const badgeRow of (activeBadgeRows ?? []) as ActiveVisitorBadgeRow[]) {
    if (!badgeRow.visitor_id) continue;
    const existing = badgesByVisitorId.get(badgeRow.visitor_id) ?? [];
    badgesByVisitorId.set(badgeRow.visitor_id, [...existing, badgeRow]);
  }

  const overdueVisitors = normalizedVisitors.filter((visitor) => {
    if (isVisitorOverdueForAutoExit(visitor, nowMs)) return true;
    if (visitor.status !== 'Checked In' || visitor.check_out_time) return false;
    const visitorBadges = badgesByVisitorId.get(visitor.id) ?? [];
    return visitorBadges.some((badge) => isTimestampOverdueForAutoExit(badge.issued_at, nowMs));
  });

  if (overdueVisitors.length === 0) {
    return { autoExited: [] };
  }

  const overdueIds = overdueVisitors.map((visitor) => visitor.id);

  const visitorUpdateBuilder = supabase
    .from('visitors')
    .update({
      status: AUTO_EXITED_VISITOR_STATUS,
      check_out_time: exitedAt,
    })
    .in('id', overdueIds);

  const { data: updatedVisitorRows, error: updateVisitorError } =
    typeof (visitorUpdateBuilder as { select?: unknown }).select === 'function'
      ? await visitorUpdateBuilder.select('id')
      : await visitorUpdateBuilder;

  if (updateVisitorError) {
    throw new DatabaseError('Failed to auto-exit overdue visitors', {
      operation: 'update',
      table: 'visitors',
      context: { error: updateVisitorError.message },
    });
  }

  if (Array.isArray(updatedVisitorRows) && updatedVisitorRows.length === 0) {
    throw new ForbiddenError('Auto-exit permission denied or no overdue visitors updated', {
      resource: 'visitors',
      action: 'auto_exit',
    });
  }

  const updatedIdSet = new Set(
    Array.isArray(updatedVisitorRows) ? updatedVisitorRows.map((row) => String(row.id)) : overdueIds
  );

  const badgeUpdateBuilder = supabase
    .from('badges')
    .update({
      is_active: false,
      revoked_at: exitedAt,
    })
    .in('visitor_id', Array.from(updatedIdSet))
    .eq('is_active', true);

  const { error: updateBadgeError } =
    typeof (badgeUpdateBuilder as { select?: unknown }).select === 'function'
      ? await badgeUpdateBuilder.select('id')
      : await badgeUpdateBuilder;

  if (updateBadgeError) {
    logError(
      new DatabaseError('Failed to deactivate badges for auto-exited visitors', {
        operation: 'update',
        table: 'badges',
        context: { error: updateBadgeError.message },
      })
    );
  }

  const accessLogEntries = Array.from(updatedIdSet).flatMap((visitorId) => {
    const visitorBadges = badgesByVisitorId.get(visitorId) ?? [];
    return visitorBadges.map((badge) => ({
      badge_id: badge.id,
      access_type: 'visitor',
      direction: 'OUT',
      gate_location: 'Auto-Exit (12h Limit)',
      access_granted: true,
      denial_reason: 'Auto-Exited after 12-hour visitor limit',
      department_id: deptId,
      operator: 'System Auto-Exit',
      scanned_at: exitedAt,
    }));
  });

  if (accessLogEntries.length > 0) {
    const { error: logInsertError } = await supabase.from('access_logs').insert(accessLogEntries);
    if (logInsertError) {
      logError(
        new DatabaseError('Failed to record access_logs exit entries for auto-exited visitors', {
          operation: 'insert',
          table: 'access_logs',
          context: { error: logInsertError.message },
        })
      );
    }
  }

  await cacheInvalidateTags([
    'table:visitors',
    'table:badges',
    'table:access_logs',
    ...(deptId ? [`dept:${deptId}`] : []),
  ]);

  if (!options?.skipRevalidate) {
    revalidatePath('/access-control/visitors');
  }

  const autoExited: AutoExitedVisitorRecord[] = overdueVisitors
    .filter((visitor) => updatedIdSet.has(visitor.id))
    .map((visitor) => ({
      id: visitor.id,
      name: visitor.name,
      company: visitor.company,
      checkInTime: visitor.check_in_time ?? visitor.created_at ?? exitedAt,
      exitedAt,
    }));

  return { autoExited };
}
