'use server';

import { CacheCategory } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { withCache } from '@/lib/cache-utils';
import { DatabaseError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { assertAccessControlRole } from './shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AccessControlMetrics {
  activeQrCodes: number;
  expiringSoon: number;
  deniedToday: number;
  accessEventsToday: number;
  expiredAssigned: number;
  entityCoverage: number;
}

interface AccessActivityEntry {
  id: string;
  entityName: string;
  entityType: string;
  zone: string;
  status: 'Granted' | 'Denied' | 'Expired Credential' | 'Tailgate Alert';
  time: string;
  qrId: string;
}

interface EntityBadgeStatus {
  type: string;
  total: number;
  active: number;
  expiring: number;
  expired: number;
}

export interface HourlyAccessPoint {
  hour: string;
  granted: number;
  denied: number;
}

export interface BadgeStatusDistribution {
  name: string;
  value: number;
  fill: string;
}

/* ------------------------------------------------------------------ */
/*  Shared fallback counters (used when the metrics RPC is missing)    */
/* ------------------------------------------------------------------ */

interface MetricsFallback {
  activeQrCodes: number;
  expiringSoon: number;
  deniedToday: number;
  accessEventsToday: number;
  expiredAssigned: number;
  totalEntities: number;
}

async function fetchMetricsFallback(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  deptId: string
): Promise<MetricsFallback> {
  const now = new Date();
  const today = new Date(`${now.toISOString().split('T')[0]}T00:00:00Z`);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    { count: activeCount },
    { count: expiringCount },
    { count: expiredCount },
    { count: deniedCount },
    { count: eventsCount },
    { count: personnelCount },
  ] = await Promise.all([
    supabase
      .from('badges')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', deptId)
      .eq('is_active', true),
    supabase
      .from('badges')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', deptId)
      .eq('is_active', true)
      .lte('expires_at', in7Days.toISOString())
      .gt('expires_at', now.toISOString()),
    supabase
      .from('badges')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', deptId)
      .eq('is_active', true)
      .lt('expires_at', now.toISOString()),
    supabase
      .from('access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', deptId)
      .eq('access_granted', false)
      .gte('scanned_at', today.toISOString()),
    supabase
      .from('access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', deptId)
      .gte('scanned_at', today.toISOString()),
    supabase
      .from('personnel')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', deptId),
  ]);

  return {
    activeQrCodes: activeCount || 0,
    expiringSoon: expiringCount || 0,
    deniedToday: deniedCount || 0,
    accessEventsToday: eventsCount || 0,
    expiredAssigned: expiredCount || 0,
    totalEntities: personnelCount || 0,
  };
}

const EMPTY_METRICS_FALLBACK: MetricsFallback = {
  activeQrCodes: 0,
  expiringSoon: 0,
  deniedToday: 0,
  accessEventsToday: 0,
  expiredAssigned: 0,
  totalEntities: 0,
};

/* ------------------------------------------------------------------ */
/*  1. KPI Metrics                                                     */
/* ------------------------------------------------------------------ */

export async function getAccessControlMetrics(deptId: string): Promise<AccessControlMetrics> {
  return withCache(
    async () => {
      const { supabase } = await assertAccessControlRole();

      const { data, error } = await supabase.rpc('get_access_control_metrics_jsonb', {
        p_department_id: deptId,
      });

      let fallback: MetricsFallback = EMPTY_METRICS_FALLBACK;

      if (error && (error.message?.includes('schema cache') || error.code === 'PGRST202')) {
        // RPC missing from schema cache: direct count queries
        fallback = await fetchMetricsFallback(supabase, deptId);
      } else if (error) {
        // Log non-fatal RPC error and run direct fallback count query
        logError(
          new DatabaseError(
            'Access control metrics RPC failed, executing direct count query fallback',
            {
              context: { error: error.message },
            }
          )
        );
        try {
          fallback = await fetchMetricsFallback(supabase, deptId);
        } catch {
          // Graceful zeroes if database tables are unseeded or offline
          fallback = EMPTY_METRICS_FALLBACK;
        }
      } else {
        const metrics = (data as Record<string, unknown>)?.metrics as
          | Record<string, number>
          | undefined;
        fallback = {
          activeQrCodes: metrics?.active_qr_codes ?? 0,
          expiringSoon: metrics?.expiring_soon ?? 0,
          deniedToday: metrics?.denied_today ?? 0,
          accessEventsToday: metrics?.access_events_today ?? 0,
          expiredAssigned: metrics?.expired_assigned ?? 0,
          totalEntities: metrics?.total_entities ?? 0,
        };
      }

      const entityCoverage =
        fallback.totalEntities && fallback.activeQrCodes
          ? Math.round((fallback.activeQrCodes / fallback.totalEntities) * 100)
          : 0;

      return {
        activeQrCodes: fallback.activeQrCodes,
        expiringSoon: fallback.expiringSoon,
        deniedToday: fallback.deniedToday,
        accessEventsToday: fallback.accessEventsToday,
        expiredAssigned: fallback.expiredAssigned,
        entityCoverage,
      };
    },
    {
      category: CacheCategory.METRICS,
      keyParts: ['access-control', deptId, 'metrics'],
      tags: [`dept:${deptId}`, 'table:badges', 'table:access_logs', 'table:personnel'],
    }
  );
}

