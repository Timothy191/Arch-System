'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { revalidatePath, revalidateTag } from 'next/cache';
import { DatabaseError, ValidationError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { assertAccessControlRole } from './shared';

export async function getBadgesForDepartment(deptId: string, page = 1, pageSize = 50) {
  const { supabase } = await assertAccessControlRole();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: badges,
    count,
    error,
  } = await supabase
    .from('badges')
    .select(
      `
      id,
      qr_code,
      entity_type,
      is_active,
      issued_at,
      expires_at,
      personnel:personnel_id(first_name, surname),
      visitor:visitor_id(first_name, surname),
      fleet:fleet_id(fleet_code, vehicle_type),
      equipment:equipment_id(equip_code, equipment_type)
    `,
      { count: 'exact' }
    )
    .eq('department_id', deptId)
    .order('issued_at', { ascending: false })
    .range(from, to);

  if (error) {
    const fallback = await supabase
      .from('badges')
      .select(
        `
        id,
        qr_code,
        entity_type,
        is_active,
        issued_at,
        personnel:personnel_id(first_name, surname),
        visitor:visitor_id(name)
      `,
        { count: 'exact' }
      )
      .order('issued_at', { ascending: false })
      .range(from, to);

    if (fallback.error) {
      throw new DatabaseError('Failed to load badges', {
        operation: 'select',
        context: { error: fallback.error.message },
      });
    }

    const mappedBadges = (fallback.data ?? []).map((b) => {
      const v = b.visitor as unknown as { name?: string } | null;
      const [firstName = '', ...rest] = (v?.name ?? '').split(' ');
      return {
        ...b,
        expires_at: null,
        visitor: v ? { first_name: firstName, surname: rest.join(' ') } : null,
        fleet: null,
        equipment: null,
      };
    });

    return { badges: mappedBadges, totalCount: fallback.count ?? 0 };
  }

  return { badges: badges ?? [], totalCount: count ?? 0 };
}

export async function getVisitorsForDepartment(deptId: string, page = 1, pageSize = 50) {
  const { supabase } = await assertAccessControlRole();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: visitors,
    count,
    error,
  } = await supabase
    .from('visitors')
    .select(
      `
      id,
      first_name,
      surname,
      id_number,
      company,
      visiting,
      reason_for_entry,
      check_in_time,
      check_out_time,
      status
    `,
      { count: 'exact' }
    )
    .eq('department_id', deptId)
    .order('check_in_time', { ascending: false })
    .range(from, to);

  if (error) {
    const fallback = await supabase
      .from('visitors')
      .select(
        `
        id,
        name,
        company,
        purpose,
        check_in_time,
        check_out_time,
        status
      `,
        { count: 'exact' }
      )
      .order('check_in_time', { ascending: false })
      .range(from, to);

    if (fallback.error) {
      throw new DatabaseError('Failed to load visitors', {
        operation: 'select',
        context: { error: fallback.error.message },
      });
    }

    const mappedVisitors = (fallback.data ?? []).map((v) => {
      const [firstName = '', ...rest] = (v.name ?? '').split(' ');
      return {
        id: v.id,
        first_name: firstName,
        surname: rest.join(' '),
        id_number: null,
        company: v.company,
        visiting: null,
        reason_for_entry: v.purpose,
        check_in_time: v.check_in_time,
        check_out_time: v.check_out_time,
        status: v.status,
      };
    });

    return { visitors: mappedVisitors, totalCount: fallback.count ?? 0 };
  }

  return { visitors: visitors ?? [], totalCount: count ?? 0 };
}

