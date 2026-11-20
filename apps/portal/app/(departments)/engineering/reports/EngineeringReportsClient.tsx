'use client';

/* cspell:ignore mttr */

import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Loader2,
  MessageSquare,
  Printer,
  Wrench,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import {
  buildEngineeringCsvContent,
  type EngineeringReportRange,
  type EngineeringReportsPayload,
  type EngineeringReportTab,
  resolveEngineeringReportTab,
} from './engineering-reports-model';
import {
  buildEngineeringWhatsappMessage,
  type EngineeringWhatsappSectionOptions,
} from './engineering-whatsapp';

interface EngineeringReportsClientProps {
  readonly payload: EngineeringReportsPayload;
}

const TAB_BTN_BASE =
  'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-semibold text-xs transition-colors';
const TAB_BTN_ACTIVE = 'bg-[var(--accent-blue)] text-white shadow-xs';
const TAB_BTN_INACTIVE =
  'border border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]';
const RANGE_PILL_BASE = 'rounded-md px-3 py-1 font-semibold text-xs transition-colors';
const KPI_CARD_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-white/80 p-4 shadow-2xs';
const TH_CLASS =
  'px-4 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';
const A4_PREVIEW_SHELL =
  'mx-auto box-border flex w-full max-w-[210mm] flex-col justify-between rounded-md border border-slate-300 bg-white p-8 text-slate-900 shadow-lg';

const CHART_HEIGHT = 240;
const AXIS_TICK_STYLE = { fill: 'var(--text-muted)', fontSize: 11 };
const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  fontSize: 12,
};

