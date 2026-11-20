import { Breadcrumb, BreadcrumbItem } from '@repo/ui/components/ui/breadcrumb';
import { connection } from 'next/server';
import {
  type AccessLogDateRange,
  type AccessLogFilterQueryRow,
  type AllEmployeesAttendanceRegisterResult,
  type EmployeeAttendanceSummary,
  getAccessLogsWithFilters,
  getAllEmployeesAttendanceRegister,
  getEmployeeAttendanceSummary,
  getPersonnelListForFilter,
  type PersonnelListFilterEntry,
} from '../actions';
import { AccessLogsClient, type ResolvedAccessLog } from './AccessLogsClient';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const VALID_DIRECTIONS = new Set<'IN' | 'OUT' | 'ALL'>(['IN', 'OUT', 'ALL']);
const VALID_STATUS_FILTERS = new Set<'GRANTED' | 'DENIED' | 'ALL'>(['GRANTED', 'DENIED', 'ALL']);
const VALID_DATE_RANGES = new Set<AccessLogDateRange>([
  'TODAY',
  'WEEK',
  'MONTH',
  'QUARTER',
  'YEAR',
  'ALL',
]);

function parsePositiveInt(rawValue: string | undefined, fallback: number, max?: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max !== undefined ? Math.min(parsed, max) : parsed;
}

function resolveStatusLabel(isGranted: boolean, denialReason: string | null): string {
  if (isGranted) return 'Granted';
  if (!denialReason) return 'Denied';
  const reasonLower = denialReason.toLowerCase();
  if (reasonLower.includes('expired')) return 'Expired Credential';
  if (reasonLower.includes('tailgate')) return 'Tailgate Alert';
  return 'Denied';
}

