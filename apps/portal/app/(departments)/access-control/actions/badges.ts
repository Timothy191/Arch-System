'use server';

import { randomBytes } from 'node:crypto';
import { visitorPassRequestSchema } from '@repo/contract';
import { logger } from '@repo/logger/server';
import { cacheInvalidateTags } from '@repo/redis';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { revalidatePath, revalidateTag } from 'next/cache';
import { DatabaseError, ValidationError } from '@/lib/errors/error-classes';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';
import { type AccessLogCategory, classifyAccessLogCategory } from './badges-category';
import { assertAccessControlRole, resolveAccessControlDeptId } from './shared';

export type { AccessLogCategory } from './badges-category';

const VISITOR_BADGE_TTL_MS = 8 * 60 * 60 * 1000;
const DENIAL_BLACKLIST_THRESHOLD = 3;
const MAX_BADGE_CODE_LENGTH = 128;

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
    logger.warn(
      { event: 'badges_primary_query_failed', deptId, error: error.message },
      'Falling back to core badge columns'
    );
    const fallback = await supabase
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
        visitor:visitor_id(name)
      `,
        { count: 'exact' }
      )
      .eq('department_id', deptId)
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
        expires_at: (b as { expires_at?: string | null }).expires_at ?? null,
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
    logger.warn(
      { event: 'visitors_primary_query_failed', deptId, error: error.message },
      'Falling back to legacy visitor columns'
    );
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
      .eq('department_id', deptId)
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
  const { supabase, employee } = await assertAccessControlRole({ requireWrite: true });

  const rawFirstName = String(formData.get('first_name') ?? '').trim();
  const rawSurname = String(formData.get('surname') ?? '').trim();
  const rawCompany = String(formData.get('company') ?? '').trim() || 'General Visitor';
  const rawReason = String(formData.get('reason') ?? '').trim() || 'Site Visit';
  const rawVisiting = String(formData.get('visiting') ?? '').trim() || 'Access Control';
  const rawIdNumber = formData.get('id_number') ? String(formData.get('id_number')).trim() : null;

  const parsed = visitorPassRequestSchema.safeParse({
    first_name: rawFirstName,
    surname: rawSurname,
    company: rawCompany,
    visiting: rawVisiting,
    reason_for_entry: rawReason,
    id_number: rawIdNumber,
  });

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'Invalid visitor registration data'
    );
  }

  const targetDeptId =
    (typeof resolveAccessControlDeptId === 'function'
      ? await resolveAccessControlDeptId()
      : null) ?? employee.department_id;

  const { data: visitor, error } = await supabase
    .from('visitors')
    .insert({
      first_name: parsed.data.first_name,
      surname: parsed.data.surname,
      company: parsed.data.company,
      visiting: parsed.data.visiting,
      reason_for_entry: parsed.data.reason_for_entry,
      id_number: parsed.data.id_number,
      department_id: targetDeptId,
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

  // Issue an 8-hour temporary badge using cryptographically random token
  const qrCode = `TEMP-${randomBytes(4).toString('hex').toUpperCase()}`;
  const { error: badgeError } = await supabase.from('badges').insert({
    qr_code: qrCode,
    entity_type: 'visitor',
    visitor_id: visitor.id,
    department_id: targetDeptId,
    is_active: true,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + VISITOR_BADGE_TTL_MS).toISOString(),
  });

  if (badgeError) {
    await supabase.from('visitors').delete().eq('id', visitor.id);
    throw new DatabaseError('Failed to issue temporary badge for registered visitor', {
      operation: 'insert',
      table: 'badges',
      context: { error: badgeError.message, visitorId: visitor.id },
    });
  }

  logger.info({
    event: 'visitor_registered_with_badge',
    actorId: employee.id,
    visitorId: visitor.id,
    departmentId: targetDeptId,
  });

  await cacheInvalidateTags([
    'table:visitors',
    'table:badges',
    ...(targetDeptId ? [`dept:${targetDeptId}`] : []),
  ]);
  revalidatePath('/access-control/visitors');
  revalidatePath('/access-control/badges');
  revalidatePath('/access-control/expired');
  revalidatePath('/access-control');
  return { success: true, qrCode };
}

export type AccessLogDateRange = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL';

export interface AccessLogFilterOptions {
  readonly departmentId?: string | null;
  readonly employeeId?: string | null;
  readonly searchQuery?: string | null;
  readonly direction?: 'IN' | 'OUT' | 'ALL' | null;
  readonly statusFilter?: 'GRANTED' | 'DENIED' | 'ALL' | null;
  readonly dateRange?: AccessLogDateRange | null;
  readonly category?: AccessLogCategory | null;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface AccessLogFilterQueryRow {
  readonly id: string;
  readonly scanned_at: string | null;
  readonly gate_location: string | null;
  readonly access_granted: boolean | null;
  readonly denial_reason: string | null;
  readonly access_type: string | null;
  readonly direction: string | null;
  readonly alcohol_tested?: string | null;
  readonly operator?: string | null;
  readonly device_id?: string | null;
  readonly badge_id?: string | null;
  readonly badge?: {
    readonly id: string;
    readonly qr_code: string | null;
    readonly rfid_code?: string | null;
    readonly entity_type: string | null;
    readonly fleet_id?: string | null;
    readonly personnel?: {
      readonly id: string;
      readonly first_name: string | null;
      readonly surname: string | null;
      readonly emp_code: string | null;
      readonly id_number?: string | null;
      readonly job_title: string | null;
    } | null;
    readonly visitor?: {
      readonly id: string;
      readonly name?: string | null;
      readonly first_name?: string | null;
      readonly surname?: string | null;
      readonly id_number?: string | null;
      readonly company: string | null;
    } | null;
    readonly fleet?: {
      readonly fleet_code: string;
      readonly registration_number: string | null;
      readonly vehicle_type?: string | null;
    } | null;
  } | null;
}

export interface AccessLogsQueryResult {
  readonly logs: readonly AccessLogFilterQueryRow[];
  readonly totalCount: number;
  readonly queryWarning?: string | null;
}

export interface PersonnelListFilterEntry {
  readonly id: string;
  readonly name: string;
  readonly empCode: string;
  readonly idNumber: string;
  readonly jobTitle: string;
}

export interface EmployeeDailyAttendanceRecord {
  readonly date: string;
  readonly timeIn: string | null;
  readonly timeOut: string | null;
  readonly direction: string;
  readonly alcoholTested: string;
  readonly status: 'Granted' | 'Denied';
  readonly denialReason: string | null;
  readonly gateLocation: string | null;
  readonly scanCount: number;
}

export interface EmployeeAttendanceSummary {
  readonly employee: {
    readonly id: string;
    readonly name: string;
    readonly empCode: string;
    readonly idNumber: string;
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
  readonly dateRange: AccessLogDateRange;
  readonly daysPresent: number;
  readonly firstTimeIn: string | null;
  readonly lastTimeOut: string | null;
  readonly grantedCount: number;
  readonly deniedCount: number;
  readonly alcoholTestedCount: number;
  readonly alcoholPassCount: number;
  readonly alcoholFailCount: number;
  readonly denialReasons: readonly string[];
  readonly dailyRecords: readonly EmployeeDailyAttendanceRecord[];
  readonly queryWarning?: string | null;
}

export interface EmployeeAttendanceRegisterSummary {
  readonly employeeId: string;
  readonly name: string;
  readonly coyNumber: string;
  readonly idNumber: string;
  readonly jobTitle: string;
  readonly daysPresent: number;
  readonly firstTimeIn: string | null;
  readonly lastTimeOut: string | null;
  readonly totalScans: number;
  readonly grantedCount: number;
  readonly deniedCount: number;
  readonly alcoholTestedCount: number;
  readonly alcoholPassCount: number;
  readonly alcoholFailCount: number;
  readonly denialReasons: readonly string[];
  readonly dailyRecords: readonly EmployeeDailyAttendanceRecord[];
}

export interface AllEmployeesAttendanceRegisterOptions {
  readonly departmentId?: string | null;
  readonly dateRange?: AccessLogDateRange | null;
  readonly search?: string | null;
}

export interface AllEmployeesAttendanceRegisterResult {
  readonly records: readonly EmployeeAttendanceRegisterSummary[];
  readonly totalEmployees: number;
  readonly dateRange: AccessLogDateRange;
  readonly queryWarning?: string | null;
}

const OPERATIONAL_TIMEZONE = 'Africa/Johannesburg';
const DEFAULT_LOGS_PAGE = 1;
const DEFAULT_LOGS_PAGE_SIZE = 50;
const MAX_LOGS_PAGE_SIZE = 100;
const MAX_SEARCH_FETCH_ROWS = 1000;
const ATTENDANCE_PAGE_SIZE = 1000;
const ATTENDANCE_MAX_ROWS = 5000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MINUTES_PER_HOUR = 60;
const PERCENT_SCALE = 100;

const DATE_RANGE_DAYS_MAP: Record<Exclude<AccessLogDateRange, 'TODAY' | 'ALL'>, number> = {
  WEEK: 7,
  MONTH: 30,
  QUARTER: 90,
  YEAR: 365,
};

const ALCOHOL_PASS_VALUES = new Set(['approved', 'pass', 'passed', 'clear', 'negative']);
const ALCOHOL_FAIL_VALUES = new Set(['failed', 'fail', 'positive', 'rejected']);

const ACCESS_LOGS_PRIMARY_SELECT = `
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
  badge_id,
  badge:badges(
    id,
    qr_code,
    rfid_code,
    entity_type,
    fleet_id,
    personnel:personnel_id(id, first_name, surname, emp_code, id_number, job_title),
    visitor:visitor_id(id, name, first_name, surname, id_number, company)
  )