/* ------------------------------------------------------------------ */
/*  2. Recent Activity Feed                                            */
/* ------------------------------------------------------------------ */

interface AccessLogWithBadge {
  id: string;
  scanned_at: string;
  gate_location: string;
  access_granted: boolean;
  denial_reason: string | null;
  badge: {
    qr_code: string;
    entity_type: string;
    personnel: { first_name: string; surname: string } | null;
    visitor: { first_name: string; surname: string } | null;
  };
}

export async function getRecentAccessActivity(
  deptId: string,
  limit = 8
): Promise<AccessActivityEntry[]> {
  const { supabase } = await assertAccessControlRole();

  const { data: logs } = await supabase
    .from('access_logs')
    .select(
      `
      id,
      scanned_at,
      gate_location,
      access_granted,
      denial_reason,
      badge:badges!inner(qr_code, entity_type, personnel:personnel_id(first_name, surname), visitor:visitor_id(name))
    `
    )
    .eq('department_id', deptId)
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (!logs) return [];

  return (logs as unknown as AccessLogWithBadge[]).map((log) => {
    const { badge } = log;
    let entityName = 'Unknown';
    let entityType = badge?.entity_type ?? 'Unknown';

    if (badge?.personnel) {
      entityName = `${badge.personnel.first_name} ${badge.personnel.surname}`;
      entityType = 'Employee';
    } else if (badge?.visitor) {
      entityName = `${badge.visitor.first_name} ${badge.visitor.surname}`;
      entityType = 'Visitor';
    }

    let status: AccessActivityEntry['status'] = 'Granted';
    if (!log.access_granted) {
      status =
        log.denial_reason?.includes('Expired') || log.denial_reason?.includes('expired')
          ? 'Expired Credential'
          : log.denial_reason?.includes('Tailgate')
            ? 'Tailgate Alert'
            : 'Denied';
    }

    return {
      id: log.id,
      entityName,
      entityType,
      zone: log.gate_location,
      status,
      time: new Date(log.scanned_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      qrId: badge?.qr_code ?? 'N/A',
    };
  });
}

/* ------------------------------------------------------------------ */
/*  3. Entity Badge Status                                             */
/* ------------------------------------------------------------------ */

export async function getEntityBadgeStatus(deptId: string): Promise<EntityBadgeStatus[]> {
  return withCache(
    async () => {
      const { supabase } = await assertAccessControlRole();

      const { data, error } = await supabase.rpc('get_access_control_metrics_jsonb', {
        p_department_id: deptId,
      });

      if (error) {
        logError(
          new DatabaseError(
            'Failed to load entity badge status via RPC, returning default status',
            {
              context: { error: error.message },
            }
          )
        );
        return [
          { type: 'Employees', total: 0, active: 0, expiring: 0, expired: 0 },
          { type: 'Vehicles', total: 0, active: 0, expiring: 0, expired: 0 },
          { type: 'Equipment', total: 0, active: 0, expiring: 0, expired: 0 },
        ];
      }

      const status = (data as Record<string, unknown>)?.entity_badge_status as
        | Record<
            string,
            {
              total?: number;
              active?: number;
              expiring?: number;
              expired?: number;
            }
          >
        | undefined;

      return [
        {
          type: 'Employees',
          total: status?.employees?.total ?? 0,
          active: status?.employees?.active ?? 0,
          expiring: status?.employees?.expiring ?? 0,
          expired: status?.employees?.expired ?? 0,
        },
        {
          type: 'Vehicles',
          total: status?.vehicles?.total ?? 0,
          active: status?.vehicles?.active ?? 0,
          expiring: status?.vehicles?.expiring ?? 0,
          expired: status?.vehicles?.expired ?? 0,
        },
        {
          type: 'Equipment',
          total: status?.equipment?.total ?? 0,
          active: status?.equipment?.active ?? 0,
          expiring: status?.equipment?.expiring ?? 0,
          expired: status?.equipment?.expired ?? 0,
        },
      ];
    },
    {
      category: CacheCategory.METRICS,
      keyParts: ['access-control', deptId, 'badge-status'],
      tags: [`dept:${deptId}`, 'table:badges', 'table:personnel', 'table:fleet', 'table:equipment'],
    }
  );
}

/* ------------------------------------------------------------------ */
/*  4. Hourly Access Stats                                             */
/* ------------------------------------------------------------------ */

export async function getHourlyAccessStats(
  deptId: string,
  date?: string
): Promise<HourlyAccessPoint[]> {
  const { supabase } = await assertAccessControlRole();

  const targetDate = date ?? new Date().toISOString().split('T')[0];
  const start = `${targetDate}T00:00:00Z`;
  const end = `${targetDate}T23:59:59Z`;

  const { data: logs } = await supabase
    .from('access_logs')
    .select('scanned_at, access_granted')
    .eq('department_id', deptId)
    .gte('scanned_at', start)
    .lte('scanned_at', end);

  // Aggregate into hourly buckets
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    granted: 0,
    denied: 0,
  }));

  if (!logs) return hours;

  for (const log of logs) {
    const h = new Date(log.scanned_at).getUTCHours();
    if (log.access_granted) {
      hours[h]!.granted++;
    } else {
      hours[h]!.denied++;
    }
  }

  return hours;
}

