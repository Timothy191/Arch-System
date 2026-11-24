'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { BarChart3, Download, FileText, Printer, RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getProductionPerformanceData } from './actions';
import type { ProductionPerformanceData } from './production-types';

export interface ProductionPerformanceClientProps {
  initialData: ProductionPerformanceData;
  deptId: string;
}

type PerformanceTab = 'shift' | 'daily' | 'weekly' | 'monthly' | 'foreman';

const TAB_ITEMS: ReadonlyArray<{ key: PerformanceTab; label: string }> = [
  { key: 'shift', label: 'Shift Performance' },
  { key: 'daily', label: 'Daily Performance' },
  { key: 'weekly', label: 'Weekly Performance' },
  { key: 'monthly', label: 'Monthly Performance' },
  { key: 'foreman', label: 'Foreman Report' },
];

const SEGMENT_GROUP_CLASS =
  'inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1';
const TAB_BTN_BASE = 'rounded-md px-3 py-1.5 font-medium text-xs transition';
const TAB_BTN_ACTIVE = 'bg-[var(--accent-blue)] text-white shadow-sm';
const TAB_BTN_INACTIVE =
  'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]';
const TH_CLASS =
  'px-3 py-2.5 text-left font-mono text-[11px] text-[var(--text-secondary)] uppercase';
const TH_NUM_CLASS =
  'px-3 py-2.5 text-right font-mono text-[11px] text-[var(--text-secondary)] uppercase';
const TD_NUM_CLASS = 'px-3 py-2.5 text-right font-mono text-[var(--text-heading)] text-xs';
const TD_MUTED_CLASS = 'px-3 py-2.5 text-right font-mono text-[var(--text-muted)] text-xs';
const KPI_BOX_CLASS = 'space-y-1 border border-[var(--border-subtle)] p-4';

function getAttainmentBadgeClass(pct: number): string {
  if (pct >= 95) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  if (pct >= 75) return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
  return 'border-red-500/30 bg-red-500/10 text-red-700';
}

