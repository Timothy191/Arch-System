import { Breadcrumb, BreadcrumbItem } from '@repo/ui/components/ui/breadcrumb';
import {
  getAccessLogsWithFilters,
  getEmployeeAttendanceSummary,
  getPersonnelListForFilter,
} from '../actions';
import { AccessLogsClient, type ResolvedAccessLog } from './AccessLogsClient';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

interface AccessLogWithBadgeRelation {
  id: string;
  scanned_at: string;
  gate_location: string;
  access_granted: boolean;
  denial_reason: string | null;
  access_type: string;
  direction: string;
  alcohol_tested?: string | null;
  operator?: string | null;
  device_id?: string | null;
  badge?: {
    id: string;
    qr_code: string;
    rfid_code: string | null;
    entity_type: string;
    personnel?: {
      id: string;
      first_name: string;
      surname: string;
      emp_code: string;
      job_title: string;
    } | null;
    visitor?: { id: string; first_name: string; surname: string; company: string } | null;
    fleet?: { fleet_code: string; registration_number: string } | null;
  } | null;
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
  const params = await searchParams;
  const page = parseInt(params.page || String(DEFAULT_PAGE), 10);
  const pageSize = parseInt(params.pageSize || String(DEFAULT_PAGE_SIZE), 10);
  const employeeId = params.employeeId || null;
  const searchQuery = params.search || null;
  const direction = (params.direction as 'IN' | 'OUT' | 'ALL') || 'ALL';
  const statusFilter = (params.status as 'GRANTED' | 'DENIED' | 'ALL') || 'ALL';
  const dateRange = (params.dateRange as 'TODAY' | 'WEEK' | 'MONTH' | 'ALL') || 'ALL';

  // Fetch personnel list for filtering and initial logs in parallel
  const [personnelList, logsResult, attendanceSummary] = await Promise.all([
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
    employeeId ? getEmployeeAttendanceSummary(employeeId) : Promise.resolve(null),
  ]);

  const rawLogs = (logsResult.logs ?? []) as unknown as AccessLogWithBadgeRelation[];

  const resolvedLogs: ResolvedAccessLog[] = rawLogs.map((log) => {
    const badge = log.badge;
    let entityName = 'Unknown Entity';
    let entityType: string = badge?.entity_type ?? 'Unknown';
    let personnelIdentifier: string | null = null;

    if (badge?.personnel) {
      entityName = `${badge.personnel.first_name} ${badge.personnel.surname}`;
      entityType = 'Employee';
      personnelIdentifier = badge.personnel.id;
    } else if (badge?.visitor) {
      entityName = `${badge.visitor.first_name} ${badge.visitor.surname}`;
      entityType = 'Visitor';
    } else if (badge?.fleet) {
      entityName = `Fleet: ${badge.fleet.fleet_code}`;
      entityType = 'Fleet';
    }

    let status = log.access_granted ? 'Granted' : 'Denied';
    if (!log.access_granted && log.denial_reason) {
      const reasonLower = log.denial_reason.toLowerCase();
      if (reasonLower.includes('expired')) {
        status = 'Expired Credential';
      } else if (reasonLower.includes('tailgate')) {
        status = 'Tailgate Alert';
      }
    }

    return {
      id: log.id,
      timestamp: log.scanned_at,
      entityName,
      entityType,
      personnelId: personnelIdentifier,
      qrCodeId: badge?.qr_code ?? badge?.rfid_code ?? 'N/A',
      zone: log.gate_location,
      accessMethod: log.access_type ?? 'QR Scan',
      status,
      denialReason: log.denial_reason,
      direction: log.direction,
    };
  });

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
      />
    </div>
  );
}
