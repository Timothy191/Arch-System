'use client';

import { AvatarWithIcon } from '@repo/ui/components/ui/avatar-with-icon';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Pagination } from '@repo/ui/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  LogIn,
  LogOut,
  MapPin,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wine,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  executeEasyScan,
  getAccessLogsWithFilters,
  getAllEmployeesAttendanceRegister,
  getEmployeeAttendanceSummary,
} from '../actions';
import type {
  AccessLogCategory,
  AccessLogDateRange,
  AccessLogFilterQueryRow,
  AllEmployeesAttendanceRegisterResult,
  EmployeeAttendanceRegisterSummary,
  EmployeeAttendanceSummary,
  EmployeeDailyAttendanceRecord,
} from '../actions/badges';

const ACCESS_LOG_CATEGORY_TABS: ReadonlyArray<{
  readonly id: AccessLogCategory;
  readonly label: string;
}> = [
  { id: 'ALL', label: 'All Logs' },
  { id: 'employees', label: 'Employees' },
  { id: 'contractors', label: 'Contractors' },
  { id: 'fleet-machines', label: 'Fleet (Machines on site)' },
  { id: 'fleet-ldv', label: 'Fleet (Company LDV)' },
  { id: 'fleet-personal', label: 'Fleet (Personal Vehicles of employees)' },
  { id: 'fleet-coal-trucks', label: 'Fleet (Coal trucks)' },
];

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_REGISTER_RANGE: AccessLogDateRange = 'QUARTER';
const AUDIO_FREQUENCY_GRANTED = 880;
const AUDIO_FREQUENCY_DENIED = 220;
const AUDIO_TONE_DURATION_SECONDS = 0.15;
const SCANNER_FOCUS_DELAY_MS = 100;
const OPERATIONAL_TIMEZONE = 'Africa/Johannesburg';
const CSV_FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;

const GATE_OPTIONS: readonly string[] = [
  'Main Gate North Turnstile',
  'East Pit Boom Gate',
  'South Haul Road Turnstile',
  'Weighbridge Inbound',
  'Processing Plant Turnstile',
];

interface QuickPreset {
  readonly label: string;
  readonly code: string;
  readonly role: string;
}

const QUICK_PRESETS: readonly QuickPreset[] = [
  { label: 'John Doe', code: 'BADGE-EMP-001', role: 'Engineering' },
  { label: 'Jane Smith', code: 'BADGE-EMP-002', role: 'Mining Op' },
  { label: 'John Operator', code: 'BADGE-OP-001', role: 'Pit Crew' },
  { label: 'Bob Dozer', code: 'BADGE-EMP-BOB', role: 'Heavy Fleet' },
  { label: 'Unknown Tag', code: 'INVALID-CODE-999', role: 'Denial Test' },
];

const DATE_RANGE_OPTIONS: ReadonlyArray<{
  readonly id: AccessLogDateRange;
  readonly label: string;
}> = [
  { id: 'TODAY', label: 'Today' },
  { id: 'WEEK', label: '7D' },
  { id: 'MONTH', label: '30D' },
  { id: 'QUARTER', label: '90D (3 Mo)' },
  { id: 'YEAR', label: '12 Months' },
  { id: 'ALL', label: 'All History' },
];

const ALCOHOL_DISPLAY_MAP: Record<
  string,
  { readonly label: string; readonly variant: 'green' | 'red' | 'amber' | 'gray' }
> = {
  approved: { label: 'Pass (Approved)', variant: 'green' },
  pass: { label: 'Pass', variant: 'green' },
  passed: { label: 'Pass', variant: 'green' },
  clear: { label: 'Pass (Clear)', variant: 'green' },
  negative: { label: 'Pass (Negative)', variant: 'green' },
  failed: { label: 'Fail (Failed)', variant: 'red' },
  fail: { label: 'Fail', variant: 'red' },
  positive: { label: 'Fail (Positive)', variant: 'red' },
  rejected: { label: 'Fail (Rejected)', variant: 'red' },
  'not tested': { label: 'Pending (Not Tested)', variant: 'amber' },
  pending: { label: 'Pending', variant: 'amber' },
  untested: { label: 'Pending', variant: 'amber' },
};

const FIELD_LABEL_CLASS =
  'mb-1 block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider';
const SELECT_CONTROL_CLASS =
  'w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-[var(--text-heading)] text-sm shadow-2xs focus:border-blue-500 focus:outline-none';
const SEARCH_INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border-default)] bg-white py-2 pr-3 pl-9 text-[var(--text-heading)] text-sm shadow-2xs focus:border-blue-500 focus:outline-none';

export interface ResolvedAccessLog {
  readonly id: string;
  readonly timestamp: string | null;
  readonly entityName: string;
  readonly entityType: string;
  readonly personnelId?: string | null;
  readonly idNumber?: string | null;
  readonly empCode?: string | null;
  readonly jobTitle?: string | null;
  readonly company?: string | null;
  readonly qrCodeId: string;
  readonly rfidCode?: string | null;
  readonly zone: string;
  readonly accessMethod: string;
  readonly status: string;
  readonly isGranted?: boolean;
  readonly denialReason?: string | null;
  readonly direction: string;
  readonly alcoholTested?: string | null;
  readonly operator?: string | null;
  readonly deviceId?: string | null;
}

export interface PersonnelFilterOption {
  readonly id: string;
  readonly name: string;
  readonly empCode: string;
  readonly idNumber?: string;
  readonly jobTitle: string;
}

export interface EasyScanFeedback {
  readonly success: boolean;
  readonly accessGranted: boolean;
  readonly name: string;
  readonly empCode?: string;
  readonly jobTitle?: string;
  readonly entityType: string;
  readonly message: string;
  readonly denialReason?: string | null;
  readonly scannedAt: string;
  readonly gateLocation: string;
  readonly direction: string;
}

interface AccessLogsClientProps {
  readonly initialLogs: readonly ResolvedAccessLog[];
  readonly initialTotalCount: number;
  readonly personnelList: readonly PersonnelFilterOption[];
  readonly initialEmployeeId?: string | null;
  readonly initialAttendanceSummary?: EmployeeAttendanceSummary | null;
  readonly initialAttendanceRegister?: AllEmployeesAttendanceRegisterResult | null;
  readonly initialDateRange?: AccessLogDateRange;
  readonly initialCategory?: AccessLogCategory;
  readonly initialQueryWarning?: string | null;
}

interface AccessLogQueryOverrides {
  readonly employeeId?: string | null;
  readonly page?: number;
  readonly search?: string;
  readonly direction?: 'ALL' | 'IN' | 'OUT';
  readonly status?: 'ALL' | 'GRANTED' | 'DENIED';
  readonly dateRange?: AccessLogDateRange;
  readonly category?: AccessLogCategory;
}

