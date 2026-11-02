'use client';

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Printer,
  Sparkles,
  Sun,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { MachineOperationLogItem } from './reports-types';
import {
  buildExecutiveSummary,
  buildSiteShiftReports,
  type ExcavatorActivityBlockData,
  type ExecutiveSummaryMetrics,
  type HaulingMachineRow,
  type SiteShiftReportData,
} from './shift-report-model';

export interface ShiftReportA4PreviewProps {
  readonly departmentId: string;
  readonly departmentName: string;
  readonly todayStr: string;
  readonly currentShift: 'day' | 'night';
  readonly fromDateStr: string;
  readonly toDateStr: string;
  readonly shiftFilter?: 'all' | 'day' | 'night';
  readonly filteredMachineOps: readonly MachineOperationLogItem[];
  readonly onFilterDateChange?: (date: string) => void;
}

const TOOLBAR_CONTAINER_CLASS =
  'sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/95 px-4 py-3 shadow-sm backdrop-blur-md transition-all';
const ACTION_BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-1.5 font-semibold text-white text-xs shadow-sm transition hover:opacity-90 disabled:opacity-50';
const ACTION_BTN_SECONDARY =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs shadow-2xs transition hover:border-[var(--accent-blue)] hover:bg-[var(--bg-tertiary)]';
const SEGMENT_BTN_ACTIVE = 'bg-[var(--accent-blue)] text-white shadow-2xs';
const SEGMENT_BTN_INACTIVE =
  'text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)]';

