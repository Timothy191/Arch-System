"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  CheckCircle2,
  XCircle,
  ShieldOff,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import type {
  ShiftCompleteness,
  MachineCoverageStatus,
} from "@/lib/shift-completeness";

interface Props {
  departmentId: string;
  departmentSlug: string;
}

function getCurrentShift(): "day" | "night" {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? "day" : "night";
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function MachineOperationsComplianceWidget({
  departmentId,
  departmentSlug,
}: Props) {
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
        <p className="text-[var(--text-muted)] text-sm text-center">
          Checking shift coverage…
        </p>
      </GlassCard>
    );
  }

  if (!data) return null;

  const { complete, totalRequired, totalCovered, statuses } = data;
  const missing = statuses.filter((s) => !s.exempt && !s.hasEntry);
  const exempt = statuses.filter((s) => s.exempt);

  const headerColor = complete
    ? "text-accent-green"
    : missing.length > 0
      ? "text-accent-red"
      : "text-[var(--text-heading)]";

  const dotColor = complete ? "bg-accent-green" : "bg-accent-red";

  return (
    <GlassCard className="space-y-0 p-0 overflow-hidden">
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
          <span className={`text-sm font-medium ${headerColor}`}>
            {complete
              ? "All machines reported"
              : `${missing.length} machine${missing.length !== 1 ? "s" : ""} missing`}
          </span>
          <span className="text-[var(--text-muted)] text-xs">
            {totalCovered} / {totalRequired} covered
            {exempt.length > 0 && ` · ${exempt.length} exempt`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          {lastRefresh && (
            <span className="text-xs hidden sm:block">
              {lastRefresh.toLocaleTimeString("en-ZA", {
                hour: "2-digit",
                minute: "2-digit",
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
            className="p-1 rounded hover:text-[var(--text-heading)] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Expanded checklist */}
      {expanded && (
        <div className="border-t border-[var(--border-default)] divide-y divide-[var(--border-default)]">
          {statuses.map((s: MachineCoverageStatus) => (
            <MachineRow
              key={s.machineId}
              status={s}
              departmentSlug={departmentSlug}
            />
          ))}
          {statuses.length === 0 && (
            <p className="px-4 py-3 text-[var(--text-muted)] text-sm text-center">
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
        <ShieldOff className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
        <span className="text-[var(--text-muted)] text-sm flex-1">
          {status.machineName}
          <span className="text-xs ml-2 text-[var(--text-muted)]">
            ({status.machineType})
          </span>
        </span>
        <span className="text-[var(--text-muted)] text-xs">Exempt</span>
      </div>
    );
  }

  if (status.hasEntry) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5">
        <CheckCircle2 className="w-4 h-4 text-accent-green shrink-0" />
        <span className="text-[var(--text-secondary)] text-sm flex-1">
          {status.machineName}
          <span className="text-xs ml-2 text-[var(--text-muted)]">
            ({status.machineType})
          </span>
        </span>
        <span className="text-accent-green text-xs">{status.formLabel}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/${departmentSlug}/${status.formPath.split("/").pop()}`)
      }
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent-red/5 transition-colors text-left group"
    >
      <XCircle className="w-4 h-4 text-accent-red shrink-0" />
      <span className="text-[var(--text-heading)] text-sm flex-1 font-medium">
        {status.machineName}
        <span className="text-xs ml-2 text-[var(--text-muted)] font-normal">
          ({status.machineType})
        </span>
      </span>
      <span className="text-accent-red text-xs group-hover:underline">
        → {status.formLabel}
      </span>
    </button>
  );
}