const RANGE_OPTIONS: readonly { id: EngineeringReportRange; label: string }[] = [
  { id: '24h', label: '24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
];

export function EngineeringReportsClient({ payload }: EngineeringReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams?.get('tab') ?? null;

  const [activeTab, setActiveTab] = useState<EngineeringReportTab>(() =>
    resolveEngineeringReportTab(urlTab ?? payload.initialTab)
  );
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100' | '75'>('fit');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [sections, setSections] = useState<EngineeringWhatsappSectionOptions>({
    includeKpis: true,
    includeBreakdowns: true,
    includeTireHealth: true,
    includeMachineHours: true,
  });

  useEffect(() => {
    if (urlTab) {
      setActiveTab(resolveEngineeringReportTab(urlTab));
    }
  }, [urlTab]);

  const handleSelectTab = (nextTab: EngineeringReportTab) => {
    setActiveTab(nextTab);
    if (typeof window !== 'undefined') {
      const nextUrl = `${pathname || '/engineering/reports'}?tab=${nextTab}&range=${payload.range}`;
      window.history.replaceState(null, '', nextUrl);
    }
  };

  const handleSelectRange = (nextRange: EngineeringReportRange) => {
    const base = pathname || '/engineering/reports';
    router.push(`${base}?tab=${activeTab}&range=${nextRange}`);
  };

  const handleExportCsv = () => {
    const csvText = buildEngineeringCsvContent(payload);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `engineering-report-${payload.range}-${payload.todayStr}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Engineering CSV report downloaded.');
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const [{ pdf }, { EngineeringPdfDocument }, ReactLib] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./EngineeringPdfDocument'),
        import('react'),
      ]);

      const docElement = ReactLib.createElement(EngineeringPdfDocument, { payload });
      const blob = await pdf(docElement as never).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `Engineering-Report-${payload.range}-${payload.todayStr}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      toast.success('Engineering PDF report downloaded.');
    } catch {
      toast.error('Direct PDF export failed; opening print dialog instead.');
      if (typeof window !== 'undefined') {
        window.print();
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  const whatsappMessage = useMemo(
    () => buildEngineeringWhatsappMessage({ payload, sections }),
    [payload, sections]
  );

  const handleCopyWhatsapp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setWhatsappCopied(true);
      toast.success('WhatsApp dispatch copied to clipboard.');
      setTimeout(() => setWhatsappCopied(false), 2000);
    } catch {
      toast.error('Clipboard access unavailable in this browser.');
    }
  };

  const toggleSection = (key: keyof EngineeringWhatsappSectionOptions) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const zoomStyle = useMemo(() => {
    if (zoomLevel === '100') return { transform: 'scale(1)', transformOrigin: 'top center' };
    if (zoomLevel === '75') return { transform: 'scale(0.75)', transformOrigin: 'top center' };
    return undefined;
  }, [zoomLevel]);

  const { summary } = payload;

  return (
    <div className="space-y-6">
      {/* Header & Subtab / Range Controls */}
      <GlassCard variant="window" className="no-print p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-[var(--accent-blue)]" aria-hidden="true" />
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">
                Engineering Reports &amp; Dispatch Suite
              </h2>
            </div>
            <p className="mt-1 text-[var(--text-muted)] text-xs">
              Window: {payload.fromDateStr} to {payload.toDateStr} ({payload.rangeLabel}) · Fleet
              availability, breakdowns, tire health, and machine hours
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Time Range Switcher */}
            <div
              className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1"
              aria-label="Report Time Range"
            >
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectRange(opt.id)}
                  aria-pressed={payload.range === opt.id}
                  className={cn(
                    RANGE_PILL_BASE,
                    payload.range === opt.id
                      ? 'bg-white text-[var(--text-heading)] shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3.5 py-2 font-semibold text-[var(--text-heading)] text-xs shadow-2xs hover:bg-[var(--bg-secondary)]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 3 Synchronized View Tabs */}
        <div
          className="mt-4 flex flex-wrap items-center gap-2 border-[var(--border-default)] border-t pt-4"
          role="tablist"
          aria-label="Engineering Report Views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'dashboard'}
            onClick={() => handleSelectTab('dashboard')}
            className={cn(
              TAB_BTN_BASE,
              activeTab === 'dashboard' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pdf-report'}
            onClick={() => handleSelectTab('pdf-report')}
            className={cn(
              TAB_BTN_BASE,
              activeTab === 'pdf-report' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE
            )}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>PDF Report</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'whatsapp-report'}
            onClick={() => handleSelectTab('whatsapp-report')}
            className={cn(
              TAB_BTN_BASE,
              activeTab === 'whatsapp-report' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>WhatsApp Report</span>
          </button>
        </div>
      </GlassCard>

      {/* TAB 1: DASHBOARD VIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6" data-testid="engineering-dashboard-view">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className={KPI_CARD_CLASS}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                  Fleet Availability
                </span>
                <Activity className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              </div>
              <p className="mt-2 font-bold text-2xl text-emerald-700">
                {summary.fleetAvailabilityPct.toFixed(1)}%
              </p>
              <span className="text-[var(--text-muted)] text-xs">
                {summary.activeMachinesCount} active machines
              </span>
            </div>

            <div className={KPI_CARD_CLASS}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                  Active Breakdowns
                </span>
                <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
              </div>
              <p className="mt-2 font-bold text-2xl text-red-700">{summary.activeBreakdowns}</p>
              <span className="text-[var(--text-muted)] text-xs">
                {summary.totalBreakdowns} total in window
              </span>
            </div>

            <div className={KPI_CARD_CLASS}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                  Resolved
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              </div>
              <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
                {summary.resolvedBreakdowns}
              </p>
              <span className="text-[var(--text-muted)] text-xs">Returned to service</span>
            </div>

            <div className={KPI_CARD_CLASS}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                  Downtime / MTTR
                </span>
                <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
              </div>
              <p className="mt-2 font-bold text-2xl text-amber-700">
                {summary.totalDowntimeHours.toFixed(1)}h
              </p>
              <span className="text-[var(--text-muted)] text-xs">
                MTTR: {summary.mttrHours.toFixed(1)}h
              </span>
            </div>

            <div className={KPI_CARD_CLASS}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                  Hours Worked
                </span>
                <Gauge className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
              </div>
              <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
                {summary.totalHoursWorked.toLocaleString('en-US')}h
              </p>
              <span className="text-[var(--text-muted)] text-xs">Fleet SMU output</span>
            </div>

            <div className={KPI_CARD_CLASS}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                  Critical Tires
                </span>
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              </div>
              <p className="mt-2 font-bold text-2xl text-amber-700">{summary.criticalTires}</p>
              <span className="text-[var(--text-muted)] text-xs">
                {summary.installedTires} active · {summary.spareTires} spares
              </span>
            </div>
          </div>

          {/* Recharts Analytics Row */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <GlassCard className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                    Breakdown Trend &amp; Downtime Hours
                  </h3>
                  <p className="text-[var(--text-muted)] text-xs">
                    Active vs. resolved breakdown events across the reporting window
                  </p>
                </div>
                <span className="font-mono text-[var(--text-muted)] text-xs">
                  {payload.breakdownTrend.length} days
                </span>
              </div>
              {payload.breakdownTrend.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-[var(--text-muted)] text-xs">
                  No breakdown trend data in selected window.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <BarChart data={[...payload.breakdownTrend]}>
                    <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={AXIS_TICK_STYLE} stroke="var(--border-default)" />
                    <YAxis
                      allowDecimals={false}
                      tick={AXIS_TICK_STYLE}
                      stroke="var(--border-default)"
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar
                      dataKey="activeCount"
                      name="Active"
                      fill="var(--accent-red)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="resolvedCount"
                      name="Resolved"
                      fill="var(--accent-green)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            <GlassCard className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                    Tire Condition Distribution
                  </h3>
                  <p className="text-[var(--text-muted)] text-xs">
                    Good vs. Warning vs. Critical tire condition across fleet ({summary.totalTires}{' '}
                    tires)
                  </p>
                </div>
                <span className="font-mono text-[var(--text-muted)] text-xs">
                  Removals: {summary.tireRemovalsCount} · Mounts: {summary.tireReplacementsCount}
                </span>
              </div>
              {summary.totalTires === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-[var(--text-muted)] text-xs">
                  No tire fleet telemetry registered.
                </div>
              ) : (
                <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                  <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                    <PieChart>
                      <Pie
                        data={[...payload.tireConditionBreakdown]}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={3}
                      >
                        {payload.tireConditionBreakdown.map((entry) => (
                          <Cell key={entry.label} fill={entry.colorVar} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2.5">
                    {payload.tireConditionBreakdown.map((slice) => (
                      <div
                        key={slice.label}
                        className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-[var(--text-heading)]">
                          {slice.label}
                        </span>
                        <span className="font-bold font-mono text-[var(--text-heading)]">
                          {slice.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Breakdowns Table & Top Machines */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <GlassCard className="overflow-hidden p-0 lg:col-span-2">
              <div className="border-[var(--border-default)] border-b px-5 py-3.5">
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Active &amp; Resolved Breakdowns
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                      <th scope="col" className={TH_CLASS}>
                        Machine
                      </th>
                      <th scope="col" className={TH_CLASS}>
                        Reason
                      </th>
                      <th scope="col" className={TH_CLASS}>
                        Status
                      </th>
                      <th scope="col" className={TH_CLASS}>
                        Date
                      </th>
                      <th scope="col" className={TH_CLASS}>
                        Downtime
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {payload.breakdowns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                          No breakdown records found in this window.
                        </td>
                      </tr>
                    ) : (
                      payload.breakdowns.slice(0, 12).map((bd) => (
                        <tr key={bd.id}>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[var(--text-heading)]">
                              {bd.machineName}
                            </span>
                            <span className="block text-[11px] text-[var(--text-muted)]">
                              {bd.machineType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{bd.reason}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 font-semibold text-[11px]',
                                bd.status === 'active'
                                  ? 'bg-red-500/10 text-red-700'
                                  : 'bg-emerald-500/10 text-emerald-700'
                              )}
                            >
                              {bd.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                            {bd.dateIn}
                          </td>
                          <td className="px-4 py-3 font-mono text-[var(--text-heading)]">
                            {bd.durationHours > 0 ? `${bd.durationHours.toFixed(1)}h` : 'Ongoing'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard className="overflow-hidden p-0">
              <div className="border-[var(--border-default)] border-b px-5 py-3.5">
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Top Machines by Hours
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-default)]">
                {payload.topMachinesByHours.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[var(--text-muted)] text-xs">
                    No machine hours logged.
                  </p>
                ) : (
                  payload.topMachinesByHours.map((m) => (
                    <div
                      key={m.machineId}
                      className="flex items-center justify-between px-5 py-3 text-xs"
                    >
                      <div>
                        <span className="block font-semibold text-[var(--text-heading)]">
                          {m.machineName}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {m.machineType} · {m.breakdownCount} breakdowns
                        </span>
                      </div>
                      <span className="font-bold font-mono text-[var(--text-heading)]">
                        {m.hoursWorked.toFixed(1)}h
                      </span>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>

          {/* Recent Tire Activity Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="border-[var(--border-default)] border-b px-5 py-3.5">
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                Recent Tire Removals, Replacements &amp; Inspections
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                    <th scope="col" className={TH_CLASS}>
                      Date
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Activity
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Serial / Brand
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Machine / Position
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Tread / PSI
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {payload.recentTireActivities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                        No tire activity records in this window.
                      </td>
                    </tr>
                  ) : (
                    payload.recentTireActivities.slice(0, 10).map((act) => (
                      <tr key={act.id}>
                        <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                          {act.inspectionDate}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--text-heading)] uppercase">
                          {act.activityKind}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-[var(--text-heading)]">
                            {act.serialNumber}
                          </span>
                          <span className="block text-[11px] text-[var(--text-muted)]">
                            {act.brand}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-[var(--text-heading)]">
                            {act.machineName}
                          </span>
                          <span className="block text-[11px] text-[var(--text-muted)]">
                            {act.position}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--text-heading)]">
                          {act.treadDepthMm}mm · {act.pressurePsi} PSI
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-[var(--text-muted)]">
                          {act.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 2: PDF REPORT VIEW */}
      {activeTab === 'pdf-report' && (
        <div className="space-y-4" data-testid="engineering-pdf-view">
          {/* PDF Toolbar */}
          <GlassCard className="no-print flex flex-wrap items-center justify-between gap-3 p-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-blue)]/10 px-2.5 py-1 font-bold text-[var(--accent-blue)] text-xs">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Live A4 Executive Preview
              </span>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {payload.rangeLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex rounded-lg border border-[var(--border-default)] bg-white p-0.5 text-xs"
                role="group"
                aria-label="Preview Zoom Controls"
              >
                {(
                  [
                    { id: 'fit', label: 'Fit' },
                    { id: '100', label: '100%' },
                    { id: '75', label: '75%' },
                  ] as const
                ).map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setZoomLevel(z.id)}
                    aria-pressed={zoomLevel === z.id}
                    className={cn(
                      'rounded-md px-2.5 py-1 font-medium',
                      zoomLevel === z.id
                        ? 'bg-[var(--accent-blue)] text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                    )}
                  >
                    {z.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                data-testid="download-engineering-pdf-btn"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-1.5 font-semibold text-white text-xs shadow-xs hover:opacity-90 disabled:opacity-50"
              >
                {isExportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isExportingPdf ? 'Building PDF...' : 'Download Engineering PDF'}</span>
              </button>
            </div>
          </GlassCard>

          {/* A4 Executive Sheet Preview */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 md:p-8">
            <div
              style={zoomStyle}
              className={A4_PREVIEW_SHELL}
              data-testid="engineering-pdf-preview"
            >
              <div className="space-y-6">
                {/* Corporate Header */}
                <div className="flex items-start justify-between border-[var(--accent-gold)] border-b-2 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Logo variant="gold" className="h-6 w-6 shrink-0" />
                      <span className="font-bold text-[var(--accent-gold)] text-xs uppercase tracking-widest">
                        Arch OS · Plantcor Engineering
                      </span>
                    </div>
                    <h3 className="font-extrabold text-2xl text-slate-900">
                      Engineering Executive Report
                    </h3>
                    <p className="text-slate-600 text-xs">
                      Window: {payload.fromDateStr} to {payload.toDateStr} ({payload.rangeLabel})
                    </p>
                  </div>

                  <div className="space-y-1 text-right font-mono text-slate-600 text-xs">
                    <p>Date: {payload.todayStr}</p>
                    <p>REF: ARCH-ENG-{payload.todayStr.replace(/-/g, '')}</p>
                    <p>Active Fleet: {summary.activeMachinesCount} units</p>
                  </div>
                </div>

                {/* Executive Summary Strip */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 uppercase">Fleet Availability</span>
                    <p className="mt-1 font-bold font-mono text-emerald-700 text-lg">
                      {summary.fleetAvailabilityPct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 uppercase">Breakdowns</span>
                    <p className="mt-1 font-bold font-mono text-lg text-red-700">
                      {summary.activeBreakdowns} Active / {summary.resolvedBreakdowns} Resolved
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 uppercase">Tire Health</span>
                    <p className="mt-1 font-bold font-mono text-amber-700 text-lg">
                      {summary.installedTires} Active · {summary.criticalTires} Critical
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 uppercase">Machine Hours</span>
                    <p className="mt-1 font-bold font-mono text-lg text-slate-900">
                      {summary.totalHoursWorked.toLocaleString('en-US')}h
                    </p>
                  </div>
                </div>

                {/* Breakdowns Preview Table */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Active &amp; Resolved Breakdowns ({payload.breakdowns.length})
                  </h4>
                  <table className="w-full border-collapse border border-slate-200 text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="border border-slate-200 px-3 py-2">Machine</th>
                        <th className="border border-slate-200 px-3 py-2">Fault / Reason</th>
                        <th className="border border-slate-200 px-3 py-2">Status</th>
                        <th className="border border-slate-200 px-3 py-2">Downtime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.breakdowns.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                            No breakdowns recorded in window.
                          </td>
                        </tr>
                      ) : (
                        payload.breakdowns.slice(0, 8).map((bd) => (
                          <tr key={bd.id}>
                            <td className="border border-slate-200 px-3 py-1.5 font-medium">
                              {bd.machineName}
                            </td>
                            <td className="border border-slate-200 px-3 py-1.5">{bd.reason}</td>
                            <td className="border border-slate-200 px-3 py-1.5 uppercase">
                              {bd.status}
                            </td>
                            <td className="border border-slate-200 px-3 py-1.5 font-mono">
                              {bd.durationHours > 0 ? `${bd.durationHours.toFixed(1)}h` : 'Ongoing'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Tire Summary & Machine Hours */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Tire Health &amp; Replacements
                    </h4>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                      <p>
                        Installed: <strong>{summary.installedTires}</strong> · Spares:{' '}
                        <strong>{summary.spareTires}</strong> · Scrapped:{' '}
                        <strong>{summary.scrappedTires}</strong>
                      </p>
                      <p className="mt-1">
                        Logged Removals: <strong>{summary.tireRemovalsCount}</strong> ·
                        Replacements/Mounts: <strong>{summary.tireReplacementsCount}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Machine Hours Worked (Top Units)
                    </h4>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                      {payload.topMachinesByHours.slice(0, 3).map((m) => (
                        <div key={m.machineId} className="flex justify-between py-0.5">
                          <span>{m.machineName}</span>
                          <span className="font-mono font-semibold">
                            {m.hoursWorked.toFixed(1)}h
                          </span>
                        </div>
                      ))}
                      {payload.topMachinesByHours.length === 0 && (
                        <p className="text-slate-500">No machine hours recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between border-slate-300 border-t pt-3 font-mono text-[10px] text-slate-600">
                <span>Arch-Systems · Plantcor Engineering Document Control</span>
                <span>A4 · ISO 9001:2015</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WHATSAPP REPORT VIEW */}
      {activeTab === 'whatsapp-report' && (
        <GlassCard className="p-5" data-testid="engineering-whatsapp-view">
          <div className="flex flex-wrap items-center justify-between gap-4 border-[var(--border-default)] border-b pb-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
                <MessageSquare className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <span>WhatsApp Engineering Shift Dispatch</span>
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Customize dispatch sections and share directly to Plantcor engineering WhatsApp
                groups
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyWhatsapp}
                data-testid="copy-whatsapp-report-btn"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3.5 py-2 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]"
              >
                {whatsappCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy WhatsApp Report</span>
                  </>
                )}
              </button>

              <a
                href={`https://web.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="send-whatsapp-report-link"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white text-xs shadow-xs hover:bg-emerald-700"
              >
                <span>Send via WhatsApp</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Section Toggles */}
          <div className="mt-4 flex flex-wrap gap-3">
            {(
              [
                { key: 'includeKpis', label: 'KPI Overview' },
                { key: 'includeBreakdowns', label: 'Active & 24h Breakdowns' },
                { key: 'includeTireHealth', label: 'Tire Health & Removals' },
                { key: 'includeMachineHours', label: 'Machine Hours' },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs"
              >
                <input
                  type="checkbox"
                  checked={sections[item.key]}
                  onChange={() => toggleSection(item.key)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          {/* Live WhatsApp Message Preview */}
          <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
            <pre
              data-testid="whatsapp-message-preview"
              className="whitespace-pre-wrap font-mono text-[var(--text-heading)] text-xs leading-relaxed"
            >
              {whatsappMessage}
            </pre>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