`;

const ACCESS_LOGS_REDUCED_SELECT = `
  id,
  scanned_at,
  gate_location,
  access_granted,
  denial_reason,
  access_type,
  direction,
  badge_id,
  badge:badges(
    id,
    qr_code,
    entity_type,
    personnel:personnel_id(id, first_name, surname, emp_code, id_number, job_title),
    visitor:visitor_id(id, name, company)
  )
`;

const ACCESS_LOGS_CORE_SELECT = `
  id,
  scanned_at,
  gate_location,
  access_granted,
  denial_reason,
  access_type,
  direction,
  badge_id
`;

const ATTENDANCE_LOG_FULL_SELECT =
  'id, badge_id, scanned_at, direction, access_granted, denial_reason, alcohol_tested, gate_location';
const ATTENDANCE_LOG_CORE_SELECT =
  'id, badge_id, scanned_at, direction, access_granted, denial_reason, gate_location';

function logAccessControlWarning(event: string, details: Record<string, unknown>): void {
  try {
    logger.warn({ event, ...details }, `Access control fallback: ${event}`);
  } catch {
    console.warn(`[access-control] ${event}`, details);
  }
}

function getOperationalDateKey(isoTimestamp: string | null | undefined): string | null {
  if (!isoTimestamp) return null;
  const parsedDate = new Date(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.toLocaleDateString('en-CA', { timeZone: OPERATIONAL_TIMEZONE });
}

function resolveDateRangeStartIso(dateRange?: AccessLogDateRange | null): string | null {
  if (!dateRange || dateRange === 'ALL') return null;

  if (dateRange === 'TODAY') {
    const todayYmd = new Date().toLocaleDateString('en-CA', { timeZone: OPERATIONAL_TIMEZONE });
    return new Date(`${todayYmd}T00:00:00+02:00`).toISOString();
  }

  const daysBack = DATE_RANGE_DAYS_MAP[dateRange];
  if (!daysBack) return null;
  return new Date(Date.now() - daysBack * MS_PER_DAY).toISOString();
}

function classifyAlcoholOutcome(
  rawAlcohol: string | null | undefined
): 'PASS' | 'FAIL' | 'PENDING' {
  const normalized = (rawAlcohol ?? '').trim().toLowerCase();
  if (!normalized) return 'PENDING';
  if (ALCOHOL_FAIL_VALUES.has(normalized)) return 'FAIL';
  if (ALCOHOL_PASS_VALUES.has(normalized)) return 'PASS';
  return 'PENDING';
}

function formatPersonFullName(
  firstName: string | null | undefined,
  surname: string | null | undefined,
  fallbackName?: string | null
): string {
  const combined = [firstName, surname].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  return fallbackName?.trim() || 'Employee';
}

const UNREGISTERED_SCANNER_IDS = new Set([
  'LEGACY',
  'PORTAL-EASY-SCANNER',
  'EASY-SCANNER-CONSOLE',
  'SIMULATED',
]);

function isRegisteredScannerDeviceId(deviceId: string | null | undefined): boolean {
  if (deviceId === null || deviceId === undefined || deviceId.trim().length === 0) {
    // Allow manual overrides and unrecognized denials without a physical scanner device_id
    return true;
  }
  const normalized = deviceId.trim().toUpperCase();
  return !UNREGISTERED_SCANNER_IDS.has(normalized);
}

function isRegisteredScannerRow(logRow: AccessLogFilterQueryRow): boolean {
  if (!('device_id' in logRow) || logRow.device_id === undefined) {
    return true;
  }
  return isRegisteredScannerDeviceId(logRow.device_id);
}

interface FilterableAccessLogQuery<TSelf> {
  eq(column: string, criterion: unknown): TSelf;
  in(column: string, criteria: readonly string[]): TSelf;
  gte(column: string, threshold: string): TSelf;
  not?: (column: string, operator: string, value: unknown) => TSelf;
  neq?: (column: string, value: unknown) => TSelf;
}

function applyAccessLogQueryFilters<TQuery extends FilterableAccessLogQuery<TQuery>>(
  initialQuery: TQuery,
  filterState: {
    readonly departmentId?: string | null;
    readonly employeeBadgeIds?: readonly string[] | null;
    readonly direction?: 'IN' | 'OUT' | 'ALL' | null;
    readonly statusFilter?: 'GRANTED' | 'DENIED' | 'ALL' | null;
    readonly startIso?: string | null;
    readonly requireRegisteredScanner?: boolean;
  }
): TQuery {
  let activeQuery = initialQuery;
  if (filterState.departmentId) {
    activeQuery = activeQuery.eq('department_id', filterState.departmentId);
  }
  if (filterState.employeeBadgeIds && filterState.employeeBadgeIds.length > 0) {
    activeQuery = activeQuery.in('badge_id', filterState.employeeBadgeIds);
  }
  if (filterState.direction && filterState.direction !== 'ALL') {
    activeQuery = activeQuery.eq('direction', filterState.direction);
  }
  if (filterState.statusFilter && filterState.statusFilter !== 'ALL') {
    activeQuery = activeQuery.eq('access_granted', filterState.statusFilter === 'GRANTED');
  }
  if (filterState.startIso) {
    activeQuery = activeQuery.gte('scanned_at', filterState.startIso);
  }
  if (filterState.requireRegisteredScanner) {
    if (typeof activeQuery.neq === 'function') {
      for (const excludedId of UNREGISTERED_SCANNER_IDS) {
        activeQuery = activeQuery.neq!('device_id', excludedId);
      }
    }
  }
  return activeQuery;
}

interface FleetRecordLite {
  readonly id: string;
  readonly fleet_code: string;
  readonly registration_number: string | null;
  readonly vehicle_type?: string | null;
}

async function enrichAccessLogRowsWithFleet(
  supabase: Awaited<ReturnType<typeof assertAccessControlRole>>['supabase'],
  rawRows: readonly AccessLogFilterQueryRow[]
): Promise<readonly AccessLogFilterQueryRow[]> {
  const fleetIds = Array.from(
    new Set(
      rawRows
        .map((row) => row.badge?.fleet_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  if (fleetIds.length === 0) {
    return rawRows;
  }

  try {
    const { data: fleetRows, error: fleetError } = await supabase
      .from('fleet')
      .select('id, fleet_code, registration_number, vehicle_type')
      .in('id', fleetIds);

    if (fleetError || !fleetRows) {
      return rawRows;
    }

    const fleetMap = new Map<string, FleetRecordLite>();
    for (const fleetEntry of fleetRows as FleetRecordLite[]) {
      fleetMap.set(fleetEntry.id, fleetEntry);
    }

    return rawRows.map((row) => {
      if (!row.badge?.fleet_id || row.badge.fleet) return row;
      const matchedFleet = fleetMap.get(row.badge.fleet_id);
      if (!matchedFleet) return row;
      return {
        ...row,
        badge: {
          ...row.badge,
          fleet: {
            fleet_code: matchedFleet.fleet_code,
            registration_number: matchedFleet.registration_number,
            vehicle_type: matchedFleet.vehicle_type ?? null,
          },
        },
      };
    });
  } catch {
    return rawRows;
  }
}

function normalizeVisitorInRow(
  visitor: NonNullable<NonNullable<AccessLogFilterQueryRow['badge']>['visitor']>
): NonNullable<NonNullable<AccessLogFilterQueryRow['badge']>['visitor']> {
  if (visitor.first_name || visitor.surname) {
    return visitor;
  }
  const parts = (visitor.name ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    ...visitor,
    first_name: parts[0] ?? null,
    surname: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

function normalizeAccessLogRow(rawRow: AccessLogFilterQueryRow): AccessLogFilterQueryRow {
  const badge = rawRow.badge ?? null;
  if (!badge) {
    return { ...rawRow, badge: null };
  }
  const normalizedVisitor = badge.visitor ? normalizeVisitorInRow(badge.visitor) : null;
  return {
    ...rawRow,
    badge: {
      ...badge,
      visitor: normalizedVisitor,
    },
  };
}

function matchesSearchKeyword(logRow: AccessLogFilterQueryRow, lowerTerm: string): boolean {
  const badge = logRow.badge;
  const personName = badge?.personnel
    ? `${badge.personnel.first_name ?? ''} ${badge.personnel.surname ?? ''}`.toLowerCase()
    : '';
  const empCode = badge?.personnel?.emp_code?.toLowerCase() ?? '';
  const personnelIdNumber = badge?.personnel?.id_number?.toLowerCase() ?? '';
  const jobTitle = badge?.personnel?.job_title?.toLowerCase() ?? '';
  const visitorName = badge?.visitor
    ? `${badge.visitor.first_name ?? ''} ${badge.visitor.surname ?? ''} ${badge.visitor.name ?? ''}`.toLowerCase()
    : '';
  const visitorIdNumber = badge?.visitor?.id_number?.toLowerCase() ?? '';
  const visitorCompany = badge?.visitor?.company?.toLowerCase() ?? '';
  const fleetCode = badge?.fleet?.fleet_code?.toLowerCase() ?? '';
  const gate = (logRow.gate_location ?? '').toLowerCase();
  const qr = (badge?.qr_code ?? '').toLowerCase();
  const rfid = (badge?.rfid_code ?? '').toLowerCase();
  const denialReason = (logRow.denial_reason ?? '').toLowerCase();
  const alcoholStatus = (logRow.alcohol_tested ?? '').toLowerCase();
  const operatorName = (logRow.operator ?? '').toLowerCase();
  const deviceId = (logRow.device_id ?? '').toLowerCase();

  return [
    personName,
    empCode,
    personnelIdNumber,
    jobTitle,
    visitorName,
    visitorIdNumber,
    visitorCompany,
    fleetCode,
    gate,
    qr,
    rfid,
    denialReason,
    alcoholStatus,
    operatorName,
    deviceId,
  ].some((candidate) => candidate.includes(lowerTerm));
}

async function runAccessLogsSelectTier(options: {
  readonly supabase: Awaited<ReturnType<typeof assertAccessControlRole>>['supabase'];
  readonly selectColumns: string;
  readonly filterState: {
    readonly departmentId?: string | null;
    readonly employeeBadgeIds?: readonly string[] | null;
    readonly direction?: 'IN' | 'OUT' | 'ALL' | null;
    readonly statusFilter?: 'GRANTED' | 'DENIED' | 'ALL' | null;
    readonly startIso?: string | null;
    readonly requireRegisteredScanner?: boolean;
  };
  readonly rangeFrom: number;
  readonly rangeTo: number;
}) {
  const baseQuery = options.supabase
    .from('access_logs')
    .select(options.selectColumns, { count: 'exact' });
  const filteredQuery = applyAccessLogQueryFilters(baseQuery, options.filterState);
  return filteredQuery
    .order('scanned_at', { ascending: false })
    .range(options.rangeFrom, options.rangeTo);
}

export async function getAccessLogsWithFilters(
  options: AccessLogFilterOptions = {}
): Promise<AccessLogsQueryResult> {
  const { supabase } = await assertAccessControlRole();

  const rawPage = Number(options.page ?? DEFAULT_LOGS_PAGE);
  const rawPageSize = Number(options.pageSize ?? DEFAULT_LOGS_PAGE_SIZE);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : DEFAULT_LOGS_PAGE;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(Math.floor(rawPageSize), MAX_LOGS_PAGE_SIZE)
      : DEFAULT_LOGS_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const trimmedSearch = options.searchQuery?.trim() ?? '';
  const hasSearchFilter = trimmedSearch.length > 0;
  const activeCategory = options.category && options.category !== 'ALL' ? options.category : null;
  const requiresFullScan = hasSearchFilter || Boolean(activeCategory);
  const queryRangeFrom = requiresFullScan ? 0 : from;
  const queryRangeTo = requiresFullScan ? MAX_SEARCH_FETCH_ROWS - 1 : to;
  const warnings: string[] = [];

  try {
    let employeeBadgeIds: string[] | null = null;
    if (options.employeeId) {
      const { data: employeeBadges, error: badgeLookupError } = await supabase
        .from('badges')
        .select('id')
        .eq('personnel_id', options.employeeId);

      if (badgeLookupError) {
        logAccessControlWarning('getAccessLogsWithFilters.employeeBadges', {
          employeeId: options.employeeId,
          error: badgeLookupError.message,
        });
        warnings.push('Unable to resolve employee badge mapping; showing empty log stream.');
        return { logs: [], totalCount: 0, queryWarning: warnings.join(' ') };
      }

      employeeBadgeIds = (employeeBadges ?? []).map((badgeRow) => badgeRow.id);
      if (employeeBadgeIds.length === 0) {
        return { logs: [], totalCount: 0, queryWarning: null };
      }
    }

    const filterState = {
      departmentId: options.departmentId,
      employeeBadgeIds,
      direction: options.direction,
      statusFilter: options.statusFilter,
      startIso: resolveDateRangeStartIso(options.dateRange),
    };

    const tiers: ReadonlyArray<{
      readonly name: string;
      readonly selectColumns: string;
      readonly warningMessage: string | null;
    }> = [
      {
        name: 'primary',
        selectColumns: ACCESS_LOGS_PRIMARY_SELECT,
        warningMessage: null,
      },
      {
        name: 'reduced',
        selectColumns: ACCESS_LOGS_REDUCED_SELECT,
        warningMessage:
          'Loaded access logs using compatibility columns (extended scanner telemetry columns unavailable).',
      },
      {
        name: 'core',
        selectColumns: ACCESS_LOGS_CORE_SELECT,
        warningMessage:
          'Loaded core access logs without badge metadata due to a schema or relation mismatch.',
      },
    ];

    let resolvedRows: AccessLogFilterQueryRow[] | null = null;
    let resolvedCount: number | null = null;

    for (const tier of tiers) {
      const tierResult = await runAccessLogsSelectTier({
        supabase,
        selectColumns: tier.selectColumns,
        filterState: {
          ...filterState,
          requireRegisteredScanner: tier.name === 'primary',
        },
        rangeFrom: queryRangeFrom,
        rangeTo: queryRangeTo,
      });

      if (!tierResult.error) {
        resolvedRows = (tierResult.data ?? []) as unknown as AccessLogFilterQueryRow[];
        resolvedCount = tierResult.count;
        if (tier.warningMessage) {
          warnings.push(tier.warningMessage);
        }
        break;
      }

      logAccessControlWarning(`getAccessLogsWithFilters.${tier.name}_failed`, {
        error: tierResult.error.message,
        code: tierResult.error.code,
      });
    }

    if (!resolvedRows) {
      warnings.push('Access logs could not be queried cleanly; showing empty fallback stream.');
      return {
        logs: [],
        totalCount: 0,
        queryWarning: warnings.join(' '),
      };
    }

    const enrichedRows = await enrichAccessLogRowsWithFleet(
      supabase,
      resolvedRows.map(normalizeAccessLogRow)
    );
    const scannerVerifiedRows = enrichedRows.filter(isRegisteredScannerRow);

    if (requiresFullScan) {
      const lowerTerm = trimmedSearch.toLowerCase();
      const matchedLogs = scannerVerifiedRows.filter((logRow) => {
        if (activeCategory && classifyAccessLogCategory(logRow) !== activeCategory) {
          return false;
        }
        return !hasSearchFilter || matchesSearchKeyword(logRow, lowerTerm);
      });
      return {
        logs: matchedLogs.slice(from, to + 1),
        totalCount: matchedLogs.length,
        queryWarning: warnings.length > 0 ? warnings.join(' ') : null,
      };
    }

    return {
      logs: scannerVerifiedRows,
      totalCount:
        scannerVerifiedRows.length !== enrichedRows.length
          ? scannerVerifiedRows.length
          : (resolvedCount ?? scannerVerifiedRows.length),
      queryWarning: warnings.length > 0 ? warnings.join(' ') : null,
    };
  } catch (unexpectedError: unknown) {
    logAccessControlWarning('getAccessLogsWithFilters.unexpected_error', {
      error: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
    });
    return {
      logs: [],
      totalCount: 0,
      queryWarning: 'Recovered from an access logs query error; displaying safe fallback view.',
    };
  }
}

export async function getAccessLogsForDepartment(deptId?: string, page = 1, pageSize = 50) {
  return getAccessLogsWithFilters({ departmentId: deptId ?? null, page, pageSize });
}

interface RawPersonnelDirectoryRow {
  readonly id: string;
  readonly first_name: string | null;
  readonly surname: string | null;
  readonly emp_code: string | null;
  readonly id_number?: string | null;
  readonly job_title?: string | null;
}

async function fetchPersonnelDirectory(
  supabase: Awaited<ReturnType<typeof assertAccessControlRole>>['supabase'],
  departmentId?: string | null
): Promise<{
  readonly personnel: readonly RawPersonnelDirectoryRow[];
  readonly warning: string | null;
}> {
  try {
    let primaryQuery = supabase
      .from('personnel')
      .select('id, first_name, surname, emp_code, id_number, job_title')
      .order('surname', { ascending: true })
      .limit(500);
    if (departmentId) {
      primaryQuery = primaryQuery.eq('department_id', departmentId);
    }

    const { data: primaryRows, error: primaryError } = await primaryQuery;
    if (!primaryError && primaryRows) {
      return {
        personnel: primaryRows as RawPersonnelDirectoryRow[],
        warning: null,
      };
    }

    logAccessControlWarning('fetchPersonnelDirectory.primary_failed', {
      error: primaryError?.message ?? 'Unknown personnel query error',
    });

    let fallbackQuery = supabase
      .from('personnel')
      .select('id, first_name, surname, emp_code')
      .order('surname', { ascending: true })
      .limit(500);
    if (departmentId) {
      fallbackQuery = fallbackQuery.eq('department_id', departmentId);
    }

    const { data: fallbackRows, error: fallbackError } = await fallbackQuery;
    if (!fallbackError && fallbackRows) {
      return {
        personnel: fallbackRows as RawPersonnelDirectoryRow[],
        warning: 'Personnel directory loaded with core columns only.',
      };
    }

    logAccessControlWarning('fetchPersonnelDirectory.fallback_failed', {
      error: fallbackError?.message ?? 'Unknown personnel fallback error',
    });
    return {
      personnel: [],
      warning: 'Personnel directory is temporarily unavailable.',
    };
  } catch (unexpectedError: unknown) {
    logAccessControlWarning('fetchPersonnelDirectory.unexpected_error', {
      error: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
    });
    return {
      personnel: [],
      warning: 'Personnel directory recovered from an unexpected query error.',
    };
  }
}

export async function getPersonnelListForFilter(): Promise<PersonnelListFilterEntry[]> {
  const { supabase } = await assertAccessControlRole();
  const { personnel } = await fetchPersonnelDirectory(supabase);

  return personnel.map((personRow) => ({
    id: personRow.id,
    name: formatPersonFullName(personRow.first_name, personRow.surname),
    empCode: personRow.emp_code || 'N/A',
    idNumber: personRow.id_number || 'N/A',
    jobTitle: personRow.job_title || 'Employee',
  }));
}

interface RawAttendanceLogRow {
  readonly id: string;
  readonly badge_id: string | null;
  readonly scanned_at: string | null;
  readonly direction: string | null;
  readonly access_granted: boolean | null;
  readonly denial_reason: string | null;
  readonly alcohol_tested?: string | null;
  readonly gate_location: string | null;
}

async function fetchPaginatedAccessLogs(options: {
  readonly supabase: Awaited<ReturnType<typeof assertAccessControlRole>>['supabase'];
  readonly departmentId?: string | null;
  readonly badgeIds?: readonly string[] | null;
  readonly dateRange?: AccessLogDateRange | null;
}): Promise<{
  readonly rows: readonly RawAttendanceLogRow[];
  readonly warning: string | null;
}> {
  const startIso = resolveDateRangeStartIso(options.dateRange);
  const warnings: string[] = [];
  const collectedRows: RawAttendanceLogRow[] = [];
  let useCoreSelect = false;

  try {
    for (let offset = 0; offset < ATTENDANCE_MAX_ROWS; offset += ATTENDANCE_PAGE_SIZE) {
      const rangeEnd = offset + ATTENDANCE_PAGE_SIZE - 1;
      const selectCols = useCoreSelect ? ATTENDANCE_LOG_CORE_SELECT : ATTENDANCE_LOG_FULL_SELECT;
      const basePageQuery = options.supabase.from('access_logs').select(selectCols);
      const filteredPageQuery = applyAccessLogQueryFilters(basePageQuery, {
        departmentId: options.departmentId,
        employeeBadgeIds: options.badgeIds,
        startIso,
      });

      const primaryPageResult = await filteredPageQuery
        .order('scanned_at', { ascending: false })
        .range(offset, rangeEnd);

      let resolvedPageRows = primaryPageResult.data as unknown as RawAttendanceLogRow[] | null;
      let resolvedPageError = primaryPageResult.error;

      if (resolvedPageError && !useCoreSelect) {
        logAccessControlWarning('fetchPaginatedAccessLogs.full_select_failed', {
          error: resolvedPageError.message,
          offset,
        });
        useCoreSelect = true;
        warnings.push(
          'Alcohol telemetry column unavailable in current schema; attendance loaded using core scan fields.'
        );

        const fallbackBaseQuery = options.supabase
          .from('access_logs')
          .select(ATTENDANCE_LOG_CORE_SELECT);
        const filteredFallbackQuery = applyAccessLogQueryFilters(fallbackBaseQuery, {
          departmentId: options.departmentId,
          employeeBadgeIds: options.badgeIds,
          startIso,
        });

        const fallbackResult = await filteredFallbackQuery
          .order('scanned_at', { ascending: false })
          .range(offset, rangeEnd);
        resolvedPageRows = fallbackResult.data as unknown as RawAttendanceLogRow[] | null;
        resolvedPageError = fallbackResult.error;
      }

      if (resolvedPageError) {
        logAccessControlWarning('fetchPaginatedAccessLogs.page_failed', {
          error: resolvedPageError.message,
          offset,
        });
        warnings.push('Attendance log query encountered an error; returning partial history.');
        break;
      }

      const batch = resolvedPageRows ?? [];
      collectedRows.push(...batch);
      if (batch.length < ATTENDANCE_PAGE_SIZE) {
        break;
      }
    }

    if (collectedRows.length >= ATTENDANCE_MAX_ROWS) {
      warnings.push(
        `Showing the most recent ${ATTENDANCE_MAX_ROWS.toLocaleString('en-US')} scan records for the selected range.`
      );
    }

    collectedRows.sort((leftRow, rightRow) => {
      const leftMs = leftRow.scanned_at ? new Date(leftRow.scanned_at).getTime() : 0;
      const rightMs = rightRow.scanned_at ? new Date(rightRow.scanned_at).getTime() : 0;
      return leftMs - rightMs;
    });

    return {
      rows: collectedRows,
      warning: warnings.length > 0 ? Array.from(new Set(warnings)).join(' ') : null,
    };
  } catch (unexpectedError: unknown) {
    logAccessControlWarning('fetchPaginatedAccessLogs.unexpected_error', {
      error: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
    });
    return {
      rows: collectedRows,
      warning: 'Attendance log retrieval recovered gracefully with partial records.',
    };
  }
}

function buildDailyAttendanceRecords(
  chronologicalLogs: readonly RawAttendanceLogRow[]
): readonly EmployeeDailyAttendanceRecord[] {
  const byDate = new Map<string, RawAttendanceLogRow[]>();
  for (const logEntry of chronologicalLogs) {
    const dateKey = getOperationalDateKey(logEntry.scanned_at) ?? 'Unknown Date';
    const existingGroup = byDate.get(dateKey);
    if (existingGroup) {
      existingGroup.push(logEntry);
    } else {
      byDate.set(dateKey, [logEntry]);
    }
  }

  const dailyRecords: EmployeeDailyAttendanceRecord[] = [];
  for (const [dateKey, dayRows] of byDate.entries()) {
    const grantedInRows = dayRows.filter(
      (row) => row.direction?.toUpperCase() === 'IN' && row.access_granted !== false
    );
    const grantedOutRows = dayRows.filter(
      (row) => row.direction?.toUpperCase() === 'OUT' && row.access_granted !== false
    );
    const hasIn = dayRows.some((row) => row.direction?.toUpperCase() === 'IN');
    const hasOut = dayRows.some((row) => row.direction?.toUpperCase() === 'OUT');
    const latestRow = dayRows[dayRows.length - 1];

    const resolvedDirection =
      hasIn && hasOut ? 'IN / OUT' : latestRow?.direction?.toUpperCase() || 'UNKNOWN';

    const hasGranted = dayRows.some((row) => row.access_granted === true);
    const dayDenialReasons = Array.from(
      new Set(
        dayRows
          .filter((row) => row.access_granted === false)
          .map((row) => row.denial_reason?.trim() || 'Access Denied')
      )
    );

    const hasAlcoholFail = dayRows.some(
      (row) => classifyAlcoholOutcome(row.alcohol_tested) === 'FAIL'
    );
    const hasAlcoholPass = dayRows.some(
      (row) => classifyAlcoholOutcome(row.alcohol_tested) === 'PASS'
    );
    const dayAlcoholStatus = hasAlcoholFail
      ? 'Failed'
      : hasAlcoholPass
        ? (dayRows.find((row) => classifyAlcoholOutcome(row.alcohol_tested) === 'PASS')
            ?.alcohol_tested ?? 'Approved')
        : latestRow?.alcohol_tested?.trim() || 'Not Tested';

    dailyRecords.push({
      date: dateKey,
      timeIn: grantedInRows[0]?.scanned_at ?? null,
      timeOut: grantedOutRows[grantedOutRows.length - 1]?.scanned_at ?? null,
      direction: resolvedDirection,
      alcoholTested: dayAlcoholStatus,
      status: hasGranted ? 'Granted' : 'Denied',
      denialReason: dayDenialReasons.length > 0 ? dayDenialReasons.join('; ') : null,
      gateLocation: latestRow?.gate_location ?? null,
      scanCount: dayRows.length,
    });
  }

  return dailyRecords.sort((leftDay, rightDay) => rightDay.date.localeCompare(leftDay.date));
}

function aggregateEmployeeAttendance(options: {
  readonly person: RawPersonnelDirectoryRow;
  readonly logs: readonly RawAttendanceLogRow[];
}): {
  readonly registerEntry: EmployeeAttendanceRegisterSummary;
  readonly todayScansCount: number;
  readonly firstInToday: string | null;
  readonly lastOutToday: string | null;
  readonly currentPresence: 'ON_SITE' | 'OFF_SITE' | 'UNKNOWN';
  readonly lastGateLocation: string | null;
  readonly totalHoursToday: string;
  readonly complianceRate: number;
} {
  const { person, logs } = options;
  const fullName = formatPersonFullName(person.first_name, person.surname);
  const coyNumber = person.emp_code || 'N/A';
  const idNumber = person.id_number || 'N/A';
  const jobTitle = person.job_title || 'Employee';

  const todayYmd = new Date().toLocaleDateString('en-CA', { timeZone: OPERATIONAL_TIMEZONE });
  const todayLogs = logs.filter((row) => getOperationalDateKey(row.scanned_at) === todayYmd);
  const todayInScans = todayLogs.filter(
    (row) => row.direction?.toUpperCase() === 'IN' && row.access_granted
  );
  const todayOutScans = todayLogs.filter(
    (row) => row.direction?.toUpperCase() === 'OUT' && row.access_granted
  );
  const firstInToday = todayInScans[0]?.scanned_at ?? null;
  const lastOutToday = todayOutScans[todayOutScans.length - 1]?.scanned_at ?? null;

  let totalHoursToday = '0h 0m';
  if (firstInToday) {
    const endTimeMs = lastOutToday ? new Date(lastOutToday).getTime() : Date.now();
    const diffMs = Math.max(0, endTimeMs - new Date(firstInToday).getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * MINUTES_PER_HOUR));
    const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    const minutes = totalMinutes % MINUTES_PER_HOUR;
    totalHoursToday = `${hours}h ${minutes}m`;
  }

  const latestScan = logs[logs.length - 1];
  const currentPresence: 'ON_SITE' | 'OFF_SITE' | 'UNKNOWN' =
    logs.length === 0
      ? 'UNKNOWN'
      : latestScan?.direction?.toUpperCase() === 'IN' && latestScan.access_granted
        ? 'ON_SITE'
        : 'OFF_SITE';

  const grantedLogs = logs.filter((row) => row.access_granted === true);
  const deniedLogs = logs.filter((row) => row.access_granted === false);
  const grantedInLogs = grantedLogs.filter((row) => row.direction?.toUpperCase() === 'IN');
  const grantedOutLogs = grantedLogs.filter((row) => row.direction?.toUpperCase() === 'OUT');

  const presentDates = new Set(
    grantedLogs
      .map((row) => getOperationalDateKey(row.scanned_at))
      .filter((dateKey): dateKey is string => dateKey !== null)
  );

  let alcoholPassCount = 0;
  let alcoholFailCount = 0;
  for (const logEntry of logs) {
    const alcoholOutcome = classifyAlcoholOutcome(logEntry.alcohol_tested);
    if (alcoholOutcome === 'PASS') alcoholPassCount += 1;
    if (alcoholOutcome === 'FAIL') alcoholFailCount += 1;
  }

  const denialReasons = Array.from(
    new Set(
      deniedLogs
        .map((row) => row.denial_reason?.trim())
        .filter((reasonText): reasonText is string => Boolean(reasonText))
    )
  );

  const dailyRecords = buildDailyAttendanceRecords(logs);
  const complianceRate =
    logs.length > 0
      ? Math.round((grantedLogs.length / logs.length) * PERCENT_SCALE)
      : PERCENT_SCALE;

  return {
    registerEntry: {
      employeeId: person.id,
      name: fullName,
      coyNumber,
      idNumber,
      jobTitle,
      daysPresent: presentDates.size,
      firstTimeIn: grantedInLogs[0]?.scanned_at ?? null,
      lastTimeOut: grantedOutLogs[grantedOutLogs.length - 1]?.scanned_at ?? null,
      totalScans: logs.length,
      grantedCount: grantedLogs.length,
      deniedCount: deniedLogs.length,
      alcoholTestedCount: alcoholPassCount + alcoholFailCount,
      alcoholPassCount,
      alcoholFailCount,
      denialReasons,
      dailyRecords,
    },
    todayScansCount: todayLogs.length,
    firstInToday,
    lastOutToday,
    currentPresence,
    lastGateLocation: latestScan?.gate_location ?? null,
    totalHoursToday,
    complianceRate,
  };
}

export async function getEmployeeAttendanceSummary(
  personnelId: string,
  dateRange: AccessLogDateRange = 'ALL'
): Promise<EmployeeAttendanceSummary | null> {
  const { supabase } = await assertAccessControlRole();
  const warnings: string[] = [];

  try {
    const primaryPersonResult = await supabase
      .from('personnel')
      .select('id, first_name, surname, emp_code, id_number, job_title')
      .eq('id', personnelId)
      .single();

    let typedPerson = primaryPersonResult.data as RawPersonnelDirectoryRow | null;
    let personError = primaryPersonResult.error;

    if (personError) {
      logAccessControlWarning('getEmployeeAttendanceSummary.primary_personnel_failed', {
        personnelId,
        error: personError.message,
      });
      const fallbackPerson = await supabase
        .from('personnel')
        .select('id, first_name, surname, emp_code')
        .eq('id', personnelId)
        .single();
      typedPerson = fallbackPerson.data as RawPersonnelDirectoryRow | null;
      personError = fallbackPerson.error;
      if (!personError && typedPerson) {
        warnings.push('Loaded employee attendance profile using core personnel columns.');
      }
    }

    if (personError || !typedPerson) return null;
    const { data: employeeBadges, error: badgesError } = await supabase
      .from('badges')
      .select('id')
      .eq('personnel_id', personnelId);

    if (badgesError) {
      logAccessControlWarning('getEmployeeAttendanceSummary.badges_failed', {
        personnelId,
        error: badgesError.message,
      });
      warnings.push('Badge lookup for attendance summary encountered a warning.');
    }

    const badgeIds = (employeeBadges ?? []).map((badgeRow) => badgeRow.id);
    const { rows: logs, warning: logWarning } =
      badgeIds.length > 0
        ? await fetchPaginatedAccessLogs({ supabase, badgeIds, dateRange })
        : { rows: [] as readonly RawAttendanceLogRow[], warning: null };

    if (logWarning) warnings.push(logWarning);

    const aggregated = aggregateEmployeeAttendance({
      person: typedPerson,
      logs,
    });

    return {
      employee: {
        id: typedPerson.id,
        name: aggregated.registerEntry.name,
        empCode: aggregated.registerEntry.coyNumber,
        idNumber: aggregated.registerEntry.idNumber,
        jobTitle: aggregated.registerEntry.jobTitle,
      },
      totalScans: aggregated.registerEntry.totalScans,
      todayScansCount: aggregated.todayScansCount,
      firstInToday: aggregated.firstInToday,
      lastOutToday: aggregated.lastOutToday,
      currentPresence: aggregated.currentPresence,
      lastGateLocation: aggregated.lastGateLocation,
      totalHoursToday: aggregated.totalHoursToday,
      complianceRate: aggregated.complianceRate,
      dateRange,
      daysPresent: aggregated.registerEntry.daysPresent,
      firstTimeIn: aggregated.registerEntry.firstTimeIn,
      lastTimeOut: aggregated.registerEntry.lastTimeOut,
      grantedCount: aggregated.registerEntry.grantedCount,
      deniedCount: aggregated.registerEntry.deniedCount,
      alcoholTestedCount: aggregated.registerEntry.alcoholTestedCount,
      alcoholPassCount: aggregated.registerEntry.alcoholPassCount,
      alcoholFailCount: aggregated.registerEntry.alcoholFailCount,
      denialReasons: aggregated.registerEntry.denialReasons,
      dailyRecords: aggregated.registerEntry.dailyRecords,
      queryWarning: warnings.length > 0 ? Array.from(new Set(warnings)).join(' ') : null,
    };
  } catch (unexpectedError: unknown) {
    logAccessControlWarning('getEmployeeAttendanceSummary.unexpected_error', {
      personnelId,
      error: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
    });
    return null;
  }
}

export async function getAllEmployeesAttendanceRegister(
  options: AllEmployeesAttendanceRegisterOptions = {}
): Promise<AllEmployeesAttendanceRegisterResult> {
  const { supabase } = await assertAccessControlRole();
  const dateRange: AccessLogDateRange = options.dateRange ?? 'MONTH';
  const warnings: string[] = [];

  try {
    const [{ personnel, warning: personnelWarning }, badgesResult, logsResult] = await Promise.all([
      fetchPersonnelDirectory(supabase, options.departmentId),
      supabase.from('badges').select('id, personnel_id').not('personnel_id', 'is', null),
      fetchPaginatedAccessLogs({
        supabase,
        departmentId: options.departmentId,
        dateRange,
      }),
    ]);

    if (personnelWarning) warnings.push(personnelWarning);
    if (badgesResult.error) {
      logAccessControlWarning('getAllEmployeesAttendanceRegister.badges_failed', {
        error: badgesResult.error.message,
      });
      warnings.push('Badge-to-employee mapping encountered a query warning.');
    }
    if (logsResult.warning) warnings.push(logsResult.warning);

    const badgeToPersonnelId = new Map<string, string>();
    for (const badgeRow of badgesResult.data ?? []) {
      if (badgeRow.id && badgeRow.personnel_id) {
        badgeToPersonnelId.set(badgeRow.id, badgeRow.personnel_id);
      }
    }

    const logsByPersonnelId = new Map<string, RawAttendanceLogRow[]>();
    for (const logRow of logsResult.rows) {
      if (!logRow.badge_id) continue;
      const mappedPersonnelId = badgeToPersonnelId.get(logRow.badge_id);
      if (!mappedPersonnelId) continue;
      const bucket = logsByPersonnelId.get(mappedPersonnelId);
      if (bucket) {
        bucket.push(logRow);
      } else {
        logsByPersonnelId.set(mappedPersonnelId, [logRow]);
      }
    }

    const searchTerm = options.search?.trim().toLowerCase() ?? '';
    const allEntries = personnel
      .map(
        (person) =>
          aggregateEmployeeAttendance({
            person,
            logs: logsByPersonnelId.get(person.id) ?? [],
          }).registerEntry
      )
      .filter((entry) => {
        if (!searchTerm) return true;
        return [
          entry.name.toLowerCase(),
          entry.coyNumber.toLowerCase(),
          entry.idNumber.toLowerCase(),
          entry.jobTitle.toLowerCase(),
          entry.denialReasons.join(' ').toLowerCase(),
        ].some((fieldText) => fieldText.includes(searchTerm));
      })
      .sort((leftEntry, rightEntry) => {
        const leftActive = leftEntry.totalScans > 0 ? 0 : 1;
        const rightActive = rightEntry.totalScans > 0 ? 0 : 1;
        if (leftActive !== rightActive) return leftActive - rightActive;
        if (rightEntry.daysPresent !== leftEntry.daysPresent) {
          return rightEntry.daysPresent - leftEntry.daysPresent;
        }
        return leftEntry.name.localeCompare(rightEntry.name, 'en-US');
      });

    return {
      records: allEntries,
      totalEmployees: allEntries.length,
      dateRange,
      queryWarning: warnings.length > 0 ? Array.from(new Set(warnings)).join(' ') : null,
    };
  } catch (unexpectedError: unknown) {
    logAccessControlWarning('getAllEmployeesAttendanceRegister.unexpected_error', {
      error: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
    });
    return {
      records: [],
      totalEmployees: 0,
      dateRange,
      queryWarning:
        'Recovered from an error while building the employee attendance register; displaying empty fallback.',
    };
  }
}

const BADGE_SELECT_COLUMNS =
  'id, is_active, entity_type, personnel_id, visitor_id, fleet_id, equipment_id, expires_at, department_id';

async function findBadgeByQrOrRfid(
  supabase: ReturnType<typeof createServiceRoleClient>,
  sanitizedCode: string
) {
  const { data: byQr, error: qrErr } = await supabase
    .from('badges')
    .select(BADGE_SELECT_COLUMNS)
    .eq('qr_code', sanitizedCode)
    .maybeSingle();

  if (qrErr) {
    throw new DatabaseError('Failed to look up QR credential', {
      operation: 'select',
      table: 'badges',
      context: { error: qrErr.message },
    });
  }
  if (byQr) return byQr;

  const { data: byRfid, error: rfidErr } = await supabase
    .from('badges')
    .select(BADGE_SELECT_COLUMNS)
    .eq('rfid_code', sanitizedCode)
    .maybeSingle();

  if (rfidErr) {
    throw new DatabaseError('Failed to look up RFID credential', {
      operation: 'select',
      table: 'badges',
      context: { error: rfidErr.message },
    });
  }
  return byRfid;
}

async function enforceRepeatedDenialsPolicy(options: {
  readonly supabase: ReturnType<typeof createServiceRoleClient>;
  readonly badgeId: string;
  readonly departmentId: string | null;
  readonly gateLocation: string;
  readonly denialReason: string;
}): Promise<boolean> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const { count: denialsCount } = await options.supabase
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .eq('badge_id', options.badgeId)
    .eq('access_granted', false)
    .gte('scanned_at', todayUtc.toISOString());

  if (!denialsCount || denialsCount < DENIAL_BLACKLIST_THRESHOLD) {
    return false;
  }

  await options.supabase
    .from('badges')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', options.badgeId);

  await triggerTrackedWorkflow(
    `SOC-ALERT-${options.badgeId}-${Date.now()}`,
    '/webhook/soc-alert-blacklist',
    {
      badgeId: options.badgeId,
      gateId: options.gateLocation,
      reason: options.denialReason,
      count: denialsCount,
      departmentId: options.departmentId,
    }
  );

  return true;
}

async function invalidateScanCaches(departmentId?: string | null) {
  await cacheInvalidateTags([
    'table:access_logs',
    'table:badges',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
  revalidateTag('access-control', 'max');
  revalidatePath('/access-control/access-logs');
  revalidatePath('/access-control');
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
  if (rawCode.length > MAX_BADGE_CODE_LENGTH) {
    throw new ValidationError('Badge or RFID code exceeds maximum allowed length');
  }

  const supabase = createServiceRoleClient();
  const direction = input.direction ?? 'IN';
  const gateLocation = input.gateLocation ?? 'Main Gate North Turnstile';
  const scannerId = input.scannerId ?? 'PORTAL-EASY-SCANNER';

  const badge = await findBadgeByQrOrRfid(supabase, rawCode);

  if (!badge) {
    const { error: logErr } = await supabase.from('access_logs').insert([
      {
        badge_id: null,
        access_type: 'UNKNOWN',
        direction,
        gate_location: gateLocation,
        access_granted: false,
        denial_reason: 'DENIED - Unrecognized Badge / RFID',
        department_id: null,
        alcohol_tested: 'Not Tested',
        operator: 'Easy Scanner Web',
        device_id: scannerId,
        scanned_at: new Date().toISOString(),
      },
    ]);
    if (logErr) {
      throw new DatabaseError('Failed to persist scan audit log', {
        operation: 'insert',
        table: 'access_logs',
        context: { error: logErr.message },
      });
    }

    await invalidateScanCaches(null);
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
        alcohol_tested: 'Not Tested',
        operator: 'Easy Scanner Web',
        device_id: scannerId,
        scanned_at: new Date().toISOString(),
      },
    ]);

    await invalidateScanCaches(badge.department_id);
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
        alcohol_tested: 'Not Tested',
        operator: 'Easy Scanner Web',
        device_id: scannerId,
        scanned_at: new Date().toISOString(),
      },
    ]);

    await enforceRepeatedDenialsPolicy({
      supabase,
      badgeId: badge.id,
      departmentId: badge.department_id,
      gateLocation,
      denialReason: 'DENIED - Credential Expired',
    });
    await invalidateScanCaches(badge.department_id);
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
    const { data: person, error: personErr } = await supabase
      .from('personnel')
      .select('first_name, surname, emp_code, job_title, status, induction_expiry, medical_expiry')
      .eq('id', badge.personnel_id)
      .single();

    if (personErr || !person) {
      isAccessGranted = false;
      denialReason = 'DENIED - Linked Personnel Record Missing';
    } else {
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
    const { data: visitor, error: visitorErr } = await supabase
      .from('visitors')
      .select('first_name, surname, company, status')
      .eq('id', badge.visitor_id)
      .single();

    if (visitorErr || !visitor) {
      isAccessGranted = false;
      denialReason = 'DENIED - Linked Visitor Record Missing';
    } else {
      entityName = `${visitor.first_name} ${visitor.surname} (${visitor.company || 'Visitor'})`;
      jobTitle = 'Visitor';
      if (visitor.status !== 'Checked In') {
        isAccessGranted = false;
        denialReason = `DENIED - Visitor Status: ${visitor.status}`;
      }
    }
  } else if (badge.fleet_id) {
    const { data: fleet, error: fleetErr } = await supabase
      .from('fleet')
      .select('fleet_code, registration_number, vehicle_type, status')
      .eq('id', badge.fleet_id)
      .single();

    if (fleetErr || !fleet) {
      isAccessGranted = false;
      denialReason = 'DENIED - Linked Fleet Record Missing';
    } else {
      entityName = `${fleet.vehicle_type || 'Vehicle'}: ${fleet.fleet_code} [${fleet.registration_number || ''}]`;
      jobTitle = fleet.fleet_code;
      if (fleet.status !== 'Active') {
        isAccessGranted = false;
        denialReason = `DENIED - Fleet Status: ${fleet.status}`;
      }
    }
  } else if (
    badge.entity_type === 'equipment' &&
    (badge as { equipment_id?: string | null }).equipment_id
  ) {
    const { data: equipment, error: equipErr } = await supabase
      .from('equipment')
      .select('equip_code, equipment_type, status, calibration_expiry')
      .eq('id', (badge as { equipment_id: string }).equipment_id)
      .single();

    if (equipErr || !equipment) {
      isAccessGranted = false;
      denialReason = 'DENIED - Linked Equipment Record Missing';
    } else {
      entityName = `Equipment: ${equipment.equip_code} (${equipment.equipment_type})`;
      jobTitle = equipment.equip_code;
      if (equipment.status !== 'Active') {
        isAccessGranted = false;
        denialReason = `DENIED - Equipment Status: ${equipment.status}`;
      } else if (
        equipment.calibration_expiry &&
        new Date(equipment.calibration_expiry) < new Date()
      ) {
        isAccessGranted = false;
        denialReason = 'DENIED - Calibration Expired';
      }
    }
  } else {
    isAccessGranted = false;
    denialReason = 'DENIED - Unrecognized or Unlinked Entity Type';
  }

  const { error: finalLogErr } = await supabase.from('access_logs').insert([
    {
      badge_id: badge.id,
      access_type: badge.entity_type,
      direction,
      gate_location: gateLocation,
      access_granted: isAccessGranted,
      denial_reason: isAccessGranted ? null : denialReason,
      department_id: badge.department_id,
      alcohol_tested: 'Not Tested',
      operator: 'Easy Scanner Web',
      device_id: scannerId,
      scanned_at: new Date().toISOString(),
    },
  ]);

  if (finalLogErr) {
    throw new DatabaseError('Failed to persist scan audit log', {
      operation: 'insert',
      table: 'access_logs',
      context: { error: finalLogErr.message },
    });
  }

  if (!isAccessGranted && denialReason) {
    await enforceRepeatedDenialsPolicy({
      supabase,
      badgeId: badge.id,
      departmentId: badge.department_id,
      gateLocation,
      denialReason,
    });
  }

  await invalidateScanCaches(badge.department_id);
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
