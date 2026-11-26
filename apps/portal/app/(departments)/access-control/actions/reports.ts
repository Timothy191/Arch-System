'use server';

import { DatabaseError } from '@/lib/errors/error-classes';
import { assertAccessControlRole } from './shared';

export interface AccessReportsData {
  summary: {
    totalEvents: number;
    grantedCount: number;
    deniedCount: number;
    complianceRate: number;
    activeCredentials: number;
    contractorHoursLogged: number;
  };
  denialTaxonomy: {
    reason: string;
    count: number;
    percentage: number;
  }[];
  gateTraffic: {
    gateName: string;
    inbound: number;
    outbound: number;
    peakHour: string;
  }[];
  recentAudits: {
    id: string;
    timestamp: string;
    gate: string;
    entityName: string;
    entityType: string;
    action: string;
    granted: boolean;
    reason: string | null;
  }[];
}

interface ReportAuditRow {
  readonly id: string;
  readonly scanned_at: string;
  readonly gate_location: string;
  readonly direction: string;
  readonly access_granted: boolean;
  readonly access_type: string | null;
  readonly denial_reason: string | null;
  readonly badges?: {
    readonly entity_type?: string | null;
    readonly personnel?: { readonly first_name: string; readonly surname: string } | null;
    readonly visitor?: { readonly first_name: string; readonly surname: string } | null;
    readonly fleet?: { readonly fleet_code: string; readonly vehicle_type: string } | null;
  } | null;
}

function resolveAuditEntityName(row: ReportAuditRow): string {
  const b = row.badges;
  if (b?.personnel) {
    return `${b.personnel.first_name} ${b.personnel.surname}`;
  }
  if (b?.visitor) {
    return `${b.visitor.first_name} ${b.visitor.surname}`;
  }
  if (b?.fleet) {
    return `${b.fleet.fleet_code} (${b.fleet.vehicle_type})`;
  }
  return row.access_type ? `Credential Scan (${row.access_type})` : 'Unrecognized Credential';
}

function formatHourBucketSast(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return '—';
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Africa/Johannesburg',
  }).format(parsed);
  return `${hourStr}:00 SAST`;
}

