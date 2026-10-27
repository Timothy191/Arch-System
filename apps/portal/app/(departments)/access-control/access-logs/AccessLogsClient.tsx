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
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Filter,
  LogIn,
  LogOut,
  MapPin,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  executeEasyScan,
  getAccessLogsWithFilters,
  getEmployeeAttendanceSummary,
} from '../actions';
import type { EmployeeAttendanceSummary } from '../actions/badges';

// Named constants adhering to code-quality rules
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const HUNDRED_PERCENT = 100;
const AUDIO_FREQUENCY_GRANTED = 880;
const AUDIO_FREQUENCY_DENIED = 220;
const AUDIO_TONE_DURATION_SECONDS = 0.15;

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

export interface ResolvedAccessLog {
  readonly id: string;
  readonly timestamp: string;
  readonly entityName: string;
  readonly entityType: string;
  readonly personnelId?: string | null;
  readonly qrCodeId: string;
  readonly zone: string;
  readonly accessMethod: string;
  readonly status: string;
  readonly denialReason?: string | null;
  readonly direction: string;
}

export interface PersonnelFilterOption {
  readonly id: string;
  readonly name: string;
  readonly empCode: string;
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

export function AccessLogsClient({
  initialLogs,
  initialTotalCount,
  personnelList,
  initialEmployeeId = null,
  initialAttendanceSummary = null,
}: AccessLogsClientProps) {
  const [logs, setLogs] = useState<readonly ResolvedAccessLog[]>(initialLogs);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);
  const [currentPage, setCurrentPage] = useState<number>(DEFAULT_PAGE);

  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialEmployeeId);
  const [attendanceSummary, setAttendanceSummary] = useState<EmployeeAttendanceSummary | null>(
    initialAttendanceSummary
  );
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'GRANTED' | 'DENIED'>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');

  // Scanner modal state
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
  const barcodeInputId = useId();
  const gateSelectId = useId();

  // Focus barcode input when scanner modal opens
  useEffect(() => {
    if (isScannerOpen) {
      const timer = setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isScannerOpen]);

  // Refresh logs and attendance summary
  const fetchUpdatedLogs = useCallback(
    async (
      overrideEmployeeId?: string | null,
      overridePage?: number,
      overrideSearch?: string,
      overrideDirection?: 'ALL' | 'IN' | 'OUT',
      overrideStatus?: 'ALL' | 'GRANTED' | 'DENIED',
      overrideDateRange?: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL'
    ) => {
      const activeEmployeeId =
        overrideEmployeeId !== undefined ? overrideEmployeeId : selectedEmployeeId;
      const targetPage = overridePage ?? currentPage;
      const targetSearch = overrideSearch !== undefined ? overrideSearch : searchKeyword;
      const targetDirection = overrideDirection ?? directionFilter;
      const targetStatus = overrideStatus ?? statusFilter;
      const targetDateRange = overrideDateRange ?? dateRangeFilter;

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
          });

          const mappedRecords: ResolvedAccessLog[] = (
            fetchResult.logs as unknown as Array<{
              id: string;
              scanned_at: string;
              gate_location: string;
              access_granted: boolean;
              denial_reason: string | null;
              access_type: string;
              direction: string;
              badge?: {
                id: string;
                qr_code: string;
                rfid_code: string | null;
                entity_type: string;
                personnel?: { id: string; first_name: string; surname: string } | null;
                visitor?: { first_name: string; surname: string } | null;
              } | null;
            }>
          ).map((rawLog) => {
            const badgeRef = rawLog.badge;
            let resolvedName = 'Unknown Entity';
            let resolvedType = badgeRef?.entity_type ?? 'Unknown';
            let personnelIdentifier: string | null = null;

            if (badgeRef?.personnel) {
              resolvedName = `${badgeRef.personnel.first_name} ${badgeRef.personnel.surname}`;
              resolvedType = 'Employee';
              personnelIdentifier = badgeRef.personnel.id;
            } else if (badgeRef?.visitor) {
              resolvedName = `${badgeRef.visitor.first_name} ${badgeRef.visitor.surname}`;
              resolvedType = 'Visitor';
            }

            let statusLabel = rawLog.access_granted ? 'Granted' : 'Denied';
            if (!rawLog.access_granted && rawLog.denial_reason) {
              if (rawLog.denial_reason.toLowerCase().includes('expired')) {
                statusLabel = 'Expired Credential';
              } else if (rawLog.denial_reason.toLowerCase().includes('tailgate')) {
                statusLabel = 'Tailgate Alert';
              }
            }

            return {
              id: rawLog.id,
              timestamp: rawLog.scanned_at,
              entityName: resolvedName,
              entityType: resolvedType,
              personnelId: personnelIdentifier,
              qrCodeId: badgeRef?.qr_code ?? badgeRef?.rfid_code ?? 'N/A',
              zone: rawLog.gate_location,
              accessMethod: rawLog.access_type ?? 'QR Scan',
              status: statusLabel,
              denialReason: rawLog.denial_reason,
              direction: rawLog.direction,
            };
          });

          setLogs(mappedRecords);
          setTotalCount(fetchResult.totalCount);

          // Update attendance dossier if employee is selected
          if (activeEmployeeId) {
            const summaryResult = await getEmployeeAttendanceSummary(activeEmployeeId);
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
    [selectedEmployeeId, currentPage, searchKeyword, directionFilter, statusFilter, dateRangeFilter]
  );

  // Handle employee filter selection
  const handleSelectEmployee = (personnelId: string | null) => {
    setSelectedEmployeeId(personnelId);
    setCurrentPage(DEFAULT_PAGE);
    fetchUpdatedLogs(personnelId, DEFAULT_PAGE);
  };

  // Clear all filters
  const handleResetFilters = () => {
    setSelectedEmployeeId(null);
    setSearchKeyword('');
    setDirectionFilter('ALL');
    setStatusFilter('ALL');
    setDateRangeFilter('ALL');
    setCurrentPage(DEFAULT_PAGE);
    fetchUpdatedLogs(null, DEFAULT_PAGE, '', 'ALL', 'ALL', 'ALL');
  };

  // Execute quick scan
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

      // Refresh logs table
      await fetchUpdatedLogs();
    } catch (scanError: unknown) {
      const errorMessage = scanError instanceof Error ? scanError.message : 'Scan failed';
      toast.error(errorMessage);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Scan Launcher */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">
            Access Logs & Attendance Register
          </h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Real-time biometric and RFID scan history, employee clock-in registers, and hardware
            scanner verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Employee Attendance Register Dossier Card */}
      {attendanceSummary && (
        <GlassCard variant="window" className="border-blue-500/30 bg-blue-500/5 p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-[var(--border-default)]/50 border-b pb-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 font-bold text-blue-700 text-lg">
                {attendanceSummary.employee.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--text-heading)] text-lg">
                    {attendanceSummary.employee.name}
                  </h3>
                  <Badge variant="blue" contrast="low" size="sm">
                    {attendanceSummary.employee.empCode}
                  </Badge>
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

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-[var(--border-default)]/50 bg-white/60 p-3">
              <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <LogIn className="h-3 w-3 text-emerald-600" />
                First In (Clock-In)
              </span>
              <p className="mt-1 font-bold font-mono text-[var(--text-heading)] text-sm">
                {attendanceSummary.firstInToday
                  ? new Date(attendanceSummary.firstInToday).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })
                  : 'No clock-in'}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-default)]/50 bg-white/60 p-3">
              <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <LogOut className="h-3 w-3 text-amber-600" />
                Last Out (Clock-Out)
              </span>
              <p className="mt-1 font-bold font-mono text-[var(--text-heading)] text-sm">
                {attendanceSummary.lastOutToday
                  ? new Date(attendanceSummary.lastOutToday).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })
                  : attendanceSummary.currentPresence === 'ON_SITE'
                    ? 'Active On Shift'
                    : 'N/A'}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-default)]/50 bg-white/60 p-3">
              <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <Clock className="h-3 w-3 text-blue-600" />
                Time On Site
              </span>
              <p className="mt-1 font-bold text-[var(--text-heading)] text-sm">
                {attendanceSummary.totalHoursToday}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-default)]/50 bg-white/60 p-3">
              <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <QrCode className="h-3 w-3 text-purple-600" />
                Today&apos;s Scans
              </span>
              <p className="mt-1 font-bold text-[var(--text-heading)] text-sm">
                {attendanceSummary.todayScansCount} events
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-default)]/50 bg-white/60 p-3">
              <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <MapPin className="h-3 w-3 text-slate-600" />
                Last Gate Used
              </span>
              <p
                className="mt-1 truncate font-medium text-[var(--text-heading)] text-xs"
                title={attendanceSummary.lastGateLocation ?? 'None'}
              >
                {attendanceSummary.lastGateLocation ?? 'None recorded'}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-default)]/50 bg-white/60 p-3">
              <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <ShieldCheck className="h-3 w-3 text-teal-600" />
                Compliance Rate
              </span>
              <p className="mt-1 font-bold text-emerald-700 text-sm">
                {attendanceSummary.complianceRate}%
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Filter and Query Control Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            {/* Employee Selector Dropdown */}
            <div className="md:col-span-5">
              <label
                htmlFor={employeeSelectId}
                className="mb-1 block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider"
              >
                Filter by Employee (Attendance Dossier)
              </label>
              <div className="relative">
                <select
                  id={employeeSelectId}
                  value={selectedEmployeeId ?? ''}
                  onChange={(changeEvent) => {
                    const chosenId = changeEvent.target.value || null;
                    handleSelectEmployee(chosenId);
                  }}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-[var(--text-heading)] text-sm shadow-2xs transition-colors focus:border-blue-500 focus:outline-none"
                >
                  <option value="">
                    All Personnel & Entities ({personnelList.length} registered)
                  </option>
                  {personnelList.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} ({person.empCode}) - {person.jobTitle}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Keyword Search Input */}
            <div className="md:col-span-5">
              <label
                htmlFor={searchInputId}
                className="mb-1 block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider"
              >
                Search Scans (Name, RFID, Gate, Badge)
              </label>
              <div className="relative">
                <Search className="absolute top-2.5 left-3 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  id={searchInputId}
                  type="text"
                  placeholder="Filter by keyword..."
                  value={searchKeyword}
                  onChange={(changeEvent) => {
                    const queryText = changeEvent.target.value;
                    setSearchKeyword(queryText);
                    fetchUpdatedLogs(selectedEmployeeId, DEFAULT_PAGE, queryText);
                  }}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-white py-2 pr-3 pl-9 text-[var(--text-heading)] text-sm shadow-2xs transition-colors focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Reset Action */}
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
              {/* Direction Pills */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--text-muted)]">Direction:</span>
                {(['ALL', 'IN', 'OUT'] as const).map((directionOption) => (
                  <button
                    key={directionOption}
                    type="button"
                    onClick={() => {
                      setDirectionFilter(directionOption);
                      fetchUpdatedLogs(
                        selectedEmployeeId,
                        DEFAULT_PAGE,
                        undefined,
                        directionOption
                      );
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

              {/* Status Pills */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--text-muted)]">Status:</span>
                {(['ALL', 'GRANTED', 'DENIED'] as const).map((statusOption) => (
                  <button
                    key={statusOption}
                    type="button"
                    onClick={() => {
                      setStatusFilter(statusOption);
                      fetchUpdatedLogs(
                        selectedEmployeeId,
                        DEFAULT_PAGE,
                        undefined,
                        undefined,
                        statusOption
                      );
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

              {/* Date Range Pills */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--text-muted)]">Range:</span>
                {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map((dateOption) => (
                  <button
                    key={dateOption}
                    type="button"
                    onClick={() => {
                      setDateRangeFilter(dateOption);
                      fetchUpdatedLogs(
                        selectedEmployeeId,
                        DEFAULT_PAGE,
                        undefined,
                        undefined,
                        undefined,
                        dateOption
                      );
                    }}
                    className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                      dateRangeFilter === dateOption
                        ? 'bg-slate-700 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {dateOption}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[var(--text-muted)] text-xs">
              Showing <span className="font-bold text-[var(--text-heading)]">{logs.length}</span> of{' '}
              <span className="font-bold text-[var(--text-heading)]">{totalCount}</span> events
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
          <span className="text-[var(--text-muted)] text-xs">{totalCount} total entries</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-[var(--border-default)] border-b hover:bg-transparent">
              <TableHead className="text-[var(--text-muted)]">Time</TableHead>
              <TableHead className="text-[var(--text-muted)]">Entity</TableHead>
              <TableHead className="text-[var(--text-muted)]">Type</TableHead>
              <TableHead className="text-[var(--text-muted)]">QR / RFID Tag</TableHead>
              <TableHead className="text-[var(--text-muted)]">Gate Location</TableHead>
              <TableHead className="text-[var(--text-muted)]">Direction</TableHead>
              <TableHead className="text-right text-[var(--text-muted)]">Access Status</TableHead>
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

            {logs.map((logEntry) => (
              <TableRow
                key={logEntry.id}
                className="border-[var(--border-default)]/50 border-b transition-colors hover:bg-[var(--bg-tertiary)]"
              >
                <TableCell className="font-mono text-[var(--text-secondary)] text-xs">
                  {new Date(logEntry.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                  <span className="block text-[10px] text-[var(--text-muted)]">
                    {new Date(logEntry.timestamp).toLocaleDateString()}
                  </span>
                </TableCell>

                <TableCell className="font-medium text-[var(--text-heading)]">
                  <div className="flex items-center gap-2.5">
                    <AvatarWithIcon
                      size={24}
                      letter={logEntry.entityName
                        .replace(/[^A-Za-z0-9]/g, '')
                        .slice(0, 2)
                        .toUpperCase()}
                      title={logEntry.entityName}
                      icon={
                        logEntry.status === 'Granted' ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        )
                      }
                      iconBackground
                    />
                    <span>{logEntry.entityName}</span>
                  </div>
                </TableCell>

                <TableCell className="text-[var(--text-secondary)] text-xs capitalize">
                  {logEntry.entityType}
                </TableCell>

                <TableCell className="font-mono text-[var(--accent-blue)] text-xs">
                  {logEntry.qrCodeId}
                </TableCell>

                <TableCell className="text-[var(--text-secondary)] text-xs">
                  {logEntry.zone}
                </TableCell>

                <TableCell className="text-xs">
                  {logEntry.direction === 'IN' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 text-xs">
                      <ArrowDownLeft className="h-3 w-3" />
                      IN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-700 text-xs">
                      <ArrowUpRight className="h-3 w-3" />
                      OUT
                    </span>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  {logEntry.status === 'Granted' ? (
                    <Badge variant="green" contrast="low" size="sm">
                      Granted
                    </Badge>
                  ) : logEntry.status === 'Denied' ? (
                    <Badge
                      variant="red"
                      contrast="low"
                      size="sm"
                      title={logEntry.denialReason ?? 'Access Denied'}
                    >
                      Denied
                    </Badge>
                  ) : logEntry.status === 'Expired Credential' ? (
                    <Badge variant="amber" contrast="low" size="sm">
                      Expired
                    </Badge>
                  ) : (
                    <Badge variant="gray" contrast="low" size="sm">
                      {logEntry.status}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-right">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="border-[var(--border-default)] border-t p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={(targetPageNumber) => {
                setCurrentPage(targetPageNumber);
                fetchUpdatedLogs(selectedEmployeeId, targetPageNumber);
              }}
            />
          </div>
        )}
      </GlassCard>

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
            {/* Gate and Direction Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={gateSelectId}
                  className="mb-1 block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Gate Terminal
                </label>
                <select
                  id={gateSelectId}
                  value={selectedGate}
                  onChange={(changeEvent) => setSelectedGate(changeEvent.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-[var(--text-heading)] text-xs shadow-2xs"
                >
                  {GATE_OPTIONS.map((gateName) => (
                    <option key={gateName} value={gateName}>
                      {gateName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-1 block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                  Direction
                </span>
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

            {/* Hardware Scanner Barcode Input */}
            <div>
              <label
                htmlFor={barcodeInputId}
                className="mb-1 block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider"
              >
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
                    className="w-full rounded-lg border-2 border-blue-500/50 bg-white py-2 pr-3 pl-9 font-mono text-[var(--text-heading)] text-sm shadow-inner transition-colors focus:border-blue-600 focus:outline-none"
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

            {/* Quick 1-Click Simulation Chips */}
            <div>
              <span className="mb-1.5 block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
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

            {/* Live Scan Result Confirmation Card */}
            {lastScanResult && (
              <div
                className={`fade-in zoom-in-95 animate-in rounded-xl border p-4 shadow-sm transition-all ${
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
                    {new Date(lastScanResult.scannedAt).toLocaleTimeString()}
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
