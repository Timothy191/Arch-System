'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { getCurrentShift } from '@repo/utils/client';
import { CheckCircle2, ChevronDown, ChevronUp, RefreshCw, ShieldOff, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { MachineCoverageStatus, ShiftCompleteness } from '@/lib/shift-completeness';

interface Props {
  departmentId: string;
  departmentSlug: string;
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0]!;
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

      {/* Expanded checklist */}
      {expanded && (
        <div className="divide-y divide-[var(--border-default)] border-[var(--border-default)] border-t">
          {statuses.map((s: MachineCoverageStatus) => (
            <MachineRow key={s.machineId} status={s} departmentSlug={departmentSlug} />
          ))}
          {statuses.length === 0 && (
            <p className="px-4 py-3 text-center text-[var(--text-muted)] text-sm">
              No active machines in this department.
            </p>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function MachineRow({
  status,
  departmentSlug,
}: {
  status: MachineCoverageStatus;
  departmentSlug: string;
}) {
  const router = useRouter();

  if (status.exempt) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 opacity-50">
        <ShieldOff className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <span className="flex-1 text-[var(--text-muted)] text-sm">
          {status.machineName}
          <span className="ml-2 text-[var(--text-muted)] text-xs">({status.machineType})</span>
        </span>
        <span className="text-[var(--text-muted)] text-xs">Exempt</span>
      </div>
    );
  }

  if (status.hasEntry) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-green" />
        <span className="flex-1 text-[var(--text-secondary)] text-sm">
          {status.machineName}
          <span className="ml-2 text-[var(--text-muted)] text-xs">({status.machineType})</span>
        </span>
        <span className="text-accent-green text-xs">{status.formLabel}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push(`/${departmentSlug}/${status.formPath.split('/').pop()}`)}
      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent-red/5"
    >
      <XCircle className="h-4 w-4 shrink-0 text-accent-red" />
      <span className="flex-1 font-medium text-[var(--text-heading)] text-sm">
        {status.machineName}
        <span className="ml-2 font-normal text-[var(--text-muted)] text-xs">
          ({status.machineType})
        </span>
      </span>
      <span className="text-accent-red text-xs group-hover:underline">→ {status.formLabel}</span>
    </button>
  );
}