export function escapeAccessLogCsvCell(cellText: string): string {
  const neutralized = CSV_FORMULA_PREFIX_REGEX.test(cellText) ? `'${cellText}` : cellText;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function formatScanTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '—';
  const parsedDate = new Date(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return '—';
  return parsedDate.toLocaleTimeString('en-US', {
    timeZone: OPERATIONAL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatScanDate(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '—';
  const parsedDate = new Date(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return '—';
  return parsedDate.toLocaleDateString('en-US', {
    timeZone: OPERATIONAL_TIMEZONE,
  });
}

function formatScanDateTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '—';
  const parsedDate = new Date(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return '—';
  return parsedDate.toLocaleString('en-US', {
    timeZone: OPERATIONAL_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function buildAccessLogsCsv(logs: readonly ResolvedAccessLog[]): string {
  const headers = [
    'Scan Time',
    'Date',
    'Name',
    'Entity Type',
    'ID Number',
    'Coy Number',
    'Job Title',
    'QR / Badge ID',
    'RFID Code',
    'Gate / Zone',
    'Method',
    'Direction',
    'Alcohol Testing',
    'Status',
    'Denial Reason',
    'Operator',
    'Device ID',
  ];

  const rows = logs.map((entry) =>
    [
      formatScanTime(entry.timestamp),
      formatScanDate(entry.timestamp),
      entry.entityName,
      entry.entityType,
      entry.idNumber ?? '—',
      entry.empCode ?? '—',
      entry.jobTitle ?? '—',
      entry.qrCodeId,
      entry.rfidCode ?? '—',
      entry.zone,
      entry.accessMethod,
      entry.direction,
      entry.alcoholTested ?? 'Not Recorded',
      entry.status,
      entry.denialReason ?? '—',
      entry.operator ?? '—',
      entry.deviceId ?? '—',
    ]
      .map(escapeAccessLogCsvCell)
      .join(',')
  );

  return [headers.map(escapeAccessLogCsvCell).join(','), ...rows].join('\n');
}

export function buildAttendanceRegisterCsv(
  records: readonly EmployeeAttendanceRegisterSummary[]
): string {
  const headers = [
    'Employee Name',
    'ID Number',
    'Coy Number',
    'Job Title',
    'Days Present',
    'First Time In',
    'Last Time Out',
    'Total Scans',
    'Granted Scans',
    'Denied Scans',
    'Alcohol Tests',
    'Alcohol Pass',
    'Alcohol Fail',
    'Denial Reasons',
  ];

  const rows = records.map((record) =>
    [
      record.name,
      record.idNumber,
      record.coyNumber,
      record.jobTitle,
      String(record.daysPresent),
      formatScanDateTime(record.firstTimeIn),
      formatScanDateTime(record.lastTimeOut),
      String(record.totalScans),
      String(record.grantedCount),
      String(record.deniedCount),
      String(record.alcoholTestedCount),
      String(record.alcoholPassCount),
      String(record.alcoholFailCount),
      record.denialReasons.join('; ') || 'None',
    ]
      .map(escapeAccessLogCsvCell)
      .join(',')
  );

  return [headers.map(escapeAccessLogCsvCell).join(','), ...rows].join('\n');
}

export function buildEmployeeDailyAttendanceCsv(
  employeeRecord: EmployeeAttendanceRegisterSummary
): string {
  const headers = [
    'Employee Name',
    'ID Number',
    'Coy Number',
    'Job Title',
    'Date',
    'Time In',
    'Time Out',
    'Direction',
    'Alcohol Testing',
    'Status',
    'Denial Reason',
    'Gate Location',
    'Scan Count',
  ];

  const rows = employeeRecord.dailyRecords.map((daily) =>
    [
      employeeRecord.name,
      employeeRecord.idNumber,
      employeeRecord.coyNumber,
      employeeRecord.jobTitle,
      daily.date,
      formatScanTime(daily.timeIn),
      formatScanTime(daily.timeOut),
      daily.direction,
      daily.alcoholTested,
      daily.status,
      daily.denialReason ?? '—',
      daily.gateLocation ?? '—',
      String(daily.scanCount),
    ]
      .map(escapeAccessLogCsvCell)
      .join(',')
  );

  return [headers.map(escapeAccessLogCsvCell).join(','), ...rows].join('\n');
}

function triggerCsvDownload(options: {
  readonly filename: string;
  readonly content: string;
}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const csvBlob = new Blob([options.content], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(csvBlob);
  const anchorElement = document.createElement('a');
  anchorElement.href = blobUrl;
  anchorElement.download = options.filename;
  document.body.appendChild(anchorElement);
  anchorElement.click();
  document.body.removeChild(anchorElement);
  URL.revokeObjectURL(blobUrl);
}

function playScanAudioFeedback(isGranted: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = isGranted ? 'sine' : 'sawtooth';
    oscillator.frequency.value = isGranted ? AUDIO_FREQUENCY_GRANTED : AUDIO_FREQUENCY_DENIED;

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + AUDIO_TONE_DURATION_SECONDS
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + AUDIO_TONE_DURATION_SECONDS);
  } catch {
    // Ignore audio permission or playback errors
  }
}

function isAlreadyResolvedLog(
  candidate: AccessLogFilterQueryRow | ResolvedAccessLog
): candidate is ResolvedAccessLog {
  return 'timestamp' in candidate && 'entityName' in candidate;
}

function mapRawQueryRowToResolved(
  rawItem: AccessLogFilterQueryRow | ResolvedAccessLog
): ResolvedAccessLog {
  if (isAlreadyResolvedLog(rawItem)) {
    return {
      ...rawItem,
      isGranted: rawItem.isGranted ?? rawItem.status === 'Granted',
      alcoholTested: rawItem.alcoholTested ?? 'Not Recorded',
    };
  }

  const badgeRef = rawItem.badge;
  let resolvedName = rawItem.denial_reason?.toLowerCase().includes('unrecognized')
    ? 'Unrecognized Credential'
    : 'Unknown Entity';
  let resolvedType = badgeRef?.entity_type ?? rawItem.access_type ?? 'Unknown';
  let personnelIdentifier: string | null = null;
  let idNumber: string | null = null;
  let empCode: string | null = null;
  let jobTitle: string | null = null;
  let company: string | null = null;

  if (badgeRef?.personnel) {
    resolvedName =
      [badgeRef.personnel.first_name, badgeRef.personnel.surname]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Employee';
    resolvedType = 'Employee';
    personnelIdentifier = badgeRef.personnel.id ?? null;
    idNumber = badgeRef.personnel.id_number ?? null;
    empCode = badgeRef.personnel.emp_code ?? null;
    jobTitle = badgeRef.personnel.job_title ?? null;
  } else if (badgeRef?.visitor) {
    resolvedName =
      [badgeRef.visitor.first_name, badgeRef.visitor.surname].filter(Boolean).join(' ').trim() ||
      badgeRef.visitor.name?.trim() ||
      'Visitor';
    resolvedType = 'Visitor';
    idNumber = badgeRef.visitor.id_number ?? null;
    company = badgeRef.visitor.company ?? null;
    jobTitle = company ? `Visitor • ${company}` : 'Visitor';
  } else if (badgeRef?.fleet) {
    resolvedName = badgeRef.fleet.fleet_code
      ? `Fleet: ${badgeRef.fleet.fleet_code}`
      : 'Fleet Vehicle';
    resolvedType = 'Fleet';
    empCode = badgeRef.fleet.registration_number ?? null;
    jobTitle = 'Fleet Asset';
  }

  const isGranted = Boolean(rawItem.access_granted);
  const denialReason = rawItem.denial_reason ?? null;
  let statusLabel = isGranted ? 'Granted' : 'Denied';
  if (!isGranted && denialReason) {
    const lowerReason = denialReason.toLowerCase();
    if (lowerReason.includes('expired')) {
      statusLabel = 'Expired Credential';
    } else if (lowerReason.includes('tailgate')) {
      statusLabel = 'Tailgate Alert';
    }
  }

  const rawDirection = typeof rawItem.direction === 'string' ? rawItem.direction.trim() : '';

  return {
    id: rawItem.id,
    timestamp: rawItem.scanned_at ?? null,
    entityName: resolvedName,
    entityType: resolvedType,
    personnelId: personnelIdentifier,
    idNumber,
    empCode,
    jobTitle,
    company,
    qrCodeId: badgeRef?.qr_code ?? badgeRef?.rfid_code ?? 'N/A',
    rfidCode: badgeRef?.rfid_code ?? null,
    zone: rawItem.gate_location?.trim() || 'Unknown Gate',
    accessMethod: rawItem.access_type?.trim() || 'QR Scan',
    status: statusLabel,
    isGranted,
    denialReason,
    direction: rawDirection ? rawDirection.toUpperCase() : 'UNKNOWN',
    alcoholTested: rawItem.alcohol_tested?.trim() || 'Not Recorded',
    operator: rawItem.operator ?? null,
    deviceId: rawItem.device_id ?? null,
  };
}

function isLogRowGranted(logEntry: ResolvedAccessLog): boolean {
  if (logEntry.isGranted !== undefined) return logEntry.isGranted;
  return logEntry.status === 'Granted';
}

function StatTile({
  icon,
  label,
  valueText,
  subText,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly valueText: string;
  readonly subText?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-default)]/50 bg-white/70 p-3">
      <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
        {icon}
        {label}
      </span>
      <p className="mt-1 font-bold font-mono text-[var(--text-heading)] text-sm">{valueText}</p>
      {subText && <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{subText}</p>}
    </div>
  );
}

function AlcoholStatusBadge({
  alcoholTested,
}: {
  readonly alcoholTested: string | null | undefined;
}) {
  const rawLabel = (alcoholTested ?? '').trim();
  const normalized = rawLabel.toLowerCase();
  const mapped = ALCOHOL_DISPLAY_MAP[normalized];

  if (mapped) {
    return (
      <Badge variant={mapped.variant} contrast="low" size="sm">
        {mapped.label}
      </Badge>
    );
  }

  return (
    <Badge variant="gray" contrast="low" size="sm">
      {rawLabel || 'Not Recorded'}
    </Badge>
  );
}

function DirectionBadge({ direction }: { readonly direction: string }) {
  const normalized = direction.toUpperCase();
  if (normalized === 'IN') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 text-xs">
        <ArrowDownLeft className="h-3 w-3" />
        IN
      </span>
    );
  }
  if (normalized === 'OUT') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-700 text-xs">
        <ArrowUpRight className="h-3 w-3" />
        OUT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700 text-xs">
      {normalized || 'UNKNOWN'}
    </span>
  );
}

function AccessStatusCell({ logEntry }: { readonly logEntry: ResolvedAccessLog }) {
  const granted = isLogRowGranted(logEntry);
  if (granted) {
    return (
      <Badge variant="green" contrast="low" size="sm">
        Granted
      </Badge>
    );
  }

  const badgeVariant = logEntry.status === 'Expired Credential' ? 'amber' : 'red';
  const badgeText = logEntry.status === 'Expired Credential' ? 'Expired' : logEntry.status;
  const reasonDisplay = logEntry.denialReason?.trim() || 'Access denied (no reason recorded)';

  return (
    <div className="flex flex-col items-end gap-1">
      <Badge variant={badgeVariant} contrast="low" size="sm" title={reasonDisplay}>
        {badgeText}
      </Badge>
      <span
        className="max-w-[230px] rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-right font-medium text-[11px] text-rose-700"
        title={reasonDisplay}
      >
        Reason: {reasonDisplay}
      </span>
    </div>
  );
}

function DetailField({
  label,
  detailText,
  mono = false,
}: {
  readonly label: string;
  readonly detailText: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-default)]/60 bg-[var(--bg-secondary)]/40 p-2.5">
      <span className="block font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`mt-0.5 block text-[var(--text-heading)] text-xs ${mono ? 'font-mono' : 'font-medium'}`}
      >
        {detailText}
      </span>
    </div>
  );
}