export async function registerVisitor(formData: FormData) {
  const { supabase, employee } = await assertAccessControlRole();

  const firstName = formData.get('first_name') as string;
  const surname = formData.get('surname') as string;
  const company = formData.get('company') as string;
  const reason = formData.get('reason') as string;

  const { data: visitor, error } = await supabase
    .from('visitors')
    .insert({
      first_name: firstName,
      surname,
      company,
      reason_for_entry: reason,
      department_id: employee.department_id,
      status: 'Checked In',
      check_in_time: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new DatabaseError('Failed to register visitor', {
      operation: 'insert',
      context: { error: error.message },
    });
  }

  // Also issue a temporary badge
  const qrCode = `TEMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const { error: badgeError } = await supabase.from('badges').insert({
    qr_code: qrCode,
    entity_type: 'Visitor',
    visitor_id: visitor.id,
    department_id: employee.department_id,
    is_active: true,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
  });

  if (badgeError) {
    logError(
      new DatabaseError('Failed to issue temporary badge for registered visitor', {
        context: { error: badgeError.message, visitorId: visitor.id },
      })
    );
  }

  revalidatePath('/access-control/visitors');
  return { success: true };
}

export interface AccessLogFilterOptions {
  readonly employeeId?: string | null;
  readonly searchQuery?: string | null;
  readonly direction?: 'IN' | 'OUT' | 'ALL' | null;
  readonly statusFilter?: 'GRANTED' | 'DENIED' | 'ALL' | null;
  readonly dateRange?: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | null;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface EmployeeAttendanceSummary {
  readonly employee: {
    readonly id: string;
    readonly name: string;
    readonly empCode: string;
    readonly jobTitle: string;
  };
  readonly totalScans: number;
  readonly todayScansCount: number;
  readonly firstInToday: string | null;
  readonly lastOutToday: string | null;
  readonly currentPresence: 'ON_SITE' | 'OFF_SITE' | 'UNKNOWN';
  readonly lastGateLocation: string | null;
  readonly totalHoursToday: string;
  readonly complianceRate: number;
}

export async function getAccessLogsWithFilters(options: AccessLogFilterOptions = {}) {
  const { supabase } = await assertAccessControlRole();

  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('access_logs').select(
    `
      id,
      scanned_at,
      gate_location,
      access_granted,
      denial_reason,
      access_type,
      direction,
      alcohol_tested,
      operator,
      device_id,
      badge:badges(
        id,
        qr_code,
        rfid_code,
        entity_type,
        personnel:personnel_id(id, first_name, surname, emp_code, job_title),
        visitor:visitor_id(id, first_name, surname, company),
        fleet:fleet_id(fleet_code, registration_number)
      )
    `,
    { count: 'exact' }
  );

  if (options.employeeId) {
    const { data: employeeBadges } = await supabase
      .from('badges')
      .select('id')
      .eq('personnel_id', options.employeeId);

    const badgeIds = (employeeBadges ?? []).map((b) => b.id);
    if (badgeIds.length === 0) {
      return { logs: [], totalCount: 0 };
    }
    query = query.in('badge_id', badgeIds);
  }

  if (options.direction && options.direction !== 'ALL') {
    query = query.eq('direction', options.direction);
  }

  if (options.statusFilter && options.statusFilter !== 'ALL') {
    query = query.eq('access_granted', options.statusFilter === 'GRANTED');
  }

  if (options.dateRange === 'TODAY') {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    query = query.gte('scanned_at', todayMidnight.toISOString());
  } else if (options.dateRange === 'WEEK') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    query = query.gte('scanned_at', weekAgo.toISOString());
  } else if (options.dateRange === 'MONTH') {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    query = query.gte('scanned_at', monthAgo.toISOString());
  }

  query = query.order('scanned_at', { ascending: false }).range(from, to);

  const { data: logs, count, error } = await query;

  if (error) {
    throw new DatabaseError('Failed to load access logs with filters', {
      operation: 'select',
      context: { error: error.message },
    });
  }

  interface AccessLogFilterQueryRow {
    readonly id: string;
    readonly scanned_at: string;
    readonly gate_location: string | null;
    readonly access_granted: boolean;
    readonly denial_reason: string | null;
    readonly access_type: string | null;
    readonly direction: string;
    readonly alcohol_tested?: string | null;
    readonly operator?: string | null;
    readonly device_id?: string | null;
    readonly badge?: {
      readonly id: string;
      readonly qr_code: string | null;
      readonly rfid_code: string | null;
      readonly entity_type: string;
      readonly personnel?: {
        readonly id: string;
        readonly first_name: string;
        readonly surname: string;
        readonly emp_code: string | null;
        readonly job_title: string | null;
      } | null;
      readonly visitor?: {
        readonly id: string;
        readonly first_name: string;
        readonly surname: string;
        readonly company: string | null;
      } | null;
      readonly fleet?: {
        readonly fleet_code: string;
        readonly registration_number: string | null;
      } | null;
    } | null;
  }

  const rawLogs = (logs ?? []) as unknown as AccessLogFilterQueryRow[];

  let filteredLogs = rawLogs;
  if (options.searchQuery && options.searchQuery.trim().length > 0) {
    const term = options.searchQuery.toLowerCase().trim();
    filteredLogs = rawLogs.filter((log) => {
      const b = log.badge;
      const personName = b?.personnel
        ? `${b.personnel.first_name} ${b.personnel.surname}`.toLowerCase()
        : '';
      const empCode = b?.personnel?.emp_code?.toLowerCase() ?? '';
      const visitorName = b?.visitor
        ? `${b.visitor.first_name} ${b.visitor.surname}`.toLowerCase()
        : '';
      const gate = (log.gate_location ?? '').toLowerCase();
      const qr = (b?.qr_code ?? '').toLowerCase();
      const rfid = (b?.rfid_code ?? '').toLowerCase();
      return (
        personName.includes(term) ||
        empCode.includes(term) ||
        visitorName.includes(term) ||
        gate.includes(term) ||
        qr.includes(term) ||
        rfid.includes(term)
      );
    });
  }

  return { logs: filteredLogs, totalCount: count ?? filteredLogs.length };
}

export async function getAccessLogsForDepartment(_deptId?: string, page = 1, pageSize = 50) {
  return getAccessLogsWithFilters({ page, pageSize });
}

export async function getPersonnelListForFilter(): Promise<
  Array<{ id: string; name: string; empCode: string; jobTitle: string }>
> {
  const { supabase } = await assertAccessControlRole();
  const { data, error } = await supabase
    .from('personnel')
    .select('id, first_name, surname, emp_code, job_title')
    .order('surname', { ascending: true });

  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.surname}`,
    empCode: p.emp_code || 'N/A',
    jobTitle: p.job_title || 'Employee',
  }));
}

