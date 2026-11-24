import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { GlassCard } from '@repo/ui/GlassCard';
import type { KPIColor } from '@repo/ui/KPI';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Scale,
  ShieldAlert,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { ExportButton } from '@/features/analytics/components/ExportButton';
import { PDFDownloadButton } from '@/features/analytics/components/PDFDownloadButton';
import { classifyReconciliationDrift, RECONCILIATION_UI } from '@/lib/production-reconciliation';
import { ExecutiveCharts } from './ExecutiveChartsLazy';
import { ExecutiveGaugePanel } from './ExecutiveGauge';
import { getExecutiveData } from './executive-data';
import { buildExportRows, buildPdfReport } from './executive-export';
import {
  EM_DASH,
  formatDelta,
  formatNumber,
  formatPercent,
  formatRatio,
  formatTonnes,
} from './executive-format';
import { buildGaugeSpecs } from './executive-gauges';

const FLEET_GREEN_THRESHOLD = 80;
const FLEET_WARN_THRESHOLD = 60;
const BREAKDOWN_RED_THRESHOLD = 5;
const BREAKDOWN_WARN_THRESHOLD = 2;
const RATE_DECIMALS = 2;
const TARGET_PACE_WARN = 80;
const TARGET_PACE_GOOD = 95;

const DRIFT_ALERT_STYLES: Record<string, { container: string; icon: string }> = {
  emerald: { container: 'bg-accent-green/10 border-accent-green/30', icon: 'text-accent-green' },
  amber: { container: 'bg-accent-amber/10 border-accent-amber/30', icon: 'text-accent-amber' },
  orange: { container: 'bg-accent-amber/10 border-accent-amber/30', icon: 'text-accent-amber' },
  red: { container: 'bg-accent-red/10 border-accent-red/30', icon: 'text-accent-red' },
};

const RECON_COLOR_TO_KPI: Record<string, KPIColor> = {
  emerald: 'green',
  amber: 'alert',
  orange: 'alert',
  red: 'red',
};

function fleetColor(pct: number | null): KPIColor {
  if (pct === null) return 'default';
  if (pct >= FLEET_GREEN_THRESHOLD) return 'green';
  return pct >= FLEET_WARN_THRESHOLD ? 'blue' : 'red';
}

function breakdownColor(open: number): KPIColor {
  if (open > BREAKDOWN_RED_THRESHOLD) return 'red';
  return open > BREAKDOWN_WARN_THRESHOLD ? 'blue' : 'green';
}

function targetColor(pacePct: number | null): KPIColor {
  if (pacePct === null) return 'default';
  if (pacePct >= TARGET_PACE_GOOD) return 'green';
  return pacePct >= TARGET_PACE_WARN ? 'blue' : 'red';
}