export function AccessLogsClient({
  initialLogs,
  initialTotalCount,
  personnelList,
  initialEmployeeId = null,
  initialAttendanceSummary = null,
  initialAttendanceRegister = null,
  initialDateRange = 'ALL',
  initialCategory = 'ALL',
  initialQueryWarning = null,
}: AccessLogsClientProps) {
  const [activeTab, setActiveTab] = useState<'logs' | 'register'>('logs');
  const [logs, setLogs] = useState<readonly ResolvedAccessLog[]>(initialLogs);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);
  const [currentPage, setCurrentPage] = useState<number>(DEFAULT_PAGE);
  const [queryWarning, setQueryWarning] = useState<string | null>(initialQueryWarning);

  // Access logs stream filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialEmployeeId);
  const [attendanceSummary, setAttendanceSummary] = useState<EmployeeAttendanceSummary | null>(
    initialAttendanceSummary
  );
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'GRANTED' | 'DENIED'>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<AccessLogDateRange>(initialDateRange);
  const [categoryFilter, setCategoryFilter] = useState<AccessLogCategory>(initialCategory);

  const prevInitialCategoryRef = useRef<AccessLogCategory>(initialCategory);
  useEffect(() => {
    if (prevInitialCategoryRef.current !== initialCategory) {
      prevInitialCategoryRef.current = initialCategory;
      setCategoryFilter(initialCategory);
      setLogs(initialLogs);
      setTotalCount(initialTotalCount);
      setCurrentPage(DEFAULT_PAGE);
    }
  }, [initialCategory, initialLogs, initialTotalCount]);

  // Attendance register state
  const [registerData, setRegisterData] = useState<AllEmployeesAttendanceRegisterResult | null>(
    initialAttendanceRegister
  );
  const [registerDateRange, setRegisterDateRange] = useState<AccessLogDateRange>(
    initialAttendanceRegister?.dateRange ?? DEFAULT_REGISTER_RANGE
  );
  const [registerSearch, setRegisterSearch] = useState<string>('');
  const [selectedRegisterEmployeeId, setSelectedRegisterEmployeeId] = useState<string | null>(
    initialEmployeeId
  );

  // Detail modal & scanner modal state
  const [inspectedLog, setInspectedLog] = useState<ResolvedAccessLog | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scanDirection, setScanDirection] = useState<'IN' | 'OUT'>('IN');
  const [selectedGate, setSelectedGate] = useState<string>(
    GATE_OPTIONS[0] ?? 'Main Gate North Turnstile'
  );
  const [lastScanResult, setLastScanResult] = useState<EasyScanFeedback | null>(null);

  const [isPending, startTransition] = useTransition();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputId = useId();
  const employeeSelectId = useId();
  const registerSearchInputId = useId();
  const registerEmployeeSelectId = useId();
  const barcodeInputId = useId();
  const gateSelectId = useId();

  useEffect(() => {
    if (!isScannerOpen) return;
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, SCANNER_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isScannerOpen]);

  const fetchUpdatedLogs = useCallback(
    async (overrides: AccessLogQueryOverrides = {}) => {
      const activeEmployeeId =
        overrides.employeeId !== undefined ? overrides.employeeId : selectedEmployeeId;
      const targetPage = overrides.page ?? currentPage;
      const targetSearch = overrides.search !== undefined ? overrides.search : searchKeyword;
      const targetDirection = overrides.direction ?? directionFilter;
      const targetStatus = overrides.status ?? statusFilter;
      const targetDateRange = overrides.dateRange ?? dateRangeFilter;
      const targetCategory = overrides.category ?? categoryFilter;

      startTransition(async () => {
        try {
          const fetchResult = await getAccessLogsWithFilters({
            employeeId: activeEmployeeId,
            page: targetPage,
            pageSize: DEFAULT_PAGE_SIZE,
            searchQuery: targetSearch,
            direction: targetDirection,
            statusFilter: targetStatus,
            dateRange: targetDateRange,
            ...(targetCategory !== 'ALL' ? { category: targetCategory } : {}),
          });

          const rawRows = (fetchResult.logs ?? []) as unknown as Array<
            AccessLogFilterQueryRow | ResolvedAccessLog
          >;
          setLogs(rawRows.map(mapRawQueryRowToResolved));
          setTotalCount(fetchResult.totalCount);
          setQueryWarning(fetchResult.queryWarning ?? null);

          if (activeEmployeeId) {
            const summaryResult = await getEmployeeAttendanceSummary(
              activeEmployeeId,
              targetDateRange
            );
            setAttendanceSummary(summaryResult);
          } else {
            setAttendanceSummary(null);
          }
        } catch (fetchError: unknown) {
          const errorMessage =
            fetchError instanceof Error ? fetchError.message : 'Failed to fetch logs';
          toast.error(errorMessage);
        }
      });
    },
    [
      selectedEmployeeId,
      currentPage,
      searchKeyword,
      directionFilter,
      statusFilter,
      dateRangeFilter,
      categoryFilter,
    ]
  );

  const fetchAttendanceRegister = useCallback(
    async (
      overrides: { readonly dateRange?: AccessLogDateRange; readonly search?: string } = {}
    ) => {
      const targetDateRange = overrides.dateRange ?? registerDateRange;
      const targetSearch = overrides.search !== undefined ? overrides.search : registerSearch;

      startTransition(async () => {
        try {
          const nextRegister = await getAllEmployeesAttendanceRegister({
            dateRange: targetDateRange,
            search: targetSearch,
          });
          setRegisterData(nextRegister);
          if (nextRegister.queryWarning) {
            setQueryWarning(nextRegister.queryWarning);
          }
        } catch (registerError: unknown) {
          const errorMessage =
            registerError instanceof Error
              ? registerError.message
              : 'Failed to load attendance register';
          toast.error(errorMessage);
        }
      });
    },
    [registerDateRange, registerSearch]
  );

  const handleOpenTab = (targetTab: 'logs' | 'register') => {
    setActiveTab(targetTab);
    if (targetTab === 'register' && !registerData) {
      fetchAttendanceRegister();
    }
  };

  const handleSelectEmployee = (personnelId: string | null) => {
    setSelectedEmployeeId(personnelId);
    setSelectedRegisterEmployeeId(personnelId);
    setCurrentPage(DEFAULT_PAGE);
    fetchUpdatedLogs({ employeeId: personnelId, page: DEFAULT_PAGE });
  };

  const handleOpenEmployeeInRegister = (personnelId: string) => {
    setSelectedRegisterEmployeeId(personnelId);
    setActiveTab('register');
    if (!registerData) {
      fetchAttendanceRegister();
    }
  };

  const handleResetFilters = () => {
    setSelectedEmployeeId(null);
    setSearchKeyword('');
    setDirectionFilter('ALL');
    setStatusFilter('ALL');
    setDateRangeFilter('ALL');
    setCategoryFilter('ALL');
    setCurrentPage(DEFAULT_PAGE);
    fetchUpdatedLogs({
      employeeId: null,
      page: DEFAULT_PAGE,
      search: '',
      direction: 'ALL',
      status: 'ALL',
      dateRange: 'ALL',
      category: 'ALL',
    });
  };

  const handleExportLogsCsv = () => {
    const csvContent = buildAccessLogsCsv(logs);
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: OPERATIONAL_TIMEZONE });
    triggerCsvDownload({
      filename: `access-logs-${todayIso}.csv`,
      content: csvContent,
    });
    toast.success(`Exported ${logs.length.toLocaleString('en-US')} access log rows to CSV`);
  };

  const handleExportRegisterCsv = (selectedEmployee?: EmployeeAttendanceRegisterSummary | null) => {
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: OPERATIONAL_TIMEZONE });
    if (selectedEmployee) {
      const employeeCsv = buildEmployeeDailyAttendanceCsv(selectedEmployee);
      const safeSlug = selectedEmployee.coyNumber.replace(/[^A-Za-z0-9_-]/g, '-');
      triggerCsvDownload({
        filename: `attendance-register-${safeSlug}-${todayIso}.csv`,
        content: employeeCsv,
      });
      toast.success(`Exported daily register for ${selectedEmployee.name}`);
      return;
    }

    const recordsToExport = registerData?.records ?? [];
    const registerCsv = buildAttendanceRegisterCsv(recordsToExport);
    triggerCsvDownload({
      filename: `attendance-register-all-${registerDateRange.toLowerCase()}-${todayIso}.csv`,
      content: registerCsv,
    });
    toast.success(
      `Exported attendance register for ${recordsToExport.length.toLocaleString('en-US')} employees`
    );
  };

  const handleProcessScan = async (codeToScan: string) => {
    const cleanCode = codeToScan.trim();
    if (!cleanCode) {
      toast.error('Scan code cannot be empty');
      return;
    }

    try {
      const outcome = await executeEasyScan({
        code: cleanCode,
        direction: scanDirection,
        gateLocation: selectedGate,
        scannerId: 'EASY-SCANNER-CONSOLE',
      });

      playScanAudioFeedback(outcome.accessGranted);

      setLastScanResult({
        success: outcome.success,
        accessGranted: outcome.accessGranted,
        name: outcome.name,
        empCode: outcome.empCode,
        jobTitle: outcome.jobTitle,
        entityType: outcome.entityType,
        message: outcome.message,
        denialReason: outcome.denialReason,
        scannedAt: outcome.scannedAt,
        gateLocation: outcome.gateLocation,
        direction: outcome.direction,
      });

      if (outcome.accessGranted) {
        toast.success(`Access Granted: ${outcome.name}`);
      } else {
        toast.error(`Access Denied: ${outcome.denialReason || outcome.name}`);
      }

      setBarcodeInput('');
      barcodeInputRef.current?.focus();

      await fetchUpdatedLogs();
    } catch (scanError: unknown) {
      const errorMessage = scanError instanceof Error ? scanError.message : 'Scan failed';
      toast.error(errorMessage);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));
  const registerRecords = registerData?.records ?? [];
  const selectedRegisterEmployee =
    registerRecords.find((record) => record.employeeId === selectedRegisterEmployeeId) ?? null;

  const registerTotals = registerRecords.reduce(
    (accumulator, record) => ({
      activeEmployees: accumulator.activeEmployees + (record.totalScans > 0 ? 1 : 0),
      granted: accumulator.granted + record.grantedCount,
      denied: accumulator.denied + record.deniedCount,
      alcoholPass: accumulator.alcoholPass + record.alcoholPassCount,
      alcoholFail: accumulator.alcoholFail + record.alcoholFailCount,
    }),
    { activeEmployees: 0, granted: 0, denied: 0, alcoholPass: 0, alcoholFail: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Top Banner, View Tabs, and Primary Actions */}
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">
            Access Logs & Attendance Register
          </h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Real-time alcohol testing, gate direction tracking, denial reason diagnostics, and
            multi-month employee attendance registers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="tablist"
            aria-label="Access Logs Views"
            className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'logs'}
              onClick={() => handleOpenTab('logs')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold text-xs transition-colors ${
                activeTab === 'logs'
                  ? 'bg-white text-[var(--text-heading)] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Access Logs Stream</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'register'}
              onClick={() => handleOpenTab('register')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold text-xs transition-colors ${
                activeTab === 'register'
                  ? 'bg-white text-[var(--text-heading)] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Employee Attendance Register</span>
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              activeTab === 'register'
                ? handleExportRegisterCsv(selectedRegisterEmployee)
                : handleExportLogsCsv()
            }
            className="flex items-center gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-95"
          >
            <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
            <span>⚡ Easy Scanner Console</span>
          </Button>
        </div>
      </div>

      {/* Non-crashing Schema / Query Warning Banner */}
      {queryWarning && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-amber-900 text-xs shadow-2xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Schema Compatibility Notice</p>
              <p className="mt-0.5 text-amber-800">{queryWarning}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQueryWarning(null)}
            aria-label="Dismiss warning"
            className="rounded p-1 text-amber-700 hover:bg-amber-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: ACCESS LOGS STREAM */}
      {activeTab === 'logs' && (
        <>
          {/* Access Log Category Sub-Tabs (Employees, Contractors, Fleet Types) */}
          <div
            role="tablist"
            aria-label="Access Logs Category Sub-tabs"
            data-testid="access-logs-category-tabs"
            className="flex flex-wrap items-center gap-2 rounded-xl border border-accent-gold/55 bg-white p-2 shadow-2xs"
          >
            {ACCESS_LOG_CATEGORY_TABS.map((catTab) => {
              const isSelected = categoryFilter === catTab.id;
              return (
                <button
                  key={catTab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-testid={`access-logs-category-tab-${catTab.id}`}
                  onClick={() => {
                    setCategoryFilter(catTab.id);
                    setCurrentPage(DEFAULT_PAGE);
                    fetchUpdatedLogs({ page: DEFAULT_PAGE, category: catTab.id });
                  }}
                  className={`rounded-lg border px-3 py-1.5 font-semibold text-xs transition-all ${
                    isSelected
                      ? 'gold-steel-border gold-steel-border-slim border-accent-gold bg-amber-50 text-slate-900 shadow-2xs'
                      : 'border-black/[0.07] bg-slate-50 text-slate-600 hover:border-accent-gold/45 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {catTab.label}
                </button>
              );
            })}
          </div>

          {/* Employee Attendance Register Dossier Card */}
          {attendanceSummary && (
            <GlassCard variant="window" className="border-blue-500/30 bg-blue-500/5 p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 border-[var(--border-default)]/50 border-b pb-4 lg:flex-row lg:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 font-bold text-blue-700 text-lg">
                    {attendanceSummary.employee.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[var(--text-heading)] text-lg">
                        {attendanceSummary.employee.name}
                      </h3>
                      <Badge variant="blue" contrast="low" size="sm">
                        Coy: {attendanceSummary.employee.empCode}
                      </Badge>
                      {attendanceSummary.employee.idNumber && (
                        <Badge variant="gray" contrast="low" size="sm">
                          ID: {attendanceSummary.employee.idNumber}
                        </Badge>
                      )}
                      {attendanceSummary.currentPresence === 'ON_SITE' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700 text-xs">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                          ON SITE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600 text-xs">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          OFF SITE
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text-muted)] text-xs">
                      {attendanceSummary.employee.jobTitle} • Full Site Attendance Register
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEmployeeInRegister(attendanceSummary.employee.id)}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Open Multi-Month Register</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectEmployee(null)}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Clear Filter (Show All Personnel)</span>
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatTile
                  icon={<LogIn className="h-3 w-3 text-emerald-600" />}
                  label="First In (Clock-In)"
                  valueText={
                    attendanceSummary.firstInToday
                      ? formatScanTime(attendanceSummary.firstInToday)
                      : 'No clock-in'
                  }
                />
                <StatTile
                  icon={<LogOut className="h-3 w-3 text-amber-600" />}
                  label="Last Out (Clock-Out)"
                  valueText={
                    attendanceSummary.lastOutToday
                      ? formatScanTime(attendanceSummary.lastOutToday)
                      : attendanceSummary.currentPresence === 'ON_SITE'
                        ? 'Active On Shift'
                        : 'N/A'
                  }
                />
                <StatTile
                  icon={<Clock className="h-3 w-3 text-blue-600" />}
                  label="Time On Site"
                  valueText={attendanceSummary.totalHoursToday}
                  subText={`${attendanceSummary.daysPresent} days present in range`}
                />
                <StatTile
                  icon={<QrCode className="h-3 w-3 text-purple-600" />}
                  label="Period Scans"
                  valueText={`${attendanceSummary.totalScans.toLocaleString('en-US')} events`}
                  subText={`${attendanceSummary.grantedCount} granted • ${attendanceSummary.deniedCount} denied`}
                />
                <StatTile
                  icon={<Wine className="h-3 w-3 text-teal-600" />}
                  label="Alcohol Screen"
                  valueText={`${attendanceSummary.alcoholPassCount} Pass / ${attendanceSummary.alcoholFailCount} Fail`}
                  subText={`${attendanceSummary.alcoholTestedCount} tested`}
                />
                <StatTile
                  icon={<ShieldCheck className="h-3 w-3 text-teal-600" />}
                  label="Compliance Rate"
                  valueText={`${attendanceSummary.complianceRate}%`}
                  subText={attendanceSummary.lastGateLocation ?? 'No gate recorded'}
                />
              </div>
            </GlassCard>
          )}

          {/* Filter and Query Control Bar */}
          <GlassCard className="p-4">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-5">
                  <label htmlFor={employeeSelectId} className={FIELD_LABEL_CLASS}>
                    Filter by Employee (Attendance Dossier)
                  </label>
                  <select
                    id={employeeSelectId}
                    value={selectedEmployeeId ?? ''}
                    onChange={(changeEvent) => {
                      const chosenId = changeEvent.target.value || null;
                      handleSelectEmployee(chosenId);
                    }}
                    className={SELECT_CONTROL_CLASS}
                  >
                    <option value="">
                      All Personnel & Entities ({personnelList.length} registered)
                    </option>
                    {personnelList.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} ({person.empCode}
                        {person.idNumber ? ` • ID ${person.idNumber}` : ''}) - {person.jobTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-5">
                  <label htmlFor={searchInputId} className={FIELD_LABEL_CLASS}>
                    Search Scans (Name, ID #, Coy #, RFID, Gate, Reason)
                  </label>
                  <div className="relative">
                    <Search className="absolute top-2.5 left-3 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      id={searchInputId}
                      type="text"
                      placeholder="Filter by name, ID number, coy #, denial reason..."
                      value={searchKeyword}
                      onChange={(changeEvent) => {
                        const queryText = changeEvent.target.value;
                        setSearchKeyword(queryText);
                        fetchUpdatedLogs({
                          employeeId: selectedEmployeeId,
                          page: DEFAULT_PAGE,
                          search: queryText,
                        });
                      }}
                      className={SEARCH_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex items-end md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetFilters}
                    className="w-full text-xs"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              </div>

              {/* Secondary Filter Pills: Direction, Status, Date Range */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-default)]/50 border-t pt-3">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--text-muted)]">Direction:</span>
                    {(['ALL', 'IN', 'OUT'] as const).map((directionOption) => (
                      <button
                        key={directionOption}
                        type="button"
                        onClick={() => {
                          setDirectionFilter(directionOption);
                          setCurrentPage(DEFAULT_PAGE);
                          fetchUpdatedLogs({
                            page: DEFAULT_PAGE,
                            direction: directionOption,
                          });
                        }}
                        className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                          directionFilter === directionOption
                            ? 'bg-blue-600 text-white'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        {directionOption === 'ALL'
                          ? 'All Movements'
                          : directionOption === 'IN'
                            ? 'Entry (IN)'
                            : 'Exit (OUT)'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--text-muted)]">Status:</span>
                    {(['ALL', 'GRANTED', 'DENIED'] as const).map((statusOption) => (
                      <button
                        key={statusOption}
                        type="button"
                        onClick={() => {
                          setStatusFilter(statusOption);
                          setCurrentPage(DEFAULT_PAGE);
                          fetchUpdatedLogs({
                            page: DEFAULT_PAGE,
                            status: statusOption,
                          });
                        }}
                        className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                          statusFilter === statusOption
                            ? statusOption === 'DENIED'
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        {statusOption}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-[var(--text-muted)]">Range:</span>
                    {DATE_RANGE_OPTIONS.map((dateOption) => (
                      <button
                        key={dateOption.id}
                        type="button"
                        onClick={() => {
                          setDateRangeFilter(dateOption.id);
                          setCurrentPage(DEFAULT_PAGE);
                          fetchUpdatedLogs({
                            page: DEFAULT_PAGE,
                            dateRange: dateOption.id,
                          });
                        }}
                        className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                          dateRangeFilter === dateOption.id
                            ? 'bg-slate-700 text-white'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        {dateOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[var(--text-muted)] text-xs">
                  Showing{' '}
                  <span className="font-bold text-[var(--text-heading)]">
                    {logs.length.toLocaleString('en-US')}
                  </span>{' '}
                  of{' '}
                  <span className="font-bold text-[var(--text-heading)]">
                    {totalCount.toLocaleString('en-US')}
                  </span>{' '}
                  events {isPending ? '• Refreshing...' : ''}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Access Logs Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
              <h3 className="flex items-center font-semibold text-[var(--text-heading)]">
                <Clock className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
                {selectedEmployeeId ? 'Attendance Scan History' : 'Recent Access Events'}
              </h3>
              <span className="text-[var(--text-muted)] text-xs">
                {totalCount.toLocaleString('en-US')} total entries
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-default)] border-b hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)]">Time In / Scan</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Person & IDs</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Badge QR / RFID</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Gate & Method</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Direction</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Alcohol Test</TableHead>
                  <TableHead className="text-right text-[var(--text-muted)]">
                    Status & Reason
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-muted)]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Filter className="h-8 w-8 text-[var(--text-muted)]/50" />
                        <p className="font-medium">No scan logs matched your filter criteria.</p>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="font-semibold text-blue-600 text-xs hover:underline"
                        >
                          Clear all filters
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {logs.map((logEntry) => {
                  const granted = isLogRowGranted(logEntry);
                  return (
                    <TableRow
                      key={logEntry.id}
                      className="border-[var(--border-default)]/50 border-b transition-colors hover:bg-[var(--bg-tertiary)]"
                    >
                      <TableCell className="font-mono text-[var(--text-secondary)] text-xs">
                        {formatScanTime(logEntry.timestamp)}
                        <span className="block text-[10px] text-[var(--text-muted)]">
                          {formatScanDate(logEntry.timestamp)}
                        </span>
                      </TableCell>

                      <TableCell className="text-[var(--text-heading)]">
                        <div className="flex items-start gap-2.5">
                          <AvatarWithIcon
                            size={24}
                            letter={
                              logEntry.entityName
                                .replace(/[^A-Za-z0-9]/g, '')
                                .slice(0, 2)
                                .toUpperCase() || 'ID'
                            }
                            title={logEntry.entityName}
                            icon={
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  granted ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                            }
                            iconBackground
                          />
                          <div>
                            <span className="block font-medium text-sm">{logEntry.entityName}</span>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                              <span className="capitalize">{logEntry.entityType}</span>
                              {logEntry.empCode && (
                                <span className="font-mono">• Coy: {logEntry.empCode}</span>
                              )}
                              {logEntry.idNumber && (
                                <span className="font-mono">• ID: {logEntry.idNumber}</span>
                              )}
                            </div>
                            {logEntry.jobTitle && (
                              <span className="block text-[11px] text-[var(--text-secondary)]">
                                {logEntry.jobTitle}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-[var(--accent-blue)] text-xs">
                        <span>{logEntry.qrCodeId}</span>
                        {logEntry.rfidCode && logEntry.rfidCode !== logEntry.qrCodeId && (
                          <span className="block text-[10px] text-[var(--text-muted)]">
                            RFID: {logEntry.rfidCode}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-[var(--text-secondary)] text-xs">
                        <span className="block font-medium">{logEntry.zone}</span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {logEntry.accessMethod}
                          {logEntry.deviceId ? ` • ${logEntry.deviceId}` : ''}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs">
                        <DirectionBadge direction={logEntry.direction} />
                      </TableCell>

                      <TableCell className="text-xs">
                        <AlcoholStatusBadge alcoholTested={logEntry.alcoholTested} />
                      </TableCell>

                      <TableCell className="text-right">
                        <AccessStatusCell logEntry={logEntry} />
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectedLog(logEntry)}
                            className="h-7 px-2 text-[11px] text-[var(--text-secondary)] hover:bg-slate-100"
                            title="View full scan & telemetry details"
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Details
                          </Button>
                          {logEntry.personnelId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectEmployee(logEntry.personnelId ?? null)}
                              className="h-7 px-2 text-[11px] text-blue-600 hover:bg-blue-50"
                              title="Filter and open employee attendance register"
                            >
                              View Register
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalCount > 0 && (
              <div className="border-[var(--border-default)] border-t p-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={DEFAULT_PAGE_SIZE}
                  onPageChange={(targetPageNumber) => {
                    setCurrentPage(targetPageNumber);
                    fetchUpdatedLogs({ page: targetPageNumber });
                  }}
                />
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* TAB 2: MULTI-MONTH EMPLOYEE ATTENDANCE REGISTER */}
      {activeTab === 'register' && (
        <div className="space-y-5">
          <GlassCard className="p-4">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-5">
                  <label htmlFor={registerEmployeeSelectId} className={FIELD_LABEL_CLASS}>
                    Inspect Individual Employee Daily Record
                  </label>
                  <select
                    id={registerEmployeeSelectId}
                    value={selectedRegisterEmployeeId ?? ''}
                    onChange={(changeEvent) => {
                      const nextId = changeEvent.target.value || null;
                      setSelectedRegisterEmployeeId(nextId);
                    }}
                    className={SELECT_CONTROL_CLASS}
                  >
                    <option value="">All Employees Summary ({registerRecords.length})</option>
                    {registerRecords.map((empRecord) => (
                      <option key={empRecord.employeeId} value={empRecord.employeeId}>
                        {empRecord.name} (Coy: {empRecord.coyNumber} • ID: {empRecord.idNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-5">
                  <label htmlFor={registerSearchInputId} className={FIELD_LABEL_CLASS}>
                    Search Attendance Register (Name, ID Number, Coy #, Reason)
                  </label>
                  <div className="relative">
                    <Search className="absolute top-2.5 left-3 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      id={registerSearchInputId}
                      type="text"
                      placeholder="Search employees in register..."
                      value={registerSearch}
                      onChange={(changeEvent) => {
                        const nextSearch = changeEvent.target.value;
                        setRegisterSearch(nextSearch);
                        fetchAttendanceRegister({ search: nextSearch });
                      }}
                      className={SEARCH_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex items-end gap-2 md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleExportRegisterCsv(selectedRegisterEmployee)}
                    className="w-full text-xs"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-default)]/50 border-t pt-3">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-semibold text-[var(--text-muted)]">Period:</span>
                  {DATE_RANGE_OPTIONS.map((dateOption) => (
                    <button
                      key={dateOption.id}
                      type="button"
                      onClick={() => {
                        setRegisterDateRange(dateOption.id);
                        fetchAttendanceRegister({ dateRange: dateOption.id });
                      }}
                      className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                        registerDateRange === dateOption.id
                          ? 'bg-slate-700 text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      {dateOption.label}
                    </button>
                  ))}
                </div>

                <span className="text-[var(--text-muted)] text-xs">
                  {registerRecords.length.toLocaleString('en-US')} employee records loaded{' '}
                  {isPending ? '• Updating...' : ''}
                </span>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={<Users className="h-3.5 w-3.5 text-blue-600" />}
              label="Registered Employees"
              valueText={registerRecords.length.toLocaleString('en-US')}
              subText={`${registerTotals.activeEmployees.toLocaleString('en-US')} with scans in period`}
            />
            <StatTile
              icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
              label="Granted Gate Events"
              valueText={registerTotals.granted.toLocaleString('en-US')}
              subText="Successful IN/OUT scans"
            />
            <StatTile
              icon={<ShieldAlert className="h-3.5 w-3.5 text-rose-600" />}
              label="Denied Gate Events"
              valueText={registerTotals.denied.toLocaleString('en-US')}
              subText="With recorded denial reasons"
            />
            <StatTile
              icon={<Wine className="h-3.5 w-3.5 text-teal-600" />}
              label="Alcohol Screening"
              valueText={`${registerTotals.alcoholPass.toLocaleString('en-US')} Pass / ${registerTotals.alcoholFail.toLocaleString('en-US')} Fail`}
              subText="Breathalyzer compliance"
            />
          </div>

          {/* Individual Employee Multi-Month Daily Breakdown */}
          {selectedRegisterEmployee ? (
            <GlassCard className="overflow-hidden p-0">
              <div className="flex flex-col justify-between gap-3 border-[var(--border-default)] border-b bg-blue-500/5 p-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[var(--text-heading)] text-base">
                      {selectedRegisterEmployee.name}
                    </h3>
                    <Badge variant="blue" contrast="low" size="sm">
                      Coy: {selectedRegisterEmployee.coyNumber}
                    </Badge>
                    <Badge variant="gray" contrast="low" size="sm">
                      ID: {selectedRegisterEmployee.idNumber}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[var(--text-muted)] text-xs">
                    {selectedRegisterEmployee.jobTitle} • {selectedRegisterEmployee.daysPresent}{' '}
                    days present • {selectedRegisterEmployee.grantedCount} granted /{' '}
                    {selectedRegisterEmployee.deniedCount} denied • Alcohol:{' '}
                    {selectedRegisterEmployee.alcoholPassCount} pass /{' '}
                    {selectedRegisterEmployee.alcoholFailCount} fail
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportRegisterCsv(selectedRegisterEmployee)}
                    className="text-xs"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export Employee CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRegisterEmployeeId(null)}
                    className="text-xs"
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    All Employees
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--border-default)] border-b hover:bg-transparent">
                    <TableHead className="text-[var(--text-muted)]">Date</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Time In</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Time Out</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Direction</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Alcohol Test</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Gate Location</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Status & Reason</TableHead>
                    <TableHead className="text-right text-[var(--text-muted)]">Scans</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRegisterEmployee.dailyRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-[var(--text-muted)]">
                        No scan activity recorded for this employee in the selected date range.
                      </TableCell>
                    </TableRow>
                  )}

                  {selectedRegisterEmployee.dailyRecords.map(
                    (dailyRecord: EmployeeDailyAttendanceRecord) => (
                      <TableRow
                        key={dailyRecord.date}
                        className="border-[var(--border-default)]/50 border-b hover:bg-[var(--bg-tertiary)]"
                      >
                        <TableCell className="font-medium font-mono text-[var(--text-heading)] text-xs">
                          {dailyRecord.date}
                        </TableCell>
                        <TableCell className="font-mono text-emerald-700 text-xs">
                          {formatScanTime(dailyRecord.timeIn)}
                        </TableCell>
                        <TableCell className="font-mono text-amber-700 text-xs">
                          {formatScanTime(dailyRecord.timeOut)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="gray" contrast="low" size="sm">
                            {dailyRecord.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <AlcoholStatusBadge alcoholTested={dailyRecord.alcoholTested} />
                        </TableCell>
                        <TableCell className="text-[var(--text-secondary)] text-xs">
                          {dailyRecord.gateLocation ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={dailyRecord.status === 'Granted' ? 'green' : 'red'}
                              contrast="low"
                              size="sm"
                            >
                              {dailyRecord.status}
                            </Badge>
                            {dailyRecord.denialReason && (
                              <span className="rounded bg-rose-50 px-2 py-0.5 font-medium text-[11px] text-rose-700">
                                Reason: {dailyRecord.denialReason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {dailyRecord.scanCount}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </GlassCard>
          ) : (
            /* Master All-Employees Multi-Month Register Table */
            <GlassCard className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
                <h3 className="flex items-center font-semibold text-[var(--text-heading)]">
                  <Calendar className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
                  Master Employee Attendance Register
                </h3>
                <span className="text-[var(--text-muted)] text-xs">
                  Range: {DATE_RANGE_OPTIONS.find((opt) => opt.id === registerDateRange)?.label}
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--border-default)] border-b hover:bg-transparent">
                    <TableHead className="text-[var(--text-muted)]">Employee</TableHead>
                    <TableHead className="text-[var(--text-muted)]">ID & Coy #</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Days Present</TableHead>
                    <TableHead className="text-[var(--text-muted)]">First Time In</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Last Time Out</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Granted / Denied</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Alcohol Tests</TableHead>
                    <TableHead className="text-[var(--text-muted)]">Denial Reasons</TableHead>
                    <TableHead className="text-right text-[var(--text-muted)]">Record</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registerRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12 text-center text-[var(--text-muted)]">
                        No employee attendance records matched the selected period or search query.
                      </TableCell>
                    </TableRow>
                  )}

                  {registerRecords.map((empRecord) => (
                    <TableRow
                      key={empRecord.employeeId}
                      className="border-[var(--border-default)]/50 border-b hover:bg-[var(--bg-tertiary)]"
                    >
                      <TableCell>
                        <span className="block font-medium text-[var(--text-heading)] text-sm">
                          {empRecord.name}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {empRecord.jobTitle}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[var(--text-secondary)] text-xs">
                        <span className="block">ID: {empRecord.idNumber}</span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          Coy: {empRecord.coyNumber}
                        </span>
                      </TableCell>
                      <TableCell className="font-bold font-mono text-[var(--text-heading)] text-sm">
                        {empRecord.daysPresent}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatScanDateTime(empRecord.firstTimeIn)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatScanDateTime(empRecord.lastTimeOut)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="green" contrast="low" size="sm">
                            {empRecord.grantedCount}
                          </Badge>
                          <Badge
                            variant={empRecord.deniedCount > 0 ? 'red' : 'gray'}
                            contrast="low"
                            size="sm"
                          >
                            {empRecord.deniedCount} denied
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-emerald-700">
                          {empRecord.alcoholPassCount} Pass
                        </span>
                        {' / '}
                        <span
                          className={`font-medium ${
                            empRecord.alcoholFailCount > 0
                              ? 'text-rose-700'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {empRecord.alcoholFailCount} Fail
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        {empRecord.denialReasons.length > 0 ? (
                          <span className="inline-block rounded bg-rose-50 px-2 py-0.5 font-medium text-[11px] text-rose-700">
                            {empRecord.denialReasons.join('; ')}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRegisterEmployeeId(empRecord.employeeId)}
                          className="h-7 px-2 text-[11px] text-blue-600 hover:bg-blue-50"
                        >
                          Daily Record ({empRecord.dailyRecords.length})
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          )}
        </div>
      )}

      {/* Full Access Log Detail Modal */}
      <Dialog
        open={inspectedLog !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setInspectedLog(null);
        }}
      >
        <DialogContent className="max-w-xl p-6 sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
              <MapPin className="h-5 w-5 text-blue-600" />
              Access Scan Telemetry Details
            </DialogTitle>
            <DialogDescription className="text-[var(--text-muted)] text-xs">
              Complete person identification, alcohol screening, direction, and gate authorization
              record.
            </DialogDescription>
          </DialogHeader>

          {inspectedLog && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-3">
                <div>
                  <h4 className="font-bold text-[var(--text-heading)] text-base">
                    {inspectedLog.entityName}
                  </h4>
                  <p className="text-[var(--text-secondary)] text-xs">
                    {inspectedLog.jobTitle || inspectedLog.entityType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DirectionBadge direction={inspectedLog.direction} />
                  <AlcoholStatusBadge alcoholTested={inspectedLog.alcoholTested} />
                </div>
              </div>

              {!isLogRowGranted(inspectedLog) && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-rose-800 text-xs">
                  <span className="font-bold uppercase tracking-wider">Denial Reason: </span>
                  <span>
                    {inspectedLog.denialReason?.trim() || 'Access denied (no reason recorded)'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <DetailField
                  label="Scan Timestamp"
                  detailText={formatScanDateTime(inspectedLog.timestamp)}
                  mono
                />
                <DetailField label="Access Status" detailText={inspectedLog.status} />
                <DetailField
                  label="ID Number"
                  detailText={inspectedLog.idNumber ?? 'Not Recorded'}
                  mono
                />
                <DetailField
                  label="Coy Number"
                  detailText={inspectedLog.empCode ?? 'Not Applicable'}
                  mono
                />
                <DetailField label="Badge QR Code" detailText={inspectedLog.qrCodeId} mono />
                <DetailField
                  label="RFID Code"
                  detailText={inspectedLog.rfidCode ?? 'Not Recorded'}
                  mono
                />
                <DetailField label="Gate / Zone" detailText={inspectedLog.zone} />
                <DetailField label="Access Method" detailText={inspectedLog.accessMethod} />
                <DetailField
                  label="Operator"
                  detailText={inspectedLog.operator ?? 'Automated Gate'}
                />
                <DetailField
                  label="Scanner Device ID"
                  detailText={inspectedLog.deviceId ?? 'Not Recorded'}
                  mono
                />
              </div>

              {inspectedLog.personnelId && (
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const targetId = inspectedLog.personnelId ?? null;
                      setInspectedLog(null);
                      if (targetId) handleOpenEmployeeInRegister(targetId);
                    }}
                  >
                    Open Employee Attendance Register
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Easy Scanner Console Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="max-w-xl p-6 sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-xl">
              <Zap className="h-5 w-5 fill-amber-500 text-amber-500" />
              Easy Scanner Terminal
            </DialogTitle>
            <DialogDescription className="text-[var(--text-muted)] text-xs">
              Hardware barcode/RFID reader console. Scans auto-submit on Enter and immediately
              verify credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={gateSelectId} className={FIELD_LABEL_CLASS}>
                  Gate Terminal
                </label>
                <select
                  id={gateSelectId}
                  value={selectedGate}
                  onChange={(changeEvent) => setSelectedGate(changeEvent.target.value)}
                  className={SELECT_CONTROL_CLASS}
                >
                  {GATE_OPTIONS.map((gateName) => (
                    <option key={gateName} value={gateName}>
                      {gateName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className={FIELD_LABEL_CLASS}>Direction</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScanDirection('IN')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-bold text-xs transition-all ${
                      scanDirection === 'IN'
                        ? 'border border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-emerald-50'
                    }`}
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>IN (Entry)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanDirection('OUT')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-bold text-xs transition-all ${
                      scanDirection === 'OUT'
                        ? 'border border-amber-600 bg-amber-600 text-white shadow-sm'
                        : 'border border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-amber-50'
                    }`}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>OUT (Exit)</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor={barcodeInputId} className={FIELD_LABEL_CLASS}>
                Scanner Input (Barcode / RFID Wedge)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <QrCode className="absolute top-2.5 left-3 h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    id={barcodeInputId}
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan QR or RFID (e.g. BADGE-EMP-001)..."
                    value={barcodeInput}
                    onChange={(changeEvent) => setBarcodeInput(changeEvent.target.value)}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === 'Enter') {
                        keyEvent.preventDefault();
                        handleProcessScan(barcodeInput);
                      }
                    }}
                    className="w-full rounded-lg border-2 border-blue-500/50 bg-white py-2 pr-3 pl-9 font-mono text-[var(--text-heading)] text-sm shadow-inner focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => handleProcessScan(barcodeInput)}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  Verify & Log
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Keyboard-wedge 2D scanners (Chainway C66, Honeywell, Zebra) submit automatically on
                scan.
              </p>
            </div>

            <div>
              <span className={FIELD_LABEL_CLASS}>
                1-Click Quick Simulators (Pre-configured Tags)
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => {
                      setBarcodeInput(preset.code);
                      handleProcessScan(preset.code);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1 text-left text-xs transition-colors hover:border-blue-500 hover:bg-blue-50/50"
                  >
                    <span className="font-semibold text-[var(--text-heading)]">{preset.label}</span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      [{preset.code}]
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {lastScanResult && (
              <div
                className={`rounded-xl border p-4 shadow-sm ${
                  lastScanResult.accessGranted
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-rose-500/40 bg-rose-500/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white text-xl ${
                        lastScanResult.accessGranted ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      {lastScanResult.accessGranted ? (
                        <CheckCircle2 className="h-7 w-7" />
                      ) : (
                        <ShieldAlert className="h-7 w-7" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-black text-sm uppercase tracking-wider ${
                            lastScanResult.accessGranted ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {lastScanResult.accessGranted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                        </span>
                        <Badge
                          variant={lastScanResult.direction === 'IN' ? 'green' : 'amber'}
                          contrast="low"
                          size="sm"
                        >
                          {lastScanResult.direction}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-[var(--text-heading)] text-base">
                        {lastScanResult.name}
                      </h4>
                      <p className="text-[var(--text-secondary)] text-xs">
                        {lastScanResult.jobTitle || lastScanResult.entityType}{' '}
                        {lastScanResult.empCode ? `• ${lastScanResult.empCode}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    {formatScanTime(lastScanResult.scannedAt)}
                  </span>
                </div>

                {lastScanResult.denialReason && (
                  <div className="mt-3 rounded-md bg-rose-100/80 px-3 py-1.5 font-semibold text-rose-800 text-xs">
                    Denial Reason: {lastScanResult.denialReason}
                  </div>
                )}

                <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                  Gate:{' '}
                  <span className="font-medium text-[var(--text-secondary)]">
                    {lastScanResult.gateLocation}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
