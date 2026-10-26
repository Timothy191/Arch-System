'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Layers,
  Moon,
  Radio,
  Sun,
  Truck,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import type { ReportsKpiStats, ShiftCoverageMissingItem } from './reports-types';

interface ReportsKpiSummarySectionProps {
  departmentName: string;
  currentShift: 'day' | 'night';
  todayStr: string;
  queryWarnings: string[];
  kpiStats: ReportsKpiStats;
  coveredFleetCount: number;
  totalFleetCount: number;
  missingCoverage: ShiftCoverageMissingItem[];
  showMissingMachines: boolean;
  onToggleMissingMachines: () => void;
  onCloseMissingMachines: () => void;
}

export function ReportsKpiSummarySection({
  departmentName,
  currentShift,
  todayStr,
  queryWarnings,
  kpiStats,
  coveredFleetCount,
  totalFleetCount,
  missingCoverage,
  showMissingMachines,
  onToggleMissingMachines,
  onCloseMissingMachines,
}: ReportsKpiSummarySectionProps) {
  return (
    <>
      {queryWarnings.length > 0 && (
        <div
          role="alert"
          data-testid="reports-query-warning-banner"
          className="no-print flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-800 text-xs"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Partial Data Warning — Database Query Issue</p>
            <p className="mt-0.5 font-mono text-[11px]">{queryWarnings.join(' · ')}</p>
          </div>
        </div>
      )}

      {/* Executive & Operator Live Header */}
      <GlassCard className="no-print p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">
                {departmentName} Reports &amp; Live Intelligence
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-2.5 py-0.5 font-semibold text-accent-green text-xs">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                Live Telemetry &amp; Logs
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                {currentShift === 'day' ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
                Active Shift: {currentShift.toUpperCase()} ({todayStr})
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Live Stats KPI Grid with Visual Indicators */}
      <div className="no-print grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* 1. Total Volume Moved (BCM) */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Total Volume (BCM)
              </span>
              <Layers className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {Number(kpiStats.totalBcm.toFixed(1)).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full bg-[var(--accent-blue)] transition-all"
                style={{
                  width: `${kpiStats.totalBcm > 0 ? Math.round((kpiStats.totalHaulBcm / kpiStats.totalBcm) * 100) : 50}%`,
                }}
              />
              <div
                className="h-full bg-accent-green transition-all"
                style={{
                  width: `${kpiStats.totalBcm > 0 ? Math.round((kpiStats.totalDozerBcm / kpiStats.totalBcm) * 100) : 50}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Haul: {Number(kpiStats.totalHaulBcm.toFixed(0)).toLocaleString()}</span>
              <span>Roll-over: {Number(kpiStats.totalDozerBcm.toFixed(0)).toLocaleString()}</span>
            </div>
          </div>
        </GlassCard>

        {/* 2. Haul Loads */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Total Haul Loads</span>
              <Truck className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--accent-blue)]">
              {kpiStats.totalLoads.toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Today&apos;s Loads:</span>
            <span className="font-mono font-semibold text-[var(--text-heading)]">
              {kpiStats.todayLoads.toLocaleString()} loads
            </span>
          </div>
        </GlassCard>

        {/* 3. Operating Hours & Efficiency */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Operating Hours</span>
              <Clock className="h-4 w-4 text-accent-green" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-accent-green">
              {kpiStats.totalHours.toFixed(1)}h
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Efficiency Rate:</span>
            <span className="font-mono font-semibold text-[var(--accent-blue)]">
              {kpiStats.bcmPerHour.toFixed(1)} BCM/h
            </span>
          </div>
        </GlassCard>

        {/* 4. Dozer Roll-over Fixed Calculation */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Dozer Roll-over (250/h)
              </span>
              <BarChart3 className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {Number(kpiStats.totalDozerBcm.toFixed(1)).toLocaleString()}{' '}
              <span className="font-normal text-[var(--text-muted)] text-xs">BCM</span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Blade Passes:</span>
            <span className="font-mono font-semibold text-[var(--text-heading)]">
              {kpiStats.totalPasses.toLocaleString()}
            </span>
          </div>
        </GlassCard>

        {/* 5. Delays & Engineering Health */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Delays &amp; Breakdowns
              </span>
              <Wrench className="h-4 w-4 text-accent-red" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {kpiStats.totalDelayMin.toLocaleString()}{' '}
              <span className="font-normal text-[var(--text-muted)] text-xs">min</span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="font-medium text-accent-red">{kpiStats.openIssues} Open</span>
            <span className="font-medium text-accent-green">
              {kpiStats.resolvedIssues} Resolved
            </span>
          </div>
        </GlassCard>

        {/* 6. Shift Coverage Completeness */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Shift Coverage</span>
              <Activity className="h-4 w-4 text-accent-green" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
                {kpiStats.coveragePct}%
              </p>
              <span className="text-[var(--text-muted)] text-xs">
                {coveredFleetCount}/{totalFleetCount} units
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className={`h-full transition-all ${
                  kpiStats.coveragePct === 100 ? 'bg-accent-green' : 'bg-[var(--accent-blue)]'
                }`}
                style={{ width: `${kpiStats.coveragePct}%` }}
              />
            </div>
            {missingCoverage.length > 0 ? (
              <button
                type="button"
                onClick={onToggleMissingMachines}
                className="w-full text-left text-[11px] text-[var(--accent-blue)] hover:underline"
              >
                {showMissingMachines
                  ? 'Hide pending machines'
                  : `${missingCoverage.length} pending shift entries →`}
              </button>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-accent-green">
                <CheckCircle2 className="h-3 w-3" /> All machines logged
              </span>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Optional Expandable Pending Shift Coverage Drawer (Non-blocking!) */}
      {showMissingMachines && missingCoverage.length > 0 && (
        <GlassCard className="no-print space-y-3 border-[var(--accent-blue)]/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--accent-blue)]" />
              <p className="font-medium text-[var(--text-heading)] text-sm">
                Pending Shift Entries ({missingCoverage.length} machines for {currentShift} shift)
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseMissingMachines}
              className="text-[var(--text-muted)] text-xs hover:text-[var(--text-heading)]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {missingCoverage.map((s) => (
              <div
                key={s.machineId}
                className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2"
              >
                <div>
                  <p className="font-medium text-[var(--text-heading)] text-xs">{s.machineName}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{s.machineType}</p>
                </div>
                <Link
                  href={s.formPath}
                  className="font-medium text-[var(--accent-blue)] text-xs hover:underline"
                >
                  Log →
                </Link>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </>
  );
}
