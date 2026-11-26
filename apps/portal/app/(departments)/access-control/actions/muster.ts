'use server';

import { musterStatusSchema } from '@repo/contract';
import { logger } from '@repo/logger/server';
import { cacheInvalidateTags } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import { DatabaseError, ValidationError } from '@/lib/errors/error-classes';
import { CANONICAL_MUSTER_STATIONS } from './constants';
import { assertAccessControlRole } from './shared';

const MUSTER_PERSONNEL_LIMIT = 500;
const MUSTER_VISITORS_LIMIT = 200;
const MUSTER_RECENT_LOGS_LIMIT = 500;
const MUSTER_EVENTS_LIMIT = 500;

interface MusterEventRow {
  readonly personnel_id: string | null;
  readonly visitor_id?: string | null;
  readonly badge_code: string | null;
  readonly muster_point: string | null;
  readonly status: string;
  readonly recorded_at: string | null;
}

async function fetchRecentMusterEvents(
  supabase: Awaited<ReturnType<typeof assertAccessControlRole>>['supabase']
): Promise<readonly MusterEventRow[]> {
  const { data, error } = await supabase
    .from('muster_events')
    .select('personnel_id, visitor_id, badge_code, muster_point, status, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(MUSTER_EVENTS_LIMIT);

  if (error) {
    // Graceful fallback if visitor_id column is not yet present on an un-migrated DB
    const legacy = await supabase
      .from('muster_events')
      .select('personnel_id, badge_code, muster_point, status, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(MUSTER_EVENTS_LIMIT);
    if (legacy.error) {
      throw new DatabaseError('Failed to load emergency muster events', {
        operation: 'select',
        table: 'muster_events',
        context: { error: legacy.error.message },
      });
    }
    return (legacy.data ?? []) as MusterEventRow[];
  }

  return (data ?? []) as MusterEventRow[];
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export interface MusterPersonnelRecord {
  id: string;
  entityType: 'personnel' | 'visitor';
  name: string;
  company: string;
  roleOrPurpose: string;
  assignedZone: string;
  lastSeenTime: string;
  lastSeenGate: string;
  status: 'accounted' | 'unaccounted' | 'evacuated' | 'hospitalized';
  station: string | null;
  checkedOffAt: string | null;
  inductionValid: boolean;
  medicalValid: boolean;
}

export interface MusterSummary {
  totalSoulsOnSite: number;
  accountedCount: number;
  unaccountedCount: number;
  evacuatedCount: number;
  blastStatus: 'ALL_CLEAR' | 'STANDBY_BLAST_SCHEDULED' | 'MUSTER_EVACUATION_ACTIVE';
  musterStations: {
    id: string;
    name: string;
    location: string;
    count: number;
    targetZone: string;
  }[];
  records: MusterPersonnelRecord[];
}

export async function getMusterRollCall(deptId: string): Promise<MusterSummary> {
  const { supabase } = await assertAccessControlRole();

  const [personnelRes, visitorsRes, logsRes, musterEvents] = await Promise.all([
    supabase
      .from('personnel')
      .select(
        'id, department_id, first_name, surname, emp_code, job_title, induction_expiry, medical_expiry, status'
      )
      .eq('department_id', deptId)
      .eq('status', 'Active')
      .limit(MUSTER_PERSONNEL_LIMIT),
    supabase
      .from('visitors')
      .select('id, first_name, surname, company, reason_for_entry, status, check_in_time')
      .eq('department_id', deptId)
      .eq('status', 'Checked In')
      .limit(MUSTER_VISITORS_LIMIT),
    supabase
      .from('access_logs')
      .select('gate_location, scanned_at, access_granted, direction, badge_id')
      .eq('department_id', deptId)
      .order('scanned_at', { ascending: false })
      .limit(MUSTER_RECENT_LOGS_LIMIT),
    fetchRecentMusterEvents(supabase),
  ]);

  if (personnelRes.error) {
    throw new DatabaseError('Failed to load personnel for muster roll call', {
      operation: 'select',
      table: 'personnel',
      context: { error: personnelRes.error.message },
    });
  }
  if (visitorsRes.error) {
    throw new DatabaseError('Failed to load visitors for muster roll call', {
      operation: 'select',
      table: 'visitors',
      context: { error: visitorsRes.error.message },
    });
  }
  if (logsRes.error) {
    throw new DatabaseError('Failed to load access logs for muster roll call', {
      operation: 'select',
      table: 'access_logs',
      context: { error: logsRes.error.message },
    });
  }

  const persistedMusterMap = new Map<
    string,
    { status: MusterPersonnelRecord['status']; station: string | null; checkedOffAt: string | null }
  >();
  for (const ev of musterEvents) {
    const key = ev.visitor_id || ev.personnel_id || ev.badge_code;
    if (!key || persistedMusterMap.has(key)) continue;
    const mappedStatus: MusterPersonnelRecord['status'] =
      ev.status === 'missing' || ev.status === 'unaccounted'
        ? 'unaccounted'
        : ev.status === 'medical'
          ? 'hospitalized'
          : ev.status === 'evacuated'
            ? 'evacuated'
            : 'accounted';
    persistedMusterMap.set(key, {
      status: mappedStatus,
      station: mappedStatus === 'unaccounted' ? null : (ev.muster_point ?? null),
      checkedOffAt: ev.recorded_at
        ? new Date(ev.recorded_at).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
    });
  }

  const now = new Date();
  const records: MusterPersonnelRecord[] = [];

  const personnelList = personnelRes.data ?? [];
  const visitorsList = visitorsRes.data ?? [];
  const recentLogs = logsRes.data ?? [];

  const lastSeenByEntity = new Map<
    string,
    { lastSeenTime: string; lastSeenGate: string; direction: string }
  >();
  const badgeIdsInLogs = [
    ...new Set(recentLogs.map((l) => l.badge_id).filter(Boolean)),
  ] as string[];

  if (badgeIdsInLogs.length > 0) {
    const { data: badgeRows } = await supabase
      .from('badges')
      .select('id, personnel_id, visitor_id')
      .in('id', badgeIdsInLogs);

    const badgeById = new Map<
      string,
      { id: string; personnel_id: string | null; visitor_id: string | null } | undefined
    >();
    for (const b of badgeRows ?? []) {
      badgeById.set(b.id, b);
    }

    for (const log of recentLogs) {
      if (!log.badge_id) continue;
      const badge = badgeById.get(log.badge_id);
      if (!badge) continue;
      const entityId = badge.personnel_id ?? badge.visitor_id;
      if (!entityId || lastSeenByEntity.has(entityId)) continue;
      lastSeenByEntity.set(entityId, {
        lastSeenTime: formatRelativeTime(log.scanned_at),
        lastSeenGate: log.gate_location,
        direction: String(log.direction ?? 'IN').toUpperCase(),
      });
    }
  }

  const stations = CANONICAL_MUSTER_STATIONS.map((s) => ({
    ...s,
    count: 0,
  }));

  for (const p of personnelList) {
    const lastSeen = lastSeenByEntity.get(p.id);
    // Include personnel who have not explicitly scanned OUT
    if (lastSeen && lastSeen.direction === 'OUT') {
      continue;
    }

    const isInductionValid = p.induction_expiry ? new Date(p.induction_expiry) > now : true;
    const isMedicalValid = p.medical_expiry ? new Date(p.medical_expiry) > now : true;

    const persisted = persistedMusterMap.get(p.id) ?? persistedMusterMap.get(p.emp_code);
    const resolvedStatus: MusterPersonnelRecord['status'] = persisted
      ? persisted.status
      : 'unaccounted';
    const assignedStation =
      resolvedStatus === 'accounted' ? (persisted?.station ?? stations[0]!.name) : null;

    if (resolvedStatus === 'accounted' && assignedStation) {
      const matchedStation = stations.find((st) => st.name === assignedStation) ?? stations[0]!;
      matchedStation.count += 1;
    }

    records.push({
      id: p.id,
      entityType: 'personnel',
      name: `${p.first_name} ${p.surname} (${p.emp_code})`,
      company: 'Plantcor Operations',
      roleOrPurpose: p.job_title ?? 'Mining Technician',
      assignedZone: p.department_id ? 'Assigned Zone' : 'Unassigned',
      lastSeenTime: lastSeen?.lastSeenTime ?? 'No recent scan',
      lastSeenGate: lastSeen?.lastSeenGate ?? '—',
      status: resolvedStatus,
      station: assignedStation,
      checkedOffAt: persisted?.checkedOffAt ?? null,
      inductionValid: isInductionValid,
      medicalValid: isMedicalValid,
    });
  }

  for (const v of visitorsList) {
    const visitorFullName = `${v.first_name} ${v.surname}`;
    const persisted = persistedMusterMap.get(v.id) ?? persistedMusterMap.get(visitorFullName);
    const resolvedStatus: MusterPersonnelRecord['status'] = persisted
      ? persisted.status
      : 'unaccounted';
    const assignedStation =
      resolvedStatus === 'accounted' ? (persisted?.station ?? stations[0]!.name) : null;

    if (resolvedStatus === 'accounted' && assignedStation) {
      const matchedStation = stations.find((st) => st.name === assignedStation) ?? stations[0]!;
      matchedStation.count += 1;
    }

    const lastSeen = lastSeenByEntity.get(v.id);

    records.push({
      id: v.id,
      entityType: 'visitor',
      name: visitorFullName,
      company: v.company ?? 'Contractor / Third Party',
      roleOrPurpose: v.reason_for_entry ?? 'Site Visit',
      assignedZone: 'Administration Complex',
      lastSeenTime: lastSeen?.lastSeenTime ?? 'No recent scan',
      lastSeenGate: lastSeen?.lastSeenGate ?? '—',
      status: resolvedStatus,
      station: assignedStation,
      checkedOffAt: persisted?.checkedOffAt ?? null,
      inductionValid: true,
      medicalValid: true,
    });
  }

  const totalSouls = records.length;
  const accounted = records.filter((r) => r.status === 'accounted').length;
  const evacuated = records.filter((r) => r.status === 'evacuated').length;
  const unaccounted = Math.max(0, totalSouls - accounted - evacuated);

  return {
    totalSoulsOnSite: totalSouls,
    accountedCount: accounted,
    unaccountedCount: unaccounted,
    evacuatedCount: evacuated,
    blastStatus: totalSouls > 0 && unaccounted === 0 ? 'ALL_CLEAR' : 'STANDBY_BLAST_SCHEDULED',
    musterStations: stations,
    records,
  };
}

export async function markPersonnelMusterStatus(payload: {
  entityId: string;
  entityType?: 'personnel' | 'visitor';
  entityName?: string;
  status: 'accounted' | 'unaccounted' | 'evacuated';
  station?: string;
}): Promise<{ success: boolean }> {
  const { supabase, employee, departmentId } = await assertAccessControlRole({
    requireWrite: true,
  });

  const parsed = musterStatusSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid muster status input');
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    parsed.data.entityId
  );
  const isVisitor = parsed.data.entityType === 'visitor';

  const insertPayload: Record<string, unknown> = {
    personnel_id: !isVisitor && isUuid ? parsed.data.entityId : null,
    visitor_id: isVisitor && isUuid ? parsed.data.entityId : null,
    department_id: departmentId,
    badge_code: parsed.data.entityId,
    full_name: parsed.data.entityName ?? parsed.data.entityId,
    muster_point: parsed.data.station ?? CANONICAL_MUSTER_STATIONS[0].name,
    status: parsed.data.status === 'unaccounted' ? 'missing' : parsed.data.status,
    recorded_by: employee.id,
  };

  let { error } = await supabase.from('muster_events').insert(insertPayload);

  if (error && (error.message.includes('visitor_id') || error.message.includes('department_id'))) {
    // Fallback for un-migrated schema missing visitor_id/department_id
    const { visitor_id: _v, department_id: _d, ...legacyPayload } = insertPayload;
    const legacyRes = await supabase.from('muster_events').insert(legacyPayload);
    error = legacyRes.error;
  }

  if (error) {
    throw new DatabaseError('Failed to persist muster status update', {
      operation: 'insert',
      table: 'muster_events',
      context: { error: error.message, entityId: parsed.data.entityId },
    });
  }

  logger.info({
    event: 'muster_status_updated',
    actorId: employee.id,
    entityId: parsed.data.entityId,
    entityType: parsed.data.entityType,
    status: parsed.data.status,
  });

  await cacheInvalidateTags([
    'table:muster_events',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
  revalidatePath('/access-control/muster');
  revalidatePath('/access-control');
  return { success: true };
}