export async function getEmployeeAttendanceSummary(
  personnelId: string
): Promise<EmployeeAttendanceSummary | null> {
  const { supabase } = await assertAccessControlRole();

  const { data: person } = await supabase
    .from('personnel')
    .select('id, first_name, surname, emp_code, job_title')
    .eq('id', personnelId)
    .single();

  if (!person) return null;

  const { data: employeeBadges } = await supabase
    .from('badges')
    .select('id')
    .eq('personnel_id', personnelId);

  const badgeIds = (employeeBadges ?? []).map((b) => b.id);
  if (badgeIds.length === 0) {
    return {
      employee: {
        id: person.id,
        name: `${person.first_name} ${person.surname}`,
        empCode: person.emp_code || 'N/A',
        jobTitle: person.job_title || 'Employee',
      },
      totalScans: 0,
      todayScansCount: 0,
      firstInToday: null,
      lastOutToday: null,
      currentPresence: 'UNKNOWN',
      lastGateLocation: null,
      totalHoursToday: '0h 0m',
      complianceRate: 100,
    };
  }

  const { data: allLogs } = await supabase
    .from('access_logs')
    .select('id, scanned_at, direction, access_granted, gate_location')
    .in('badge_id', badgeIds)
    .order('scanned_at', { ascending: true });

  const logs = allLogs ?? [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayLogs = logs.filter((l) => new Date(l.scanned_at) >= todayStart);
  const todayInScans = todayLogs.filter((l) => l.direction === 'IN' && l.access_granted);
  const todayOutScans = todayLogs.filter((l) => l.direction === 'OUT' && l.access_granted);

  const firstInToday = todayInScans[0]?.scanned_at ?? null;
  const lastOutToday = todayOutScans[todayOutScans.length - 1]?.scanned_at ?? null;

  const latestScan = logs[logs.length - 1];
  const currentPresence: 'ON_SITE' | 'OFF_SITE' | 'UNKNOWN' = latestScan
    ? latestScan.direction === 'IN' && latestScan.access_granted
      ? 'ON_SITE'
      : 'OFF_SITE'
    : 'OFF_SITE';

  let totalHoursFormatted = '0h 0m';
  if (firstInToday) {
    const endTime = lastOutToday ? new Date(lastOutToday).getTime() : Date.now();
    const diffMs = Math.max(0, endTime - new Date(firstInToday).getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    totalHoursFormatted = `${hours}h ${minutes}m`;
  }

  const grantedCount = logs.filter((l) => l.access_granted).length;
  const complianceRate = logs.length > 0 ? Math.round((grantedCount / logs.length) * 100) : 100;

  return {
    employee: {
      id: person.id,
      name: `${person.first_name} ${person.surname}`,
      empCode: person.emp_code || 'N/A',
      jobTitle: person.job_title || 'Employee',
    },
    totalScans: logs.length,
    todayScansCount: todayLogs.length,
    firstInToday,
    lastOutToday,
    currentPresence,
    lastGateLocation: latestScan?.gate_location ?? null,
    totalHoursToday: totalHoursFormatted,
    complianceRate,
  };
}

export async function executeEasyScan(input: {
  readonly code: string;
  readonly direction?: 'IN' | 'OUT';
  readonly gateLocation?: string;
  readonly scannerId?: string;
}) {
  await assertAccessControlRole({ requireWrite: true });
  const rawCode = (input.code ?? '').trim();
  if (!rawCode) {
    throw new ValidationError('Badge or RFID code cannot be empty');
  }

  const supabase = createServiceRoleClient();
  const direction = input.direction ?? 'IN';
  const gateLocation = input.gateLocation ?? 'Main Gate North Turnstile';
  const scannerId = input.scannerId ?? 'PORTAL-EASY-SCANNER';

  const { data: badge } = await supabase
    .from('badges')
    .select(
      'id, is_active, entity_type, personnel_id, visitor_id, fleet_id, expires_at, department_id'
    )
    .or(`qr_code.eq.${rawCode},rfid_code.eq.${rawCode}`)
    .maybeSingle();

  if (!badge) {
    await supabase.from('access_logs').insert([
      {
        badge_id: null,
        access_type: 'UNKNOWN',
        direction,
        gate_location: gateLocation,
        access_granted: false,
        denial_reason: 'DENIED - Unrecognized Badge / RFID',
        department_id: null,
        alcohol_tested: 'Approved',
        operator: 'Easy Scanner Web',
        device_id: scannerId,
        scanned_at: new Date().toISOString(),
      },
    ]);

    revalidateTag('access-control', 'max');
    revalidatePath('/access-control/access-logs');
    return {
      success: false,
      accessGranted: false,
      name: 'Unrecognized Badge / RFID',
      entityType: 'UNKNOWN',
      message: 'DENIED - Unrecognized Badge / RFID',
      denialReason: 'DENIED - Unrecognized Badge / RFID',
      scannedAt: new Date().toISOString(),
      gateLocation,
      direction,
    };
  }

  if (!badge.is_active) {
    await supabase.from('access_logs').insert([
      {
        badge_id: badge.id,
        access_type: badge.entity_type,
        direction,
        gate_location: gateLocation,
        access_granted: false,
        denial_reason: 'DENIED - Badge Revoked',
        department_id: badge.department_id,
        alcohol_tested: 'Approved',
        operator: 'Easy Scanner Web',
        device_id: scannerId,
        scanned_at: new Date().toISOString(),
      },
    ]);

    revalidateTag('access-control', 'max');
    revalidatePath('/access-control/access-logs');
    return {
      success: false,
      accessGranted: false,
      name: 'Revoked Badge',
      entityType: badge.entity_type,
      message: 'DENIED - Badge Revoked',
      denialReason: 'DENIED - Badge Revoked',
      scannedAt: new Date().toISOString(),
      gateLocation,
      direction,
    };
  }

  if (badge.expires_at && new Date(badge.expires_at) < new Date()) {
    await supabase.from('access_logs').insert([
      {
        badge_id: badge.id,
        access_type: badge.entity_type,
        direction,
        gate_location: gateLocation,
        access_granted: false,
        denial_reason: 'DENIED - Credential Expired',
        department_id: badge.department_id,
        alcohol_tested: 'Approved',
        operator: 'Easy Scanner Web',
        device_id: scannerId,
        scanned_at: new Date().toISOString(),
      },
    ]);

    revalidateTag('access-control', 'max');
    revalidatePath('/access-control/access-logs');
    return {
      success: false,
      accessGranted: false,
      name: 'Expired Credential',
      entityType: badge.entity_type,
      message: 'DENIED - Credential Expired',
      denialReason: 'DENIED - Credential Expired',
      scannedAt: new Date().toISOString(),
      gateLocation,
      direction,
    };
  }

  let entityName = 'Authorized Personnel';
  let empCode = '';
  let jobTitle = '';
  let isAccessGranted = true;
  let denialReason: string | null = null;

  if (badge.entity_type === 'personnel' && badge.personnel_id) {
    const { data: person } = await supabase
      .from('personnel')
      .select('first_name, surname, emp_code, job_title, status, induction_expiry, medical_expiry')
      .eq('id', badge.personnel_id)
      .single();

    if (person) {
      entityName = `${person.first_name} ${person.surname}`;
      empCode = person.emp_code || '';
      jobTitle = person.job_title || '';

      if (person.status !== 'Active') {
        isAccessGranted = false;
        denialReason = `DENIED - Status: ${person.status}`;
      } else if (person.induction_expiry && new Date(person.induction_expiry) < new Date()) {
        isAccessGranted = false;
        denialReason = 'DENIED - Induction Expired';
      } else if (person.medical_expiry && new Date(person.medical_expiry) < new Date()) {
        isAccessGranted = false;
        denialReason = 'DENIED - Medical Clearance Expired';
      }
    }
  } else if (badge.entity_type === 'visitor' && badge.visitor_id) {
    const { data: visitor } = await supabase
      .from('visitors')
      .select('first_name, surname, company, status')
      .eq('id', badge.visitor_id)
      .single();

    if (visitor) {
      entityName = `${visitor.first_name} ${visitor.surname} (${visitor.company || 'Visitor'})`;
      jobTitle = 'Visitor';
      if (visitor.status !== 'Checked In') {
        isAccessGranted = false;
        denialReason = `DENIED - Visitor Status: ${visitor.status}`;
      }
    }
  } else if (badge.fleet_id) {
    const { data: fleet } = await supabase
      .from('fleet')
      .select('fleet_code, registration_number, vehicle_type, status')
      .eq('id', badge.fleet_id)
      .single();

    if (fleet) {
      entityName = `${fleet.vehicle_type || 'Vehicle'}: ${fleet.fleet_code} [${fleet.registration_number || ''}]`;
      jobTitle = fleet.fleet_code;
      if (fleet.status !== 'Active') {
        isAccessGranted = false;
        denialReason = `DENIED - Fleet Status: ${fleet.status}`;
      }
    }
  }

  await supabase.from('access_logs').insert([
    {
      badge_id: badge.id,
      access_type: badge.entity_type,
      direction,
      gate_location: gateLocation,
      access_granted: isAccessGranted,
      denial_reason: isAccessGranted ? null : denialReason,
      department_id: badge.department_id,
      alcohol_tested: 'Approved',
      operator: 'Easy Scanner Web',
      device_id: scannerId,
      scanned_at: new Date().toISOString(),
    },
  ]);

  revalidateTag('access-control', 'max');
  revalidatePath('/access-control/access-logs');
  return {
    success: true,
    accessGranted: isAccessGranted,
    name: entityName,
    empCode,
    jobTitle,
    entityType: badge.entity_type,
    message: isAccessGranted ? `Access Granted - ${gateLocation}` : (denialReason ?? 'Denied'),
    denialReason: isAccessGranted ? null : denialReason,
    scannedAt: new Date().toISOString(),
    gateLocation,
    direction,
  };
}