export default async function ExecutiveDashboardPage() {
  const [supabase, db] = await Promise.all([
    createServerSupabaseClient(),
    createReadReplicaClient(),
  ]);
  const user = await getUserSafely(supabase);

  if (!user?.id) {
    redirect('/login');
  }

  const [{ data: employee }, executive] = await Promise.all([
    db.from('employees').select('role').eq('auth_id', user.id).single(),
    getExecutiveData(),
  ]);

  if (employee?.role !== 'admin' && employee?.role !== 'manager') {
    redirect('/');
  }

  const { today, summaryAvailable, mtd, trend, fleet, breakdowns, personnel, target, daily } =
    executive;
  const driftLevel = classifyReconciliationDrift(mtd.avgAbsDriftPct);
  const driftUi = RECONCILIATION_UI[driftLevel];
  const driftAlertStyle = DRIFT_ALERT_STYLES[driftUi.color] ?? DRIFT_ALERT_STYLES.red!;
  const driftKpiColor = RECON_COLOR_TO_KPI[driftUi.color] ?? 'red';
  const summaryText = (value: string) => (summaryAvailable ? value : EM_DASH);

  const exportRows = buildExportRows(executive);
  const pdfReportData = buildPdfReport(executive);
  const gaugeSpecs = buildGaugeSpecs(executive);
  const fuelDisplay =
    mtd.fuelPerTonne === null ? EM_DASH : `${formatNumber(mtd.fuelPerTonne, RATE_DECIMALS)} L/t`;
  const tonnesPerHourDisplay =
    mtd.tonnesPerHour === null ? EM_DASH : `${formatNumber(mtd.tonnesPerHour, 1)} t/h`;

  return (
    <div className="space-y-8">
      <GlassCard variant="window" backgroundOpacity={0.6}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-[var(--accent-blue)] text-xs uppercase tracking-wider">
              Arch OS · Executive Command
            </p>
            <h1 className="mt-1 flex items-center gap-2 font-semibold text-2xl text-[var(--text-heading)]">
              <BarChart3 className="h-6 w-6 text-[var(--accent-blue)]" aria-hidden="true" />
              Executive Dashboard
            </h1>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              Cross-department KPIs, production analytics, and operational gauges — month-to-date as
              of {today}
            </p>
          </div>
          {summaryAvailable && (
            <div className="flex flex-wrap items-center gap-2">
              <PDFDownloadButton reportData={pdfReportData} />
              <ExportButton filename={`executive-report-${today}`} rows={exportRows} />
            </div>
          )}
        </div>
      </GlassCard>

      {!summaryAvailable && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-accent-red/30 bg-accent-red/10 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" aria-hidden="true" />
          <div>
            <p className="font-medium">Production summary unavailable</p>
            <p className="text-[var(--text-muted)]">
              The production summary query failed. Tonnage, drift, fuel, and trend figures are
              hidden instead of being shown as zero. Try again shortly.
            </p>
          </div>
        </div>
      )}

      <ExecutiveGaugePanel specs={gaugeSpecs} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 font-semibold text-[var(--text-muted)] text-xs">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> Production &amp; Reconciliation
          (MTD)
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Total Tonnage"
            value={summaryText(formatTonnes(mtd.total))}
            color="green"
            sub={summaryAvailable ? formatDelta(trend.weekOverWeekPct, 'prior 7d') : 'Unavailable'}
          />
          <KPICard
            label="Coal Removed"
            value={summaryText(formatTonnes(mtd.coal))}
            color="green"
            sub={
              summaryAvailable && target
                ? `${formatPercent(target.coalAttainmentPct)} of monthly target`
                : `${mtd.days} active day(s)`
            }
            subColor={targetColor(target?.coalPacePct ?? null)}
          />
          <KPICard
            label="Reconciliation Drift"
            value={summaryText(formatPercent(mtd.avgAbsDriftPct))}
            color={driftKpiColor}
            sub={summaryAvailable ? driftUi.label : 'Unavailable'}
            icon={<Scale className="h-4 w-4" aria-hidden="true" />}
          />
          <KPICard
            label="Fuel Efficiency"
            value={summaryText(fuelDisplay)}
            color="blue"
            sub={summaryAvailable ? `Throughput: ${tonnesPerHourDisplay}` : 'Unavailable'}
            icon={<Activity className="h-4 w-4" aria-hidden="true" />}
          />
        </KPIGrid>

        {summaryAvailable && driftLevel !== 'stable' && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 ${driftAlertStyle.container} text-sm`}
          >
            <AlertCircle className={`h-5 w-5 ${driftAlertStyle.icon} mt-0.5 shrink-0`} />
            <div>
              <p className="font-medium">Operational Drift Warning</p>
              <p className="text-[var(--text-muted)]">{driftUi.description}</p>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 font-semibold text-[var(--text-muted)] text-xs">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" /> Fleet, Personnel &amp; Breakdowns
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Fleet Availability"
            value={formatPercent(fleet.availabilityPct, 0)}
            color={fleetColor(fleet.availabilityPct)}
            sub={`${formatNumber(fleet.active)} / ${formatNumber(fleet.total)} machines`}
          />
          <KPICard
            label="Machine Hours (MTD)"
            value={summaryText(`${formatNumber(mtd.hours)} h`)}
            color="blue"
            sub={summaryAvailable ? `Productivity: ${tonnesPerHourDisplay}` : 'Unavailable'}
          />
          <KPICard
            label="Active Breakdowns"
            value={breakdowns.open}
            color={breakdownColor(breakdowns.open)}
            sub={`${formatNumber(breakdowns.total)} total MTD (${formatNumber(breakdowns.downtimeHours, 1)} h)`}
          />
          <KPICard
            label="Active Personnel"
            value={formatNumber(personnel.total)}
            color="default"
            sub={`${personnel.byDepartment.length} department group(s)`}
          />
        </KPIGrid>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 font-semibold text-[var(--text-muted)] text-xs">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Resource Usage &amp; Shift
          Benchmarks
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Strip Ratio (MTD)"
            value={summaryText(formatRatio(mtd.stripRatio))}
            color="default"
            sub={
              target?.plannedStripRatio
                ? `Plan ${formatRatio(target.plannedStripRatio)}`
                : 'Waste : Coal'
            }
          />
          <KPICard
            label="Diesel Consumed (MTD)"
            value={summaryText(`${formatNumber(mtd.fuelLitres)} L`)}
            color="blue"
          />
          <KPICard
            label="Waste Removed"
            value={summaryText(formatTonnes(mtd.waste))}
            color="default"
            sub={
              summaryAvailable && trend.bestDay
                ? `Peak day: ${formatTonnes(trend.bestDay.total)} (${trend.bestDay.date})`
                : undefined
            }
          />
          <KPICard label="Reporting Date" value={today} color="default" />
        </KPIGrid>
      </section>

      <section aria-labelledby="executive-charts-heading" className="space-y-3">
        <h2
          id="executive-charts-heading"
          className="flex items-center gap-1.5 font-semibold text-[var(--text-muted)] text-xs"
        >
          <Activity className="h-3.5 w-3.5" aria-hidden="true" /> 30-Day Analytics &amp; Fleet
          Visualizations
        </h2>
        <ExecutiveCharts
          summaryAvailable={summaryAvailable}
          daily={daily}
          mtd={mtd}
          avgDailyTonnes={trend.avgDailyTonnes}
          fleet={fleet}
          breakdowns={breakdowns}
          personnelByDepartment={personnel.byDepartment}
        />
      </section>
    </div>
  );
}