/* ------------------------------------------------------------------ */
/*  5. Badge Status Distribution                                       */
/* ------------------------------------------------------------------ */

export async function getBadgeStatusDistribution(
  deptId: string
): Promise<BadgeStatusDistribution[]> {
  return withCache(
    async () => {
      const { supabase } = await assertAccessControlRole();

      const { data, error } = await supabase.rpc('get_access_control_metrics_jsonb', {
        p_department_id: deptId,
      });

      let active = 0;
      let expiring_soon = 0;
      let expired = 0;
      let revoked = 0;

      if (error && (error.message?.includes('schema cache') || error.code === 'PGRST202')) {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [
          { count: activeCount },
          { count: expiringCount },
          { count: expiredCount },
          { count: revokedCount },
        ] = await Promise.all([
          supabase
            .from('badges')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', deptId)
            .eq('is_active', true)
            .gt('expires_at', in7Days.toISOString()),
          supabase
            .from('badges')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', deptId)
            .eq('is_active', true)
            .lte('expires_at', in7Days.toISOString())
            .gt('expires_at', now.toISOString()),
          supabase
            .from('badges')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', deptId)
            .eq('is_active', true)
            .lt('expires_at', now.toISOString()),
          supabase
            .from('badges')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', deptId)
            .eq('is_active', false),
        ]);

        active = activeCount || 0;
        expiring_soon = expiringCount || 0;
        expired = expiredCount || 0;
        revoked = revokedCount || 0;
      } else if (error) {
        logError(
          new DatabaseError(
            'Failed to load badge status distribution via RPC, returning default distribution',
            {
              context: { error: error.message },
            }
          )
        );
        active = 0;
        expiring_soon = 0;
        expired = 0;
        revoked = 0;
      } else {
        const dist = (data as Record<string, unknown>)?.badge_status_distribution as
          | Record<string, number>
          | undefined;
        active = dist?.active ?? 0;
        expiring_soon = dist?.expiring_soon ?? 0;
        expired = dist?.expired ?? 0;
        revoked = dist?.revoked ?? 0;
      }

      return [
        { name: 'Active', value: active, fill: 'var(--success)' },
        { name: 'Expiring Soon', value: expiring_soon, fill: 'var(--warning)' },
        { name: 'Expired', value: expired, fill: 'var(--danger)' },
        { name: 'Revoked', value: revoked, fill: 'var(--muted-foreground)' },
      ];
    },
    {
      category: CacheCategory.METRICS,
      keyParts: ['access-control', deptId, 'distribution'],
      tags: [`dept:${deptId}`, 'table:badges'],
    }
  );
}
