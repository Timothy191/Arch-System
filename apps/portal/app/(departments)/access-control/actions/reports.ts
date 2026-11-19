'use server';

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

export async function getAccessReportsData(
  deptId: string,
  startDate?: string,
  endDate?: string
): Promise<AccessReportsData> {
  const { supabase } = await assertAccessControlRole();

  let logsQuery = supabase
    .from('access_logs')
    .select('id, scanned_at, gate_location, access_granted, denial_reason, access_type, direction')
    .eq('department_id', deptId)
    .order('scanned_at', { ascending: false })
    .limit(200);

  if (startDate) {
    logsQuery = logsQuery.gte('scanned_at', `${startDate}T00:00:00Z`);
  }
  if (endDate) {
    logsQuery = logsQuery.lte('scanned_at', `${endDate}T23:59:59Z`);
  }

  const [logsRes, badgesRes] = await Promise.all([
    logsQuery,
    supabase
      .from('badges')
      .select('id, is_active, entity_type')
      .eq('department_id', deptId)
      .eq('is_active', true),
  ]);

  const logs = logsRes.data ?? [];
  const totalEvents = logs.length;
  const deniedEvents = logs.filter((l: { access_granted: boolean }) => !l.access_granted).length;
  const grantedEvents = Math.max(0, totalEvents - deniedEvents);
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

  // Gate traffic: group real access logs by gate location
  const gateStats: Record<string, { inbound: number; outbound: number; lastSeen: string }> = {};
  for (const logEntry of logs) {
    let entry = gateStats[logEntry.gate_location];
    if (!entry) {
      entry = { inbound: 0, outbound: 0, lastSeen: logEntry.scanned_at };
      gateStats[logEntry.gate_location] = entry;
    }
    if (logEntry.direction === 'IN') entry.inbound += 1;
    if (logEntry.direction === 'OUT') entry.outbound += 1;
    if (logEntry.scanned_at > entry.lastSeen) {
      entry.lastSeen = logEntry.scanned_at;
    }
  }
  const gateTraffic = Object.entries(gateStats)
    .map(([gateName, stats]) => ({
      gateName,
      inbound: stats.inbound,
      outbound: stats.outbound,
      peakHour: stats.lastSeen,
    }))
    .sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound));

  // Active credentials from real badge data
  const activeCredentials =
    badgesRes.data?.filter((b: { is_active: boolean }) => b.is_active).length ?? 0;

  return {
    summary: {
      totalEvents,
      grantedCount: grantedEvents,
      deniedCount: deniedEvents,
      complianceRate,
      activeCredentials,
      contractorHoursLogged: 0,
    },
    denialTaxonomy:
      denialTaxonomy.length > 0
        ? denialTaxonomy
        : [{ reason: 'No denials recorded', count: 0, percentage: 0 }],
    gateTraffic:
      gateTraffic.length > 0
        ? gateTraffic
        : [{ gateName: 'No traffic recorded', inbound: 0, outbound: 0, peakHour: '—' }],
    recentAudits: logs
      .slice(0, 15)
      .map(
        (l: {
          id: string;
          scanned_at: string;
          gate_location: string;
          direction: string;
          access_granted: boolean;
          access_type: string | null;
          denial_reason: string | null;
        }) => ({
          id: l.id,
          timestamp: new Date(l.scanned_at).toLocaleString('en-US'),
          gate: l.gate_location,
          entityName: l.access_type
            ? `Credential Scan (${l.access_type})`
            : 'Authorized Operator / Truck',
          entityType: l.access_type || 'Personnel',
          action: l.direction === 'IN' ? 'Entry Verification' : 'Exit Clearance',
          granted: l.access_granted,
          reason: l.denial_reason,
        })
      ),
  };
}