export async function getAccessReportsData(
  deptId: string,
  startDate?: string,
  endDate?: string
): Promise<AccessReportsData> {
  const { supabase } = await assertAccessControlRole();

  const startIso = startDate ? `${startDate}T00:00:00Z` : new Date(0).toISOString();
  const endIso = endDate ? `${endDate}T23:59:59Z` : new Date().toISOString();

  let logsQuery = supabase
    .from('access_logs')
    .select(
      `
      id, scanned_at, gate_location, access_granted, denial_reason, access_type, direction,
      badges(entity_type, personnel:personnel_id(first_name, surname), visitor:visitor_id(first_name, surname), fleet:fleet_id(fleet_code, vehicle_type))
    `
    )
    .eq('department_id', deptId)
    .order('scanned_at', { ascending: false })
    .limit(500);

  if (startDate) {
    logsQuery = logsQuery.gte('scanned_at', startIso);
  }
  if (endDate) {
    logsQuery = logsQuery.lte('scanned_at', endIso);
  }

  const [rpcRes, logsRes, badgesCountRes] = await Promise.all([
    typeof (supabase as { rpc?: unknown }).rpc === 'function'
      ? supabase.rpc('get_access_control_report_summary', {
          p_department_id: deptId,
          p_start: startIso,
          p_end: endIso,
        })
      : Promise.resolve({ data: null, error: null }),
    logsQuery,
    supabase
      .from('badges')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', deptId)
      .eq('is_active', true),
  ]);

  if (logsRes.error) {
    throw new DatabaseError('Failed to load access control report logs', {
      operation: 'select',
      table: 'access_logs',
      context: { error: logsRes.error.message },
    });
  }

  if (badgesCountRes.error) {
    throw new DatabaseError('Failed to load active credential count', {
      operation: 'select',
      table: 'badges',
      context: { error: badgesCountRes.error.message },
    });
  }

  const logs = (logsRes.data ?? []) as unknown as ReportAuditRow[];
  const rpcSummary =
    !rpcRes.error && rpcRes.data && typeof rpcRes.data === 'object'
      ? (rpcRes.data as {
          total_events?: number;
          granted_events?: number;
          denied_events?: number;
          gate_traffic?: Array<{
            gate_location: string;
            entries: number;
            exits: number;
            total_scans: number;
          }>;
        })
      : null;

  const totalEvents = rpcSummary?.total_events ?? logs.length;
  const deniedEvents = rpcSummary?.denied_events ?? logs.filter((l) => !l.access_granted).length;
  const grantedEvents = rpcSummary?.granted_events ?? Math.max(0, totalEvents - deniedEvents);
  const complianceRate = totalEvents > 0 ? Math.round((grantedEvents / totalEvents) * 100) : 0;

  // Denial taxonomy: group real denial reasons from access logs
  const denialCounts: Record<string, number> = {};
  for (const l of logs) {
    if (!l.access_granted && l.denial_reason) {
      denialCounts[l.denial_reason] = (denialCounts[l.denial_reason] ?? 0) + 1;
    }
  }
  const denialTaxonomy = Object.entries(denialCounts)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Peak traffic hour bucket per gate (00:00–23:00 SAST)
  const gateHourBuckets = new Map<string, Map<string, number>>();
  for (const logEntry of logs) {
    const bucket = formatHourBucketSast(logEntry.scanned_at);
    const gateMap = gateHourBuckets.get(logEntry.gate_location) ?? new Map<string, number>();
    gateMap.set(bucket, (gateMap.get(bucket) ?? 0) + 1);
    gateHourBuckets.set(logEntry.gate_location, gateMap);
  }

  const pickPeakHour = (gateName: string): string => {
    const bucketMap = gateHourBuckets.get(gateName);
    if (!bucketMap || bucketMap.size === 0) return '—';
    let bestHour = '—';
    let bestCount = -1;
    for (const [hour, count] of bucketMap.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestHour = hour;
      }
    }
    return bestHour;
  };

  let gateTraffic: AccessReportsData['gateTraffic'];
  if (rpcSummary?.gate_traffic && rpcSummary.gate_traffic.length > 0) {
    gateTraffic = rpcSummary.gate_traffic.map((g) => ({
      gateName: g.gate_location,
      inbound: g.entries ?? 0,
      outbound: g.exits ?? 0,
      peakHour: pickPeakHour(g.gate_location),
    }));
  } else {
    const gateStats: Record<string, { inbound: number; outbound: number }> = {};
    for (const logEntry of logs) {
      let entry = gateStats[logEntry.gate_location];
      if (!entry) {
        entry = { inbound: 0, outbound: 0 };
        gateStats[logEntry.gate_location] = entry;
      }
      if (logEntry.direction === 'IN') entry.inbound += 1;
      if (logEntry.direction === 'OUT') entry.outbound += 1;
    }
    gateTraffic = Object.entries(gateStats)
      .map(([gateName, stats]) => ({
        gateName,
        inbound: stats.inbound,
        outbound: stats.outbound,
        peakHour: pickPeakHour(gateName),
      }))
      .sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound));
  }

  const activeCredentials = badgesCountRes.count ?? 0;

  return {
    summary: {
      totalEvents,
      grantedCount: grantedEvents,
      deniedCount: deniedEvents,
      complianceRate,
      activeCredentials,
      contractorHoursLogged: 0,
    },
    denialTaxonomy,
    gateTraffic,
    recentAudits: logs.slice(0, 15).map((l) => ({
      id: l.id,
      timestamp: new Date(l.scanned_at).toLocaleString('en-US'),
      gate: l.gate_location,
      entityName: resolveAuditEntityName(l),
      entityType: l.access_type || 'Personnel',
      action: l.direction === 'IN' ? 'Entry Verification' : 'Exit Clearance',
      granted: l.access_granted,
      reason: l.denial_reason,
    })),
  };
}
