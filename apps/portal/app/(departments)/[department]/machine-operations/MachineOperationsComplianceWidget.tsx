'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { getOperationalToday } from '@repo/utils';
import { getCurrentShift } from '@repo/utils/client';
import { CheckCircle2, ChevronDown, ChevronUp, RefreshCw, ShieldOff, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { MachineCoverageStatus, ShiftCompleteness } from '@/lib/shift-completeness';
import { DELAY_BUCKET_KEYS, type DelayBucketKey } from '@/lib/shift-sheet-buckets';

interface Props {
  departmentId: string;
  departmentSlug: string;
}

/**
 * Header copy for each delay bucket. Typed as a full `Record` so adding a
 * bucket to `DELAY_BUCKET_KEYS` fails type-check until it gets a column here.
 */
const DELAY_COLUMN_META: Record<DelayBucketKey, { label: string; title: string }> = {
  blasting: { label: 'Blasting', title: 'Blasting / explosive clearance hold' },
  natural: { label: 'Natural', title: 'Weather, ground conditions, visibility' },
  noOperator: { label: 'No Operator', title: 'No operator available for the machine' },
  otherProduction: { label: 'Other Prod.', title: 'Other production delay' },
  greasingStartup: {
    label: 'Greasing & Startup',
    title: 'Greasing, pre-start checks and machine startup',
  },
  maintenanceGet: {
    label: 'Maint. & GET',
    title: 'Scheduled maintenance and ground engaging tools',
  },
  breakdown: {
    label: 'Breakdown',
    title: 'Unplanned breakdown, including Engineering breakdown delays',
  },
};

const DELAY_COLUMNS: ReadonlyArray<{ key: DelayBucketKey; label: string; title: string }> =
  DELAY_BUCKET_KEYS.map((key) => ({ key, ...DELAY_COLUMN_META[key] }));

const HEADER_CELL_CLASS =
  'whitespace-nowrap px-3 py-2 font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider';
const BODY_CELL_CLASS = 'whitespace-nowrap px-3 py-2 text-xs';
const NUMERIC_CELL_CLASS = `${BODY_CELL_CLASS} text-right font-mono tabular-nums`;

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

function formatSmr(reading: number | null | undefined): string {
  if (reading === null || reading === undefined || Number.isNaN(reading)) return '—';
  return reading.toLocaleString('en-ZA', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function todayDate(): string {
  return getOperationalToday('Africa/Johannesburg');
}

export function MachineOperationsComplianceWidget({ departmentId, departmentSlug }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ShiftCompleteness | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchCompleteness = useCallback(async () => {
    setLoading(true);
    try {
      const shift = getCurrentShift();
      const date = todayDate();
      const url = `/api/control-room/shift-completeness?deptId=${departmentId}&deptSlug=${departmentSlug}&date=${date}&shift=${shift}`;
      const res = await fetch(url);
      if (res.ok) {
        const json: ShiftCompleteness = await res.json();
        setData(json);
        setLastRefresh(new Date());
        // Auto-expand if not complete
        if (!json.complete) setExpanded(true);
      }
    } finally {
      setLoading(false);
    }
  }, [departmentId, departmentSlug]);

  // Initial load + 60-second auto-refresh
  useEffect(() => {
    fetchCompleteness();
    const interval = setInterval(fetchCompleteness, 60_000);
    return () => clearInterval(interval);
  }, [fetchCompleteness]);

  if (loading && !data) {
    return (
      <GlassCard className="py-3">
        <p className="text-center text-[var(--text-muted)] text-sm">Checking shift coverage…</p>
      </GlassCard>
    );
  }

  if (!data) return null;

  const { complete, totalRequired, totalCovered, statuses } = data;
  const missing = statuses.filter((s) => !s.exempt && !s.hasEntry);
  const exempt = statuses.filter((s) => s.exempt);

  const headerColor = complete
    ? 'text-accent-green'
    : missing.length > 0
      ? 'text-accent-red'
      : 'text-[var(--text-heading)]';

  const dotColor = complete ? 'bg-accent-green' : 'bg-accent-red';

  return (
    <GlassCard className="space-y-0 overflow-hidden p-0">
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="flex w-full cursor-pointer select-none items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
      >
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />
          <span className={`font-medium text-sm ${headerColor}`}>
            {complete
              ? 'All machines reported'
              : `${missing.length} machine${missing.length !== 1 ? 's' : ''} missing`}
          </span>
          <span className="text-[var(--text-muted)] text-xs">
            {totalCovered} / {totalRequired} covered
            {exempt.length > 0 && ` · ${exempt.length} exempt`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          {lastRefresh && (
            <span className="hidden text-xs sm:block">
              {lastRefresh.toLocaleTimeString('en-ZA', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fetchCompleteness();
              router.refresh();
            }}
            title="Refresh"
            className="rounded p-1 transition-colors hover:text-[var(--text-heading)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expanded shift sheet: one row per machine, 12 reporting columns */}
      {expanded && (
        <div className="overflow-x-auto border-[var(--border-default)] border-t">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <caption className="sr-only">
              Machine operations shift sheet — operator, SMR readings, delay minutes per bucket, and
              comment for every active machine.
            </caption>
            <thead className="bg-[var(--bg-tertiary)]">
              <tr>
                <th scope="col" className={HEADER_CELL_CLASS}>
                  Machine ID
                </th>
                <th scope="col" className={HEADER_CELL_CLASS}>
                  Operator
                </th>
                <th
                  scope="col"
                  className={`${HEADER_CELL_CLASS} text-right`}
                  title="Start SMR (hours)"
                >
                  Start SMR
                </th>
                <th
                  scope="col"
                  className={`${HEADER_CELL_CLASS} text-right`}
                  title="Stop SMR (hours)"
                >
                  Stop SMR
                </th>
                {DELAY_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`${HEADER_CELL_CLASS} text-right`}
                    title={`${column.title} (minutes)`}
                  >
                    {column.label}
                  </th>
                ))}
                <th scope="col" className={HEADER_CELL_CLASS}>
                  Comment
                </th>
                <th scope="col" className={`${HEADER_CELL_CLASS} text-right`}>
                  Shift Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {statuses.map((status: MachineCoverageStatus) => (
                <SheetRow key={status.machineId} status={status} departmentSlug={departmentSlug} />
              ))}
            </tbody>
          </table>
          {statuses.length === 0 && (
            <p className="px-4 py-3 text-center text-[var(--text-muted)] text-sm">
              No active machines in this department.
            </p>
          )}
          <p className="border-[var(--border-default)] border-t px-4 py-2 text-[10px] text-[var(--text-muted)]">
            Delays in minutes, logged through machine-operation delay entries (categories: Blasting,
            Natural, No Operator, Other Production Delay, Greasing &amp; Startup, Maintenance &amp;
            GET, Breakdown). SMR in hours. Breakdown includes Engineering breakdown records.
          </p>
        </div>
      )}
    </GlassCard>
  );
}

function SheetRow({
  status,
  departmentSlug,
}: {
  status: MachineCoverageStatus;
  departmentSlug: string;
}) {
  const router = useRouter();
  const isMissing = !status.hasEntry && !status.exempt;

  return (
    <tr
      className={`transition-colors ${
        status.exempt
          ? 'opacity-60'
          : isMissing
            ? 'hover:bg-accent-red/5'
            : 'hover:bg-[var(--bg-tertiary)]'
      }`}
    >
      <th scope="row" className={`${BODY_CELL_CLASS} text-left font-medium`}>
        <span className="text-[var(--text-heading)]">{status.machineName}</span>
        <span className="ml-1.5 font-normal text-[10px] text-[var(--text-muted)]">
          ({status.machineType})
        </span>
      </th>
      <td className={`${BODY_CELL_CLASS} text-[var(--text-secondary)]`}>
        {status.operatorName ?? '—'}
      </td>
      <td className={NUMERIC_CELL_CLASS}>{formatSmr(status.smrStart)}</td>
      <td className={NUMERIC_CELL_CLASS}>{formatSmr(status.smrStop)}</td>
      {DELAY_COLUMNS.map((column) => {
        const minutes = status.delayMinutes?.[column.key] ?? 0;
        return (
          <td
            key={column.key}
            className={`${NUMERIC_CELL_CLASS} ${
              minutes > 0 ? 'text-[var(--text-heading)]' : 'text-[var(--text-muted)] opacity-50'
            }`}
          >
            {minutes > 0 ? formatMinutes(minutes) : '—'}
          </td>
        );
      })}
      <td
        className={`${BODY_CELL_CLASS} max-w-[240px] truncate text-[var(--text-secondary)]`}
        title={status.comment ?? undefined}
      >
        {status.comment ?? '—'}
      </td>
      <td className={`${BODY_CELL_CLASS} text-right`}>
        {status.exempt ? (
          <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
            <ShieldOff className="h-3.5 w-3.5" />
            Exempt
          </span>
        ) : status.hasEntry ? (
          <span className="inline-flex items-center gap-1 text-accent-green">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status.formLabel}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => router.push(`/${departmentSlug}/${status.formPath.split('/').pop()}`)}
            className="group inline-flex items-center gap-1 text-accent-red hover:underline"
          >
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="group-hover:underline">Log {status.formLabel}</span>
          </button>
        )}
      </td>
    </tr>
  );
}
