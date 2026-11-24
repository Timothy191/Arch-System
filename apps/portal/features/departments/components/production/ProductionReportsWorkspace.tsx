'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getProductionPerformanceData } from './actions';
import { ProductionForemanPdfPreview } from './ProductionForemanPdfPreview';
import { downloadProductionReportCsv } from './production-pdf-export';
import type { ProductionPerformanceData, ProductionReportTab } from './production-types';

export interface ProductionReportsWorkspaceProps {
  initialData: ProductionPerformanceData;
  initialTab?: ProductionReportTab;
  deptId: string;
}

const REPORT_TABS: ReadonlyArray<{ key: ProductionReportTab; label: string }> = [
  { key: 'foreman', label: 'Foreman Report' },
  { key: 'daily', label: 'Daily vs Delays' },
  { key: 'monthly', label: 'Monthly vs Delays' },
  { key: 'pdf-report', label: 'PDF Report' },
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

export function ProductionReportsWorkspace({
  initialData,
  initialTab = 'foreman',
  deptId,
}: ProductionReportsWorkspaceProps) {
  const [data, setData] = useState<ProductionPerformanceData>(initialData);
  const [activeTab, setActiveTab] = useState<ProductionReportTab>(
    initialTab === 'pdf-report' ? 'pdf-report' : initialTab
  );
  const [selectedMonth, setSelectedMonth] = useState(initialData.selectedMonth);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    startTransition(async () => {
      try {
        const nextData = await getProductionPerformanceData(nextMonth, deptId);
        setData(nextData);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load production report');
      }
    });
  };

  const { foremanSummary, delayGroups, dailyRows, monthlyRows } = data;
  const monthlySummary = monthlyRows[0];

  return (
    <div className="space-y-6">
      <GlassCard className="p-5 print:hidden">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 font-bold text-2xl text-[var(--text-heading)]">
                <FileText className="h-5 w-5 text-[var(--accent-blue)]" />
                Production Reports &amp; Combined Delays
              </h2>
              <Badge variant="outline" className="font-mono text-xs">
                {data.monthLabel}
              </Badge>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-xs">
              Foreman, Daily, and Monthly Production Reports correlated directly with Combined
              Delays across Pit BCM, ROM Coal, Waste, Loads, and Rollover.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select report month"
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
              onClick={() => downloadProductionReportCsv(data)}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
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
          <div role="tablist" aria-label="Production report tabs" className={SEGMENT_GROUP_CLASS}>
            {REPORT_TABS.map((tab) => {
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

      {activeTab === 'foreman' && (
        <div className="space-y-4">
          <GlassCard className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-b pb-3">
              <div>
                <h3 className="font-bold text-[var(--text-heading)] text-lg">
                  Foreman Executive Production Report — {data.monthLabel}
                </h3>
                <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                  {foremanSummary.supervisorSummary}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 font-mono text-emerald-700 text-xs"
              >
                Efficiency: {foremanSummary.productiveEfficiencyPct}%
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Pit BCM Moved
                </p>
                <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {foremanSummary.totalPitBcm.toLocaleString('en-US')} /{' '}
                  {foremanSummary.pitBcmTarget.toLocaleString('en-US')} BCM
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  ROM Coal &amp; Waste
                </p>
                <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {foremanSummary.totalCoalTonnes.toLocaleString('en-US')} t /{' '}
                  {foremanSummary.totalWasteTonnes.toLocaleString('en-US')} t
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Haul Loads &amp; Rollover
                </p>
                <p className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                  {foremanSummary.totalHaulLoads.toLocaleString('en-US')} ·{' '}
                  {foremanSummary.totalRolloverBcm.toLocaleString('en-US')} BCM
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

            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-left text-xs">
                <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]">
                  <tr>
                    <th className={TH_CLASS}>Combined Delay Group</th>
                    <th className={TH_NUM_CLASS}>Delay Hours</th>
                    <th className={TH_NUM_CLASS}>Delay Minutes</th>
                    <th className={TH_NUM_CLASS}>Share %</th>
                    <th className={TH_NUM_CLASS}>Events</th>
                    <th className={TH_NUM_CLASS}>Est. Pit BCM Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {delayGroups.map((group) => (
                    <tr key={group.key} className="hover:bg-[var(--bg-secondary)]/50">
                      <td className="px-3 py-2.5 font-semibold text-[var(--text-heading)]">
                        {group.label}
                      </td>
                      <td className={TD_NUM_CLASS}>{group.delayHours.toFixed(1)}h</td>
                      <td className={TD_NUM_CLASS}>{group.delayMinutes}</td>
                      <td className={TD_NUM_CLASS}>{group.sharePct.toFixed(1)}%</td>
                      <td className={TD_NUM_CLASS}>{group.eventCount}</td>
                      <td className={TD_NUM_CLASS}>
                        {group.estimatedPitBcmImpact.toLocaleString('en-US')} BCM
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'daily' && (
        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[var(--text-heading)] text-base">
              Daily Production vs Combined Delays Ledger ({dailyRows.length} days)
            </h3>
            <span className="font-mono text-[var(--text-muted)] text-xs">
              Daily Pit BCM Target: {data.targets.daily.pitBcmTarget.toLocaleString('en-US')} BCM
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]">
                <tr>
                  <th className={TH_CLASS}>Date</th>
                  <th className={TH_NUM_CLASS}>Pit BCM Moved</th>
                  <th className={TH_NUM_CLASS}>Haul Loads</th>
                  <th className={TH_NUM_CLASS}>Rollover BCM</th>
                  <th className={TH_NUM_CLASS}>Coal (t)</th>
                  <th className={TH_NUM_CLASS}>Waste (t)</th>
                  <th className={TH_NUM_CLASS}>Combined Delays (h)</th>
                  <th className={TH_NUM_CLASS}>Variance vs Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {dailyRows.map((row) =>
                  row.hasData ? (
                    <tr key={row.date} className="hover:bg-[var(--bg-secondary)]/50">
                      <td className="px-3 py-2.5 font-mono text-[var(--text-heading)]">
                        {row.date}
                      </td>
                      <td className={TD_NUM_CLASS}>{row.pitBcm.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.haulLoads.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.rolloverBcm.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.coalTonnes.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.wasteTonnes.toLocaleString('en-US')}</td>
                      <td className={TD_NUM_CLASS}>{row.combinedDelayHours.toFixed(1)}h</td>
                      <td className={TD_NUM_CLASS}>
                        {row.pitBcmVariance >= 0 ? '+' : ''}
                        {row.pitBcmVariance.toLocaleString('en-US')}
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.date} className="bg-[var(--bg-secondary)]/30 opacity-75">
                      <td className="px-3 py-2.5 font-mono text-[var(--text-muted)]">
                        {row.date} · No data captured
                      </td>
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

      {activeTab === 'monthly' && monthlySummary && (
        <GlassCard className="space-y-4 p-5">
          <h3 className="font-bold text-[var(--text-heading)] text-base">
            Monthly Production vs Delays Summary — {monthlySummary.monthLabel}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]">
                <tr>
                  <th className={TH_CLASS}>Metric</th>
                  <th className={TH_NUM_CLASS}>Actual</th>
                  <th className={TH_NUM_CLASS}>Monthly Target</th>
                  <th className={TH_NUM_CLASS}>Attainment / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                <tr>
                  <td className="px-3 py-2.5 font-semibold">Pit BCM Moved</td>
                  <td className={TD_NUM_CLASS}>
                    {monthlySummary.pitBcm.toLocaleString('en-US')} BCM
                  </td>
                  <td className={TD_MUTED_CLASS}>
                    {monthlySummary.pitBcmTarget.toLocaleString('en-US')} BCM
                  </td>
                  <td className={TD_NUM_CLASS}>{monthlySummary.pitBcmAttainmentPct}%</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-semibold">ROM Coal</td>
                  <td className={TD_NUM_CLASS}>
                    {monthlySummary.coalTonnes.toLocaleString('en-US')} t
                  </td>
                  <td className={TD_MUTED_CLASS}>
                    {monthlySummary.coalTarget.toLocaleString('en-US')} t
                  </td>
                  <td className={TD_NUM_CLASS}>
                    Strip Ratio {monthlySummary.stripRatio.toFixed(2)}:1
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-semibold">Overburden Waste</td>
                  <td className={TD_NUM_CLASS}>
                    {monthlySummary.wasteTonnes.toLocaleString('en-US')} t
                  </td>
                  <td className={TD_MUTED_CLASS}>
                    {monthlySummary.wasteTarget.toLocaleString('en-US')} t
                  </td>
                  <td className={TD_NUM_CLASS}>
                    {monthlySummary.wasteTarget > 0
                      ? `${((monthlySummary.wasteTonnes / monthlySummary.wasteTarget) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-semibold">Haul Loads</td>
                  <td className={TD_NUM_CLASS}>
                    {monthlySummary.haulLoads.toLocaleString('en-US')}
                  </td>
                  <td className={TD_MUTED_CLASS}>
                    {monthlySummary.loadsTarget.toLocaleString('en-US')}
                  </td>
                  <td className={TD_NUM_CLASS}>
                    {monthlySummary.loadsTarget > 0
                      ? `${((monthlySummary.haulLoads / monthlySummary.loadsTarget) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-semibold">Dozer Rollover BCM</td>
                  <td className={TD_NUM_CLASS}>
                    {monthlySummary.rolloverBcm.toLocaleString('en-US')} BCM
                  </td>
                  <td className={TD_MUTED_CLASS}>
                    {monthlySummary.rolloverTarget.toLocaleString('en-US')} BCM
                  </td>
                  <td className={TD_NUM_CLASS}>
                    {monthlySummary.rolloverTarget > 0
                      ? `${((monthlySummary.rolloverBcm / monthlySummary.rolloverTarget) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-semibold text-amber-700">Combined Delays</td>
                  <td className={TD_NUM_CLASS}>{monthlySummary.combinedDelayHours.toFixed(1)} h</td>
                  <td className={TD_MUTED_CLASS}>0.0 h baseline</td>
                  <td className={TD_NUM_CLASS}>
                    SMR {monthlySummary.smrHours.toLocaleString('en-US')}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'pdf-report' && <ProductionForemanPdfPreview data={data} />}
    </div>
  );
}