export function ProductionPerformanceClient({
  initialData,
  deptId,
}: ProductionPerformanceClientProps) {
  const [data, setData] = useState<ProductionPerformanceData>(initialData);
  const [activeTab, setActiveTab] = useState<PerformanceTab>('shift');
  const [selectedMonth, setSelectedMonth] = useState<string>(initialData.selectedMonth);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    startTransition(async () => {
      try {
        const nextData = await getProductionPerformanceData(nextMonth, deptId);
        setData(nextData);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load production performance data'
        );
      }
    });
  };

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Status',
      'Pit BCM Moved',
      'Daily Pit BCM Target',
      'Variance (BCM)',
      'Attainment (%)',
      'ROM Coal (t)',
      'Overburden Waste (t)',
      'Haul Loads',
      'Rollover BCM',
      'SMR Hours',
      'Combined Delays (hrs)',
    ];
    const rows = data.dailyRows.map((row) => [
      row.date,
      row.hasData ? 'Captured' : 'No data captured',
      row.pitBcm,
      row.pitBcmTarget,
      row.pitBcmVariance,
      row.pitBcmAttainmentPct,
      row.coalTonnes,
      row.wasteTonnes,
      row.haulLoads,
      row.rolloverBcm,
      row.smrHours,
      row.combinedDelayHours,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-performance-${data.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.monthLabel} Performance CSV`);
  };

  const { foremanSummary } = data;
  const monthlySummary = data.monthlyRows[0];

  return (
    <div className="space-y-6">
      <GlassCard className="p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 font-bold text-2xl text-[var(--text-heading)]">
                <BarChart3 className="h-5 w-5 text-[var(--accent-blue)]" />
                Production Performance &amp; Foreman Analytics
              </h2>
              <Badge variant="outline" className="font-mono text-xs">
                {data.monthLabel}
              </Badge>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-xs">
              Shift, Daily, Weekly, and Monthly Pit BCM performance vs targets alongside Combined
              Delays and Foreman handover reporting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select performance month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={isPending}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs"
            >
              {data.availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => typeof window !== 'undefined' && window.print()}
              className="gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => handleMonthChange(selectedMonth)}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div
            role="tablist"
            aria-label="Production performance views"
            className={SEGMENT_GROUP_CLASS}
          >
            {TAB_ITEMS.map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  onClick={() => setActiveTab(tab.key)}
                  className={`${TAB_BTN_BASE} ${isSelected ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {activeTab === 'shift' && (
        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[var(--text-heading)] text-base">
              Shift Performance vs Shift Target (
              {data.targets.shift.pitBcmTarget.toLocaleString('en-US')} Pit BCM / shift)
            </h3>
            <span className="font-mono text-[var(--text-muted)] text-xs">
              {data.shiftRows.length} shift(s) logged
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]">
                <tr>
                  <th className={TH_CLASS}>Date</th>
                  <th className={TH_CLASS}>Shift</th>
                  <th className={TH_NUM_CLASS}>Pit BCM</th>
                  <th className={TH_NUM_CLASS}>Target BCM</th>
                  <th className={TH_NUM_CLASS}>Attainment</th>
                  <th className={TH_NUM_CLASS}>Coal (t)</th>
                  <th className={TH_NUM_CLASS}>Waste (t)</th>
                  <th className={TH_NUM_CLASS}>Loads</th>
                  <th className={TH_NUM_CLASS}>Rollover BCM</th>
                  <th className={TH_NUM_CLASS}>Delays (h)</th>
                  <th className={TH_NUM_CLASS}>Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.shiftRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--bg-secondary)]/50">
                    <td className="px-3 py-2.5 font-mono text-[var(--text-heading)]">{row.date}</td>
                    <td className="px-3 py-2.5 capitalize">{row.shiftType}</td>
                    <td className={TD_NUM_CLASS}>{row.pitBcm.toLocaleString('en-US')}</td>
                    <td className={TD_MUTED_CLASS}>{row.pitBcmTarget.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>
                      <Badge
                        variant="outline"
                        className={`font-mono text-[11px] ${getAttainmentBadgeClass(row.pitBcmAttainmentPct)}`}
                      >
                        {row.pitBcmAttainmentPct}%
                      </Badge>
                    </td>
                    <td className={TD_NUM_CLASS}>{row.coalTonnes.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>{row.wasteTonnes.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>{row.haulLoads.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>{row.rolloverBcm.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>{row.combinedDelayHours.toFixed(1)}h</td>
                    <td className={TD_NUM_CLASS}>{row.productiveEfficiencyPct}%</td>
                  </tr>
                ))}
                {data.shiftRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-[var(--text-muted)]">
                      No shift production records found for {data.monthLabel}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'daily' && (
        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[var(--text-heading)] text-base">
              Daily Performance — Full Month ({data.dailyRows.length} calendar days)
            </h3>
            <span className="font-mono text-[var(--text-muted)] text-xs">
              Daily Target: {data.targets.daily.pitBcmTarget.toLocaleString('en-US')} Pit BCM
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]">
                <tr>
                  <th className={TH_CLASS}>Date</th>
                  <th className={TH_NUM_CLASS}>Pit BCM</th>
                  <th className={TH_NUM_CLASS}>Target BCM</th>
                  <th className={TH_NUM_CLASS}>Variance</th>
                  <th className={TH_NUM_CLASS}>Attainment</th>
                  <th className={TH_NUM_CLASS}>Coal (t)</th>
                  <th className={TH_NUM_CLASS}>Waste (t)</th>
                  <th className={TH_NUM_CLASS}>Loads</th>
                  <th className={TH_NUM_CLASS}>Rollover</th>
                  <th className={TH_NUM_CLASS}>Delays (h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.dailyRows.map((row) =>
                  row.hasData ? (
                    <tr key={row.date} className="hover:bg-[var(--bg-secondary)]/50">
                      <td className="px-3 py-2.5 font-mono text-[var(--text-heading)]">
                        {row.date}
                      </td>
                      <td className={TD_NUM_CLASS}>{row.pitBcm.toLocaleString('en-US')}</td>
                      <td className={TD_MUTED_CLASS}>{row.pitBcmTarget.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>
                        {row.pitBcmVariance >= 0 ? '+' : ''}
                        {row.pitBcmVariance.toLocaleString('en-US')}
                      </td>
                      <td className={TD_NUM_CLASS}>{row.pitBcmAttainmentPct}%</td>
                      <td className={TD_NUM_CLASS}>{row.coalTonnes.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.wasteTonnes.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.haulLoads.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.rolloverBcm.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.combinedDelayHours.toFixed(1)}h</td>
                    </tr>
                  ) : (
                    <tr key={row.date} className="bg-[var(--bg-secondary)]/30 opacity-75">
                      <td className="px-3 py-2.5 font-mono text-[var(--text-muted)]">
                        {row.date} · No data captured
                      </td>
                      <td className={TD_MUTED_CLASS}>—</td>
                      <td className={TD_MUTED_CLASS}>{row.pitBcmTarget.toLocaleString('en-US')}</td>
                      <td className={TD_MUTED_CLASS}>—</td>
                      <td className={TD_MUTED_CLASS}>—</td>
                      <td className={TD_MUTED_CLASS}>—</td>
                      <td className={TD_MUTED_CLASS}>—</td>
                      <td className={TD_MUTED_CLASS}>—</td>
                      <td className={TD_MUTED_CLASS}>—</td>
                      <td className={TD_MUTED_CLASS}>—</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'weekly' && (
        <GlassCard className="space-y-4 p-5">
          <h3 className="font-bold text-[var(--text-heading)] text-base">
            Weekly Performance vs Weekly Target (
            {data.targets.weekly.pitBcmTarget.toLocaleString('en-US')} Pit BCM / week)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]">
                <tr>
                  <th className={TH_CLASS}>Week</th>
                  <th className={TH_CLASS}>Dates</th>
                  <th className={TH_NUM_CLASS}>Active Days</th>
                  <th className={TH_NUM_CLASS}>Pit BCM</th>
                  <th className={TH_NUM_CLASS}>Target BCM</th>
                  <th className={TH_NUM_CLASS}>Attainment</th>
                  <th className={TH_NUM_CLASS}>Coal (t)</th>
                  <th className={TH_NUM_CLASS}>Waste (t)</th>
                  <th className={TH_NUM_CLASS}>Loads</th>
                  <th className={TH_NUM_CLASS}>Delays (h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.weeklyRows.map((wk) => (
                  <tr key={wk.weekLabel} className="hover:bg-[var(--bg-secondary)]/50">
                    <td className="px-3 py-2.5 font-semibold text-[var(--text-heading)]">
                      {wk.weekLabel}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[var(--text-muted)]">
                      {wk.dateRangeLabel}
                    </td>
                    <td className={TD_NUM_CLASS}>{wk.daysCaptured}</td>
                    <td className={TD_NUM_CLASS}>{wk.pitBcm.toLocaleString('en-US')}</td>
                    <td className={TD_MUTED_CLASS}>{wk.pitBcmTarget.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>{wk.pitBcmAttainmentPct}%</td>
                    <td className={TD_NUM_CLASS}>{wk.coalTonnes.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>{wk.wasteTonnes.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>{wk.haulLoads.toLocaleString('en-US')}</td>
                    <td className={TD_NUM_CLASS}>{wk.combinedDelayHours.toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'monthly' && monthlySummary && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GlassCard className={KPI_BOX_CLASS}>
              <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase">
                Monthly Pit BCM
              </p>
              <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
                {monthlySummary.pitBcm.toLocaleString('en-US')} BCM
              </p>
              <p className="text-[var(--text-secondary)] text-xs">
                Target: {monthlySummary.pitBcmTarget.toLocaleString('en-US')} BCM (
                {monthlySummary.pitBcmAttainmentPct}%)
              </p>
            </GlassCard>

            <GlassCard className={KPI_BOX_CLASS}>
              <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase">
                ROM Coal / Waste
              </p>
              <p className="font-bold font-mono text-2xl text-emerald-700">
                {monthlySummary.coalTonnes.toLocaleString('en-US')} t
              </p>
              <p className="text-[var(--text-secondary)] text-xs">
                Waste: {monthlySummary.wasteTonnes.toLocaleString('en-US')} t · Strip{' '}
                {monthlySummary.stripRatio.toFixed(2)}:1
              </p>
            </GlassCard>

            <GlassCard className={KPI_BOX_CLASS}>
              <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase">
                Loads &amp; Rollover
              </p>
              <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
                {monthlySummary.haulLoads.toLocaleString('en-US')}
              </p>
              <p className="text-[var(--text-secondary)] text-xs">
                Rollover: {monthlySummary.rolloverBcm.toLocaleString('en-US')} /{' '}
                {monthlySummary.rolloverTarget.toLocaleString('en-US')} BCM
              </p>
            </GlassCard>

            <GlassCard className={KPI_BOX_CLASS}>
              <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase">
                Combined Delays
              </p>
              <p className="font-bold font-mono text-2xl text-amber-700">
                {monthlySummary.combinedDelayHours.toFixed(1)} hrs
              </p>
              <p className="text-[var(--text-secondary)] text-xs">
                SMR Hours: {monthlySummary.smrHours.toLocaleString('en-US')} /{' '}
                {monthlySummary.smrHoursTarget.toLocaleString('en-US')}h
              </p>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'foreman' && (
        <div className="space-y-4">
          <GlassCard className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-b pb-3">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
                  <FileText className="h-4 w-4 text-[var(--accent-blue)]" />
                  Foreman Shift &amp; Operations Report — {data.monthLabel}
                </h3>
                <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                  {foremanSummary.supervisorSummary}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 font-mono text-emerald-700 text-xs"
              >
                Productive Efficiency: {foremanSummary.productiveEfficiencyPct}%
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Pit BCM vs Target
                </p>
                <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {foremanSummary.totalPitBcm.toLocaleString('en-US')} /{' '}
                  {foremanSummary.pitBcmTarget.toLocaleString('en-US')} BCM
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Haul Loads &amp; Rollover
                </p>
                <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {foremanSummary.totalHaulLoads.toLocaleString('en-US')} loads ·{' '}
                  {foremanSummary.totalRolloverBcm.toLocaleString('en-US')} BCM
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Fleet SMR Hours
                </p>
                <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {foremanSummary.totalSmrHours.toLocaleString('en-US')} hrs
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Combined Delays
                </p>
                <p className="mt-0.5 font-bold font-mono text-amber-700 text-sm">
                  {foremanSummary.totalCombinedDelayHours.toFixed(1)} hrs
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] p-4">
              <h4 className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                Pit Bench Progress
              </h4>
              <p className="mt-1 text-[var(--text-secondary)] text-xs">
                {foremanSummary.pitBenchProgress}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-subtle)] p-4">
                <h4 className="mb-2 font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                  Combined Delay Breakdown
                </h4>
                <div className="space-y-2">
                  {foremanSummary.delayGroups.map((grp) => (
                    <div key={grp.key} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--text-heading)]">{grp.label}</span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {grp.delayHours.toFixed(1)}h ({grp.sharePct}%) · Est.{' '}
                        {grp.estimatedPitBcmImpact.toLocaleString('en-US')} BCM
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] p-4">
                <h4 className="mb-2 font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                  Key Variances &amp; Handover Notes
                </h4>
                <ul className="space-y-1.5 text-[var(--text-secondary)] text-xs">
                  {foremanSummary.keyVariances.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                  {foremanSummary.handoverNotes.map((note) => (
                    <li key={note} className="text-[var(--text-heading)]">
                      → {note}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