function resolveEntityDetails(logRow: AccessLogFilterQueryRow): {
  readonly entityName: string;
  readonly entityType: string;
  readonly personnelId: string | null;
  readonly idNumber: string | null;
  readonly empCode: string | null;
  readonly jobTitle: string | null;
  readonly company: string | null;
} {
  const badge = logRow.badge;

  if (badge?.personnel) {
    const personnelName = [badge.personnel.first_name, badge.personnel.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      entityName: personnelName || 'Employee',
      entityType: 'Employee',
      personnelId: badge.personnel.id ?? null,
      idNumber: badge.personnel.id_number ?? null,
      empCode: badge.personnel.emp_code ?? null,
      jobTitle: badge.personnel.job_title ?? null,
      company: null,
    };
  }

  if (badge?.visitor) {
    const splitName = [badge.visitor.first_name, badge.visitor.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    const visitorName = splitName || badge.visitor.name?.trim() || 'Visitor';
    return {
      entityName: visitorName,
      entityType: 'Visitor',
      personnelId: null,
      idNumber: badge.visitor.id_number ?? null,
      empCode: null,
      jobTitle: badge.visitor.company ? `Visitor • ${badge.visitor.company}` : 'Visitor',
      company: badge.visitor.company ?? null,
    };
  }

  if (badge?.fleet) {
    return {
      entityName: badge.fleet.fleet_code ? `Fleet: ${badge.fleet.fleet_code}` : 'Fleet Vehicle',
      entityType: 'Fleet',
      personnelId: null,
      idNumber: null,
      empCode: badge.fleet.registration_number ?? null,
      jobTitle: 'Fleet Asset',
      company: null,
    };
  }

  return {
    entityName: logRow.denial_reason?.toLowerCase().includes('unrecognized')
      ? 'Unrecognized Credential'
      : 'Unknown Entity',
    entityType: badge?.entity_type ?? logRow.access_type ?? 'Unknown',
    personnelId: null,
    idNumber: null,
    empCode: null,
    jobTitle: null,
    company: null,
  };
}

function mapAccessLogRowToResolved(logRow: AccessLogFilterQueryRow): ResolvedAccessLog {
  const badge = logRow.badge;
  const entity = resolveEntityDetails(logRow);
  const isGranted = Boolean(logRow.access_granted);
  const denialReason = logRow.denial_reason ?? null;
  const rawDirection = typeof logRow.direction === 'string' ? logRow.direction.trim() : '';

  return {
    id: logRow.id,
    timestamp: logRow.scanned_at ?? null,
    entityName: entity.entityName,
    entityType: entity.entityType,
    personnelId: entity.personnelId,
    idNumber: entity.idNumber,
    empCode: entity.empCode,
    jobTitle: entity.jobTitle,
    company: entity.company,
    qrCodeId: badge?.qr_code ?? badge?.rfid_code ?? 'N/A',
    rfidCode: badge?.rfid_code ?? null,
    zone: logRow.gate_location?.trim() || 'Unknown Gate',
    accessMethod: logRow.access_type?.trim() || 'QR Scan',
    status: resolveStatusLabel(isGranted, denialReason),
    isGranted,
    denialReason,
    direction: rawDirection ? rawDirection.toUpperCase() : 'UNKNOWN',
    alcoholTested: logRow.alcohol_tested?.trim() || 'Not Recorded',
    operator: logRow.operator ?? null,
    deviceId: logRow.device_id ?? null,
  };
}

export default async function AccessLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    employeeId?: string;
    search?: string;
    direction?: string;
    status?: string;
    dateRange?: string;
  }>;
}) {
  await connection();
  const params = await searchParams;
  const page = parsePositiveInt(params.page, DEFAULT_PAGE);
  const pageSize = parsePositiveInt(params.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const employeeId = params.employeeId?.trim() || null;
  const searchQuery = params.search?.trim() || null;

  const rawDirection = params.direction?.toUpperCase() as 'IN' | 'OUT' | 'ALL' | undefined;
  const direction = rawDirection && VALID_DIRECTIONS.has(rawDirection) ? rawDirection : 'ALL';

  const rawStatus = params.status?.toUpperCase() as 'GRANTED' | 'DENIED' | 'ALL' | undefined;
  const statusFilter = rawStatus && VALID_STATUS_FILTERS.has(rawStatus) ? rawStatus : 'ALL';

  const rawDateRange = params.dateRange?.toUpperCase() as AccessLogDateRange | undefined;
  const dateRange: AccessLogDateRange =
    rawDateRange && VALID_DATE_RANGES.has(rawDateRange) ? rawDateRange : 'ALL';

  const warningMessages: string[] = [];

  const [personnelSettled, logsSettled, summarySettled, registerSettled] = await Promise.allSettled(
    [
      getPersonnelListForFilter(),
      getAccessLogsWithFilters({
        employeeId,
        page,
        pageSize,
        searchQuery,
        direction,
        statusFilter,
        dateRange,
      }),
      employeeId ? getEmployeeAttendanceSummary(employeeId, dateRange) : Promise.resolve(null),
      getAllEmployeesAttendanceRegister({
        dateRange: dateRange === 'ALL' ? 'QUARTER' : dateRange,
        search: searchQuery,
      }),
    ]
  );

  const personnelList: PersonnelListFilterEntry[] =
    personnelSettled.status === 'fulfilled' ? personnelSettled.value : [];
  if (personnelSettled.status === 'rejected') {
    warningMessages.push('Personnel filter directory could not be loaded.');
  }

  const logsResult =
    logsSettled.status === 'fulfilled'
      ? logsSettled.value
      : { logs: [], totalCount: 0, queryWarning: 'Access logs temporarily unavailable.' };
  if (logsSettled.status === 'rejected') {
    warningMessages.push('Access logs query recovered with an empty result set.');
  } else if (logsResult.queryWarning) {
    warningMessages.push(logsResult.queryWarning);
  }

  const attendanceSummary: EmployeeAttendanceSummary | null =
    summarySettled.status === 'fulfilled' ? summarySettled.value : null;
  if (summarySettled.status === 'fulfilled' && summarySettled.value?.queryWarning) {
    warningMessages.push(summarySettled.value.queryWarning);
  }

  const initialAttendanceRegister: AllEmployeesAttendanceRegisterResult | null =
    registerSettled.status === 'fulfilled' ? registerSettled.value : null;
  if (registerSettled.status === 'fulfilled' && registerSettled.value?.queryWarning) {
    warningMessages.push(registerSettled.value.queryWarning);
  }

  const rawLogs = (logsResult.logs ?? []) as unknown as AccessLogFilterQueryRow[];
  const resolvedLogs: ResolvedAccessLog[] = rawLogs.map(mapAccessLogRowToResolved);
  const initialQueryWarning =
    warningMessages.length > 0 ? Array.from(new Set(warningMessages)).join(' ') : null;

  return (
    <div className="space-y-6">
      <Breadcrumb type="text">
        <BreadcrumbItem href="/">Departments</BreadcrumbItem>
        <BreadcrumbItem href="/access-control/badges">Access Control</BreadcrumbItem>
        <BreadcrumbItem active>Access Logs & Attendance</BreadcrumbItem>
      </Breadcrumb>

      <AccessLogsClient
        initialLogs={resolvedLogs}
        initialTotalCount={logsResult.totalCount}
        personnelList={personnelList}
        initialEmployeeId={employeeId}
        initialAttendanceSummary={attendanceSummary}
        initialAttendanceRegister={initialAttendanceRegister}
        initialDateRange={dateRange}
        initialQueryWarning={initialQueryWarning}
      />
    </div>
  );
}