export function ShiftReportA4Preview({
  departmentId,
  departmentName,
  todayStr,
  currentShift,
  fromDateStr,
  toDateStr,
  shiftFilter = 'all',
  filteredMachineOps,
  onFilterDateChange,
}: ShiftReportA4PreviewProps) {
  const chartIdPrefix = useId();
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'paginated' | 'all'>('paginated');
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100' | '75'>('fit');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    for (const log of filteredMachineOps) {
      if (log.date) dates.add(log.date);
    }
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [filteredMachineOps]);

  const activeLogs = useMemo(() => {
    if (selectedDate === 'all') return filteredMachineOps;
    return filteredMachineOps.filter((log) => log.date === selectedDate);
  }, [selectedDate, filteredMachineOps]);

  const periodLabel = useMemo(() => {
    if (selectedDate !== 'all') return `${selectedDate} (Single Shift)`;
    return `${fromDateStr} to ${toDateStr}`;
  }, [selectedDate, fromDateStr, toDateStr]);

  const siteReports = useMemo(() => buildSiteShiftReports(activeLogs), [activeLogs]);

  const executiveSummary = useMemo(
    () =>
      buildExecutiveSummary({
        siteReports,
        departmentName,
        reportDate: selectedDate === 'all' ? todayStr : selectedDate,
        shift: currentShift,
        periodLabel,
      }),
    [siteReports, departmentName, selectedDate, todayStr, currentShift, periodLabel]
  );

  const totalPages = useMemo(() => 1 + Math.max(siteReports.length, 1), [siteReports]);

  const handleDateChange = (dateVal: string) => {
    setSelectedDate(dateVal);
    setCurrentPage(1);
    onFilterDateChange?.(dateVal);
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const [{ pdf }, { ShiftReportPdfDocument }, ReactLib] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ShiftReportPdfDocument'),
        import('react'),
      ]);

      const totalsPayload = {
        totalHours: executiveSummary.totalFleetSmrWorked,
        totalMachines: executiveSummary.fleetCount,
        prod: Math.round(executiveSummary.fleetUtilization.delayTypeBreakdown[0]?.minutes || 0),
        eng: Math.round(executiveSummary.fleetUtilization.delayTypeBreakdown[1]?.minutes || 0),
        nat: Math.round(executiveSummary.fleetUtilization.delayTypeBreakdown[2]?.minutes || 0),
        nonSite: Math.round(executiveSummary.fleetUtilization.delayTypeBreakdown[3]?.minutes || 0),
      };

      const docElement = ReactLib.createElement(ShiftReportPdfDocument, {
        departmentName,
        todayStr,
        currentShift,
        periodLabel,
        shiftFilterLabel:
          shiftFilter === 'all' ? 'All Shifts' : `${shiftFilter.toUpperCase()} Shift`,
        siteGroups: siteReports.map((site) => ({
          site: site.siteName,
          excavators: [],
          rollovers: [],
          siteMachines: [],
          orderedMachines: site.excavatorBlocks.flatMap((b) =>
            b.assignedMachines.map((hauler) => ({
              id: hauler.machineId,
              date: todayStr,
              shift: currentShift,
              machineName: hauler.machineName,
              machineType: hauler.machineType,
              operatorName: hauler.operator,
              siteName: site.siteName,
              startSmu: hauler.openingSmr,
              endSmu: hauler.closingSmr,
              hoursWorked: hauler.totalSmrWorked,
              bcmMoved: hauler.rowTotal,
              isDozer: false,
              delayMinutes: hauler.delayMinutes,
              productionDelayMinutes: hauler.productionDelayMinutes,
              engineeringDelayMinutes: hauler.engineeringDelayMinutes,
              naturalDelayMinutes: hauler.naturalDelayMinutes,
              nonSiteDelayMinutes: hauler.nonSiteDelayMinutes,
              excavatorActivity: `Excavator: ${b.excavatorName} · ${b.material}`,
              status: 'completed' as const,
            }))
          ),
          totalHours: site.siteTotals.totalHours,
          totalBcm: site.siteTotals.totalMaterialMoved,
          excavatorBcm: site.siteTotals.bcmVolume,
          rolloverBcm: 0,
          productionDelayMin: site.siteTotals.totalDelaysMin,
          engineeringDelayMin: 0,
          naturalDelayMin: 0,
          nonSiteDelayMin: 0,
        })),
        totals: totalsPayload,
      });

      const blob = await pdf(docElement as never).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      const filenameSuffix = selectedDate === 'all' ? todayStr : selectedDate;
      downloadAnchor.href = blobUrl;
      downloadAnchor.download = `Shift-Report-${departmentId || 'arch'}-${filenameSuffix}.pdf`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      toast.success('Vector Shift Report PDF downloaded successfully.');
    } catch (_error) {
      toast.error('Direct PDF export encountered an issue; opening print view instead.');
      if (typeof window !== 'undefined') window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const zoomScaleStyle = useMemo(() => {
    if (zoomLevel === '100') return { transform: 'scale(1)', transformOrigin: 'top center' };
    if (zoomLevel === '75') return { transform: 'scale(0.75)', transformOrigin: 'top center' };
    return { maxWidth: '100%', width: '100%' };
  }, [zoomLevel]);

  return (
    <div
      className="flex flex-col rounded-xl border border-[var(--border-default)] bg-[#f3f4f6] text-[#0f172a] shadow-sm"
      data-testid="shift-report-a4-preview-root"
    >
      {/* Sticky Preview Toolbar */}
      <div className={TOOLBAR_CONTAINER_CLASS}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-blue)]/10 px-2.5 py-1 font-bold text-[var(--accent-blue)] text-xs">
              <FileText className="h-3.5 w-3.5" />
              Live A4 PDF Preview
            </span>
            <span className="font-mono text-[var(--text-muted)] text-xs">
              {totalPages} Page{totalPages === 1 ? '' : 's'} · {siteReports.length} Site
              {siteReports.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Date Selector */}
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            <select
              aria-label="Filter PDF by Shift Date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent font-medium text-[var(--text-heading)] text-xs focus:outline-none"
            >
              <option value="all">All Shift Dates ({availableDates.length})</option>
              {availableDates.map((d, idx) => (
                <option key={d} value={d}>
                  {d}
                  {idx === 0 ? ' (Latest)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('paginated')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                viewMode === 'paginated' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_INACTIVE
              }`}
            >
              Single Page
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                viewMode === 'all' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_INACTIVE
              }`}
            >
              All Pages
            </button>
          </div>

          {/* Page Navigator */}
          {viewMode === 'paginated' && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous Page"
                className="rounded p-1 text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-1.5 font-mono font-semibold text-[var(--text-heading)]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next Page"
                className="rounded p-1 text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel('fit')}
              className={`rounded-md px-2 py-1 font-medium transition ${
                zoomLevel === 'fit' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_INACTIVE
              }`}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel('100')}
              className={`rounded-md px-2 py-1 font-medium transition ${
                zoomLevel === '100' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_INACTIVE
              }`}
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel('75')}
              className={`rounded-md px-2 py-1 font-medium transition ${
                zoomLevel === '75' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_INACTIVE
              }`}
            >
              75%
            </button>
          </div>

          {/* Export & Print */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting}
            className={ACTION_BTN_PRIMARY}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.print();
            }}
            className={ACTION_BTN_SECONDARY}
          >
            <Printer className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            <span>Print Direct</span>
          </button>
        </div>
      </div>

      {/* A4 Canvas Viewport */}
      <div className="flex w-full justify-center overflow-x-auto p-4 md:p-8">
        <div style={zoomScaleStyle} className="flex flex-col items-center gap-8">
          {/* Render Page 1 (Executive Summary) */}
          {(viewMode === 'all' || currentPage === 1) && (
            <A4SheetContainer pageNumber={1} totalPages={totalPages}>
              <PageOneExecutiveSummary summary={executiveSummary} chartPrefix={chartIdPrefix} />
            </A4SheetContainer>
          )}

          {/* Render Pages 2+ (Site-by-Site Breakdown) */}
          {siteReports.map((site, index) => {
            const pageNum = index + 2;
            if (viewMode === 'paginated' && currentPage !== pageNum) return null;
            return (
              <A4SheetContainer key={site.siteName} pageNumber={pageNum} totalPages={totalPages}>
                <PageSiteBreakdown siteReport={site} />
              </A4SheetContainer>
            );
          })}

          {siteReports.length === 0 && (viewMode === 'all' || currentPage > 1) && (
            <A4SheetContainer pageNumber={2} totalPages={2}>
              <div className="flex h-full flex-col items-center justify-center p-12 text-center text-slate-500">
                <FileText className="mb-3 h-10 w-10 text-slate-400" />
                <h4 className="font-semibold text-base text-slate-700">
                  No Site Machine Logs Available
                </h4>
                <p className="mt-1 text-slate-500 text-xs">
                  No machine operation records match the selected shift and date filter.
                </p>
              </div>
            </A4SheetContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A4 Sheet Container Wrapper (Strict 210mm x 297mm Aspect Ratio)
// ---------------------------------------------------------------------------
export interface A4SheetContainerProps {
  readonly pageNumber: number;
  readonly totalPages: number;
  readonly children: React.ReactNode;
}

export function A4SheetContainer({ pageNumber, totalPages, children }: A4SheetContainerProps) {
  return (
    <div
      className="a4-page-sheet relative flex min-h-[1123px] w-[794px] flex-col justify-between rounded-lg bg-white p-[48px] text-[#0f172a] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] transition-shadow [print-color-adjust:exact]"
      style={{
        width: '794px',
        minHeight: '1123px',
        pageBreakAfter: 'always',
        breakAfter: 'page',
      }}
    >
      <div className="flex-1">{children}</div>

      {/* Strictly Styled Page X of Y Footer */}
      <div className="mt-6 flex items-center justify-between border-slate-300 border-t pt-3 font-mono text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700 uppercase tracking-wider">Arch-Systems</span>
          <span>·</span>
          <span>Plantcor Document Control (ISO 9001:2015 Compliant)</span>
        </div>
        <div className="font-bold text-slate-700">
          Page {pageNumber} of {totalPages}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page 1: Branding & Combined Shift Summary
// ---------------------------------------------------------------------------
interface PageOneProps {
  readonly summary: ExecutiveSummaryMetrics;
  readonly chartPrefix: string;
}

function PageOneExecutiveSummary({ summary, chartPrefix }: PageOneProps) {
  return (
    <div className="space-y-6">
      {/* Official Arch-Systems Corporate Header */}
      <div className="flex items-start justify-between border-[#d4af37] border-b-2 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 font-black text-[10px] text-white tracking-widest">
              ARCH OS
            </span>
            <span className="font-bold text-[#d4af37] text-[11px] uppercase tracking-widest">
              Plantcor Mining Operations
            </span>
          </div>
          <h1 className="font-extrabold text-2xl text-slate-900 tracking-tight">
            Official Shift Operations Report
          </h1>
          <p className="text-slate-600 text-xs">
            Department: <strong className="text-slate-800">{summary.departmentName}</strong> ·
            Window: <span className="font-mono">{summary.periodLabel}</span>
          </p>
        </div>

        <div className="space-y-1 text-right text-xs">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 font-bold text-slate-800">
            <Sun className="h-3 w-3 text-amber-500" />
            <span className="uppercase">{summary.shift} SHIFT</span>
          </div>
          <p className="font-mono text-slate-600">Date: {summary.reportDate}</p>
          <p className="font-mono text-[10px] text-slate-500">
            REF: ARCH-SR-{summary.reportDate.replace(/-/g, '')}
          </p>
        </div>
      </div>

      {/* Combined Executive Summary Metric Cards */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Combined Shift Summary (Cross-Site Totals)
          </h2>
          <span className="font-mono text-[11px] text-slate-500">
            {summary.sitesCount} Active Site{summary.sitesCount === 1 ? '' : 's'} ·{' '}
            {summary.fleetCount} Active Fleet Machines
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Total Material Moved
            </p>
            <p className="mt-1 font-extrabold font-mono text-blue-700 text-xl">
              {summary.totalMaterialMoved.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-500">BCM / Tonnes Combined</p>
          </div>

          <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Haul Loads</p>
            <p className="mt-1 font-extrabold font-mono text-slate-900 text-xl">
              {summary.totalLoads.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-500">Dispatched Dump Cycles</p>
          </div>

          <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Fleet SMR Worked</p>
            <p className="mt-1 font-extrabold font-mono text-emerald-700 text-xl">
              {summary.totalFleetSmrWorked.toFixed(1)} h
            </p>
            <p className="text-[10px] text-slate-500">
              {summary.fleetUtilization.utilizationPct}% Fleet Utilization
            </p>
          </div>

          <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Total Operational Delays
            </p>
            <p className="mt-1 font-extrabold font-mono text-amber-700 text-xl">
              {summary.totalDelayMinutes} m
            </p>
            <p className="text-[10px] text-slate-500">
              {(summary.totalDelayMinutes / 60).toFixed(1)} Delay Hours Logged
            </p>
          </div>
        </div>
      </div>

      {/* Visuals: 3 Minimalist Crisp SVG Summary Charts */}
      <div className="space-y-4 pt-1">
        {/* Chart 1: Total Tonnes / BCM by Site */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              1. Production Volume by Site
            </h3>
            <span className="font-mono text-[10px] text-slate-500">
              Direct Site Block Summation
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {summary.productionBySite.map((site) => {
              const maxVol = Math.max(...summary.productionBySite.map((s) => s.amount), 1);
              const pct = Math.max(Math.round((site.amount / maxVol) * 100), 5);
              return (
                <div key={site.site} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{site.site}</span>
                    <span className="font-mono text-slate-700">
                      <strong>{site.amount.toLocaleString()}</strong> {site.unit} · {site.loads}{' '}
                      loads · {site.hours.toFixed(1)}h
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded bg-slate-100">
                    <div className="h-full rounded bg-blue-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {summary.productionBySite.length === 0 && (
              <p className="py-2 text-center text-slate-400 text-xs">No site production.</p>
            )}
          </div>
        </div>

        {/* Chart 2: Material Split */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              2. Material Distribution Split
            </h3>
            <span className="font-mono text-[10px] text-slate-500">
              Overburden / ROM Coal / Discard
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {/* Segmented Stacked Bar */}
            <div className="flex h-4 w-full overflow-hidden rounded bg-slate-100">
              {summary.materialSplit.map((mat, i) => {
                const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];
                const color = colors[i % colors.length]!;
                return (
                  <div
                    key={mat.material}
                    style={{ width: `${Math.max(mat.pct, 2)}%`, backgroundColor: color }}
                    title={`${mat.material}: ${mat.pct}%`}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {summary.materialSplit.map((mat, i) => {
                const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];
                const color = colors[i % colors.length]!;
                return (
                  <div
                    key={mat.material}
                    className="flex items-center gap-2 rounded border border-slate-200 p-2"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <div>
                      <p className="font-semibold text-[11px] text-slate-800">{mat.material}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {mat.amount.toLocaleString()} {mat.unit} ({mat.pct}%)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 3: Fleet Operating Time & Delay Categorization */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              3. Operational Utilization &amp; Downtime Breakdown
            </h3>
            <span className="font-mono text-[10px] text-slate-500">
              Target: &gt;85% Utilization
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {summary.fleetUtilization.delayTypeBreakdown.map((delay) => (
              <div
                key={delay.name}
                className="rounded border border-slate-200 bg-slate-50/50 p-2.5"
              >
                <p className="font-medium text-[10px] text-slate-500 uppercase">{delay.name}</p>
                <p className="mt-0.5 font-bold font-mono text-slate-800 text-sm">
                  {delay.minutes} m
                </p>
                <p className="text-[10px] text-slate-400">{(delay.minutes / 60).toFixed(1)} hrs</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Official Sign-Off Strip on Page 1 */}
      <div className="grid grid-cols-3 gap-3 border-slate-300 border-t pt-3 text-[10px] text-slate-500">
        <div>
          <span className="font-bold uppercase">Prepared By:</span> Control Room Dispatcher
        </div>
        <div className="text-center">
          <span className="font-bold uppercase">Shift Supervisor:</span> Approved &amp; Signed
        </div>
        <div className="text-right">
          <span className="font-bold uppercase">System Security:</span> Immutable Ledger
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page 2+: Site-by-Site Breakdown (New Page Per Site)
// ---------------------------------------------------------------------------
interface PageSiteProps {
  readonly siteReport: SiteShiftReportData;
}

function PageSiteBreakdown({ siteReport }: PageSiteProps) {
  return (
    <div className="space-y-6">
      {/* Site Header Banner with Gold Separator */}
      <div className="flex items-center justify-between rounded-lg border-[#d4af37] border-b-2 bg-slate-900 px-4 py-3 text-white">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-400" />
            <h2 className="font-black text-base uppercase tracking-wide">
              SITE: {siteReport.siteName}
            </h2>
          </div>
          <p className="text-[11px] text-slate-300">
            Excavator Loading Blocks · Assigned Haulers · Auto-Derived Aggregations
          </p>
        </div>

        <div className="text-right font-mono text-xs">
          <div>
            Total Material:{' '}
            <strong className="text-blue-400">
              {siteReport.siteTotals.totalMaterialMoved.toLocaleString()}
            </strong>{' '}
            {siteReport.siteTotals.coalTonnes > siteReport.siteTotals.bcmVolume ? 'Tonnes' : 'BCM'}
          </div>
          <div className="text-slate-400">
            {siteReport.siteTotals.totalLoads} Loads · {siteReport.siteTotals.totalHours.toFixed(1)}{' '}
            Operating Hours
          </div>
        </div>
      </div>

      {/* Excavator Activity Blocks */}
      <div className="space-y-6">
        {siteReport.excavatorBlocks.map((block) => (
          <ExcavatorActivityBlock key={block.excavatorId} block={block} />
        ))}
      </div>

      {/* Dozer Rollover Operations (if present on site) */}
      {siteReport.dozerRollovers.length > 0 && (
        <div className="avoid-break overflow-hidden rounded-lg border border-slate-300 bg-white">
          <div className="flex items-center justify-between bg-amber-50 px-3.5 py-2 font-bold text-amber-900 text-xs">
            <span>Dozer Roll-Over Operations (Hours × 250 BCM)</span>
            <span className="font-mono">
              {siteReport.dozerRollovers.length} Dozer
              {siteReport.dozerRollovers.length === 1 ? '' : 's'} Active
            </span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-1.5">Machine</th>
                <th className="px-3 py-1.5">Operator</th>
                <th className="px-3 py-1.5 text-right">Start SMR</th>
                <th className="px-3 py-1.5 text-right">Stop SMR</th>
                <th className="px-3 py-1.5 text-right">Worked (h)</th>
                <th className="px-3 py-1.5 text-right">Blade Passes</th>
                <th className="px-3 py-1.5 text-right">Rollover BCM</th>
                <th className="px-3 py-1.5 text-right">Delays</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {siteReport.dozerRollovers.map((d) => (
                <tr key={d.machineName}>
                  <td className="px-3 py-1.5 font-bold text-slate-800">{d.machineName}</td>
                  <td className="px-3 py-1.5 text-slate-600">{d.operatorName}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{d.openingSmr.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{d.closingSmr.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-right font-bold font-mono text-emerald-700">
                    {d.hoursWorked.toFixed(1)}h
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{d.bladePasses}</td>
                  <td className="px-3 py-1.5 text-right font-bold font-mono text-blue-700">
                    {d.rolloverBcm.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-500">
                    {d.delayMinutes > 0 ? `${d.delayMinutes}m` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Site Shift Summary directly under Machines */}
      <div className="avoid-break mt-4 rounded-xl border-2 border-[#d4af37]/80 bg-slate-50 p-4 shadow-2xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#d4af37]" />
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Site Shift Summary — {siteReport.siteName}
              </h4>
            </div>
            <p className="text-[11px] text-slate-600">
              Aggregated shift reliability, operating duration, and downtime breakdown
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-[#d4af37]/60 bg-white px-3 py-1.5 text-right shadow-2xs">
              <p className="text-[10px] text-slate-500 uppercase">Total Worked</p>
              <p className="font-bold font-mono text-emerald-700 text-sm">
                {siteReport.siteTotals.totalHours.toFixed(1)}h
              </p>
            </div>
            <div className="rounded-lg border border-[#d4af37]/60 bg-white px-3 py-1.5 text-right shadow-2xs">
              <p className="text-[10px] text-slate-500 uppercase">Total Delays</p>
              <p className="font-bold font-mono text-amber-700 text-sm">
                {siteReport.siteTotals.totalDelaysMin}m
              </p>
            </div>
            <div className="rounded-lg border border-[#d4af37]/60 bg-white px-3 py-1.5 text-right shadow-2xs">
              <p className="text-[10px] text-slate-500 uppercase">Availability %</p>
              <p className="font-bold font-mono text-blue-700 text-sm">
                {(
                  (siteReport.siteTotals.totalHours /
                    Math.max(
                      siteReport.siteTotals.totalHours + siteReport.siteTotals.totalDelaysMin / 60,
                      1
                    )) *
                  100
                ).toFixed(1)}
                %
              </p>
            </div>
            <div className="rounded-lg border border-[#d4af37]/60 bg-white px-3 py-1.5 text-right shadow-2xs">
              <p className="text-[10px] text-slate-500 uppercase">Utilization %</p>
              <p className="font-bold font-mono text-emerald-700 text-sm">
                {(
                  (siteReport.siteTotals.totalHours /
                    Math.max(
                      siteReport.siteTotals.totalHours + siteReport.siteTotals.totalDelaysMin / 60,
                      1
                    )) *
                  100
                ).toFixed(1)}
                %
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Excavator Activity Block Component (Strict Page Break Avoidance)
// ---------------------------------------------------------------------------
interface ExcavatorActivityBlockProps {
  readonly block: ExcavatorActivityBlockData;
}

function ExcavatorActivityBlock({ block }: ExcavatorActivityBlockProps) {
  return (
    <div
      className="excavator-activity-block avoid-break overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xs"
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      {/* 1. Excavator Header Metadata */}
      <div className="grid grid-cols-4 gap-2 border-slate-300 border-b bg-slate-100/80 px-4 py-2.5 text-xs">
        <div>
          <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider">
            Excavator:
          </span>
          <p className="font-bold text-slate-900">{block.excavatorName}</p>
          <p className="text-[10px] text-slate-500">{block.excavatorModel}</p>
        </div>

        <div>
          <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider">
            Material:
          </span>
          <p className="font-bold text-blue-700">{block.material}</p>
          <p className="text-[10px] text-slate-500">Unit: {block.materialUnit}</p>
        </div>

        <div>
          <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider">
            Block Mined:
          </span>
          <p className="font-bold text-slate-800">{block.blockMined}</p>
          <p className="text-[10px] text-slate-500">Active Pit Face</p>
        </div>

        <div className="text-right">
          <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider">
            Assigned Machines:
          </span>
          <p className="font-bold font-mono text-slate-900">
            {block.assignedMachines.length} Hauling Unit
            {block.assignedMachines.length === 1 ? '' : 's'}
          </p>
          <p className="text-[10px] text-slate-500">Matched Dispatch</p>
        </div>
      </div>

      {/* 2. Assigned Hauling Machines Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-slate-200 border-b bg-slate-50 font-bold text-[10px] text-slate-600 uppercase tracking-wider">
              <th className="px-3.5 py-2">Machine ID</th>
              <th className="px-3.5 py-2 text-right">Bin Factor</th>
              <th className="px-3.5 py-2 text-right">Total SMR Worked</th>
              <th className="px-3.5 py-2">Operator</th>
              <th className="px-3.5 py-2 text-right">Loads</th>
              <th className="px-3.5 py-2 text-right">Total ({block.materialUnit})</th>
              <th className="px-3.5 py-2">Delays</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {block.assignedMachines.map((hauler) => (
              <tr key={hauler.machineId} className="hover:bg-slate-50/50">
                <td className="px-3.5 py-2">
                  <div className="font-bold text-slate-900">{hauler.machineName}</div>
                  <div className="text-[10px] text-slate-500">{hauler.machineType}</div>
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-slate-700">
                  {hauler.binFactor.toFixed(1)} {hauler.materialUnit === 'Tonnes' ? 't' : 'BCM'}
                </td>
                <td className="px-3.5 py-2 text-right font-bold font-mono text-emerald-700">
                  {hauler.totalSmrWorked.toFixed(1)} hrs
                </td>
                <td className="px-3.5 py-2 text-slate-700">{hauler.operator}</td>
                <td className="px-3.5 py-2 text-right font-bold font-mono text-blue-700">
                  {hauler.loads}
                </td>
                <td className="px-3.5 py-2 text-right font-bold font-mono text-slate-900">
                  {hauler.rowTotal.toLocaleString()}
                </td>
                <td className="px-3.5 py-2 font-mono text-slate-600">
                  {hauler.delaysDisplay === '-' ? (
                    <span className="text-slate-400">-</span>
                  ) : (
                    <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 font-medium text-[10px] text-amber-800">
                      {hauler.delaysDisplay}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {block.assignedMachines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-slate-400 text-xs">
                  No hauling units assigned to this excavator for the shift.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Auto-Calculated Excavator Totals (Zero Operator Math) */}
      <div className="flex flex-wrap items-center justify-between border-slate-300 border-t bg-slate-100/90 px-4 py-2 font-semibold text-xs">
        <div className="font-bold text-slate-700 uppercase tracking-wider">
          Auto-Calculated Excavator Totals:
        </div>
        <div className="flex flex-wrap items-center gap-6 font-mono">
          <div>
            <span className="text-slate-500">Total Loads: </span>
            <strong className="text-blue-700">{block.autoTotals.totalLoads}</strong>
          </div>
          <div>
            <span className="text-slate-500">Total Material Moved: </span>
            <strong className="text-slate-900">
              {block.autoTotals.totalMaterialMoved.toLocaleString()} {block.materialUnit}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Avg Hauler SMR: </span>
            <strong className="text-emerald-700">
              {block.autoTotals.averageHaulerSmr.toFixed(1)} hrs
            </strong>
          </div>
        </div>
      </div>

      {/* 4. Categorized Delays Breakdown Grid (Compact 4-Column Grid) */}
      <div className="border-slate-300 border-t bg-slate-50/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold text-[10px] text-slate-600 uppercase tracking-wider">
            Delays Breakdown &amp; Operational Allowances
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            Total Block Downtime: <strong>{block.delaysGrid.totalDowntimeMins} mins</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          {/* Production Delays */}
          <div className="rounded border border-blue-200 bg-blue-50/40 p-2 text-xs">
            <div className="flex items-center justify-between font-bold text-[11px] text-blue-900">
              <span>Production</span>
              <span className="font-mono">{block.delaysGrid.production.totalMins}m</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600">
              {block.delaysGrid.production.items.map((item) => (
                <li key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium font-mono">{item.durationMins}m</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Engineering Delays */}
          <div className="rounded border border-amber-200 bg-amber-50/40 p-2 text-xs">
            <div className="flex items-center justify-between font-bold text-[11px] text-amber-900">
              <span>Engineering</span>
              <span className="font-mono">{block.delaysGrid.engineering.totalMins}m</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600">
              {block.delaysGrid.engineering.items.map((item) => (
                <li key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium font-mono">{item.durationMins}m</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Non-Site Related / Weather Delays */}
          <div className="rounded border border-sky-200 bg-sky-50/40 p-2 text-xs">
            <div className="flex items-center justify-between font-bold text-[11px] text-sky-900">
              <span>Weather / External</span>
              <span className="font-mono">{block.delaysGrid.external.totalMins}m</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600">
              {block.delaysGrid.external.items.map((item) => (
                <li key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium font-mono">{item.durationMins}m</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Standard Operational Allowances */}
          <div className="rounded border border-slate-300 bg-slate-100/60 p-2 text-xs">
            <div className="flex items-center justify-between font-bold text-[11px] text-slate-800">
              <span>Standard Allowances</span>
              <span className="font-mono">{block.delaysGrid.standard.totalMins}m</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600">
              {block.delaysGrid.standard.items.map((item) => (
                <li key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium font-mono">{item.durationMins}m</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
