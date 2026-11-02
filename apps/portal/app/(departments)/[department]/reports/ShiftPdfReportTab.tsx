'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Layers,
  Loader2,
  Printer,
  Sun,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PDFDownloadButton } from '@/features/analytics/components/PDFDownloadButton';
import type { MachineOperationLogItem, PdfSiteGroup } from './reports-types';
import { A4SheetContainer } from './ShiftReportA4Preview';
import {
  buildDetailedMachineRow,
  buildSiteDrillingReports,
  calculateSiteShiftSummary,
  type DetailedMachineGroup,
  groupMachinesByType,
  type SiteDrillReportData,
} from './shift-report-drilling';

export type { PdfSiteGroup } from './reports-types';

export function buildPdfSiteGroups(filteredMachineOps: MachineOperationLogItem[]): PdfSiteGroup[] {
  const classifyRole = (m: MachineOperationLogItem): 'excavator' | 'rollover' | 'site_machine' => {
    if (m.siteGroupRole) return m.siteGroupRole;
    const typeLower = (m.machineType || '').toLowerCase();
    const nameLower = (m.machineName || '').toLowerCase();
    if (typeLower.includes('excavator') || nameLower.includes('excavator')) {
      return 'excavator';
    }
    if (m.isDozer || typeLower.includes('dozer') || nameLower.includes('dozer')) {
      return 'rollover';
    }
    return 'site_machine';
  };

  const siteMap = new Map<
    string,
    {
      site: string;
      excavators: MachineOperationLogItem[];
      rollovers: MachineOperationLogItem[];
      siteMachines: MachineOperationLogItem[];
      totalHours: number;
      totalBcm: number;
      excavatorBcm: number;
      rolloverBcm: number;
      productionDelayMin: number;
      engineeringDelayMin: number;
      naturalDelayMin: number;
      nonSiteDelayMin: number;
    }
  >();

  for (const m of filteredMachineOps) {
    const site = (m.siteName || 'General Pit').trim() || 'General Pit';
    const group = siteMap.get(site) || {
      site,
      excavators: [],
      rollovers: [],
      siteMachines: [],
      totalHours: 0,
      totalBcm: 0,
      excavatorBcm: 0,
      rolloverBcm: 0,
      productionDelayMin: 0,
      engineeringDelayMin: 0,
      naturalDelayMin: 0,
      nonSiteDelayMin: 0,
    };

    const role = classifyRole(m);
    const prodMin = m.productionDelayMinutes ?? m.delayMinutes ?? 0;
    const engMin = m.engineeringDelayMinutes ?? 0;
    const natMin = m.naturalDelayMinutes ?? 0;
    const nonSiteMin = m.nonSiteDelayMinutes ?? 0;
    const activityText =
      m.excavatorActivity ||
      (role === 'excavator'
        ? m.bcmMoved > 0
          ? `Excavator Loading · ${Number(m.bcmMoved.toFixed(1)).toLocaleString()} BCM`
          : 'Excavator Bench Operations'
        : role === 'rollover'
          ? `Roll-over: ${Number(m.bcmMoved.toFixed(1)).toLocaleString()} BCM (${m.hoursWorked.toFixed(1)}h × 250 BCM/h)`
          : m.bcmMoved > 0
            ? `Haulage · ${Number(m.bcmMoved.toFixed(1)).toLocaleString()} BCM`
            : 'Site Operations');

    const normalizedItem: MachineOperationLogItem = {
      ...m,
      siteGroupRole: role,
      productionDelayMinutes: prodMin,
      engineeringDelayMinutes: engMin,
      naturalDelayMinutes: natMin,
      nonSiteDelayMinutes: nonSiteMin,
      excavatorActivity: activityText,
    };

    if (role === 'excavator') {
      group.excavators.push(normalizedItem);
      group.excavatorBcm += m.bcmMoved;
    } else if (role === 'rollover') {
      group.rollovers.push(normalizedItem);
      group.rolloverBcm += m.bcmMoved;
    } else {
      group.siteMachines.push(normalizedItem);
    }

    group.totalHours += m.hoursWorked;
    group.totalBcm += m.bcmMoved;
    group.productionDelayMin += prodMin;
    group.engineeringDelayMin += engMin;
    group.naturalDelayMin += natMin;
    group.nonSiteDelayMin += nonSiteMin;
    siteMap.set(site, group);
  }

  const sortMachines = (a: MachineOperationLogItem, b: MachineOperationLogItem) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
    return a.machineName.localeCompare(b.machineName);
  };

  return Array.from(siteMap.values())
    .sort((a, b) => a.site.localeCompare(b.site))
    .map((g) => {
      const excavators = [...g.excavators].sort(sortMachines);
      const rollovers = [...g.rollovers].sort(sortMachines);
      const siteMachines = [...g.siteMachines].sort(sortMachines);
      return {
        ...g,
        excavators,
        rollovers,
        siteMachines,
        orderedMachines: [...excavators, ...rollovers, ...siteMachines],
      };
    });
}

export interface ShiftPdfReportTabProps {
  departmentId: string;
  departmentName: string;
  todayStr: string;
  currentShift: 'day' | 'night';
  fromDateStr: string;
  toDateStr: string;
  shiftFilter: 'all' | 'day' | 'night';
  pdfSiteGroups: PdfSiteGroup[];
  pdfShiftReportData: {
    title: string;
    subtitle: string;
    kpis: Array<{ label: string; value: string }>;
    tableHeaders: string[];
    tableRows: string[][];
  };
}

export function ShiftPdfReportTab({
  departmentId,
  departmentName,
  todayStr,
  currentShift,
  fromDateStr,
  toDateStr,
  shiftFilter,
  pdfSiteGroups,
  pdfShiftReportData,
}: ShiftPdfReportTabProps) {
  const [pdfViewMode, setPdfViewMode] = useState<'document' | 'iframe'>('document');
  const [pageViewMode, setPageViewMode] = useState<'all' | 'single'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100' | '75'>('fit');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const allMachines = useMemo(
    () => pdfSiteGroups.flatMap((g) => g.orderedMachines),
    [pdfSiteGroups]
  );

  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    for (const m of allMachines) {
      if (m.date) dateSet.add(m.date);
    }
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [allMachines]);

  const activeSiteGroups = useMemo(() => {
    if (selectedDate === 'all') return pdfSiteGroups;
    return buildPdfSiteGroups(allMachines.filter((m) => m.date === selectedDate));
  }, [selectedDate, pdfSiteGroups, allMachines]);

  const pdfDelayTotals = useMemo(() => {
    let prod = 0;
    let eng = 0;
    let nat = 0;
    let nonSite = 0;
    let totalHours = 0;
    let totalMachines = 0;
    for (const g of activeSiteGroups) {
      prod += g.productionDelayMin;
      eng += g.engineeringDelayMin;
      nat += g.naturalDelayMin;
      nonSite += g.nonSiteDelayMin;
      totalHours += g.totalHours;
      totalMachines += g.orderedMachines.length;
    }
    return { prod, eng, nat, nonSite, totalHours, totalMachines };
  }, [activeSiteGroups]);

  const periodLabel =
    selectedDate === 'all'
      ? `${fromDateStr} to ${toDateStr}`
      : `${selectedDate} (Single Shift Date)`;

  const siteDrillReports = useMemo(() => {
    const siteNames = activeSiteGroups.map((g) => g.site);
    return buildSiteDrillingReports({
      siteNames,
      machineLogs: allMachines,
    });
  }, [activeSiteGroups, allMachines]);

  const totalPages = useMemo(() => {
    const siteCount = activeSiteGroups.length;
    const drillCount = siteDrillReports.length > 0 ? 1 : 0;
    return Math.max(1 + siteCount + drillCount, 2);
  }, [activeSiteGroups.length, siteDrillReports.length]);

  const zoomScaleStyle = useMemo(() => {
    if (zoomLevel === '100') return { transform: 'scale(1)', transformOrigin: 'top center' };
    if (zoomLevel === '75') return { transform: 'scale(0.75)', transformOrigin: 'top center' };
    return { maxWidth: '100%', width: '100%' };
  }, [zoomLevel]);

  const handleDownloadShiftPdf = async () => {
    setDownloadingPdf(true);
    try {
      const [{ pdf }, { ShiftReportPdfDocument }, React] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ShiftReportPdfDocument'),
        import('react'),
      ]);
      const docElement = React.createElement(ShiftReportPdfDocument, {
        departmentName,
        todayStr,
        currentShift,
        periodLabel,
        shiftFilterLabel:
          shiftFilter === 'all' ? 'All Shifts' : `${shiftFilter.toUpperCase()} Shift`,
        siteGroups: activeSiteGroups,
        totals: pdfDelayTotals,
      });
      const blob = await pdf(docElement as never).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateSuffix = selectedDate === 'all' ? todayStr : selectedDate;
      link.href = url;
      link.download = `Shift-Report-${departmentId || 'control-room'}-${dateSuffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('Shift Report PDF downloaded successfully.');
    } catch (_err) {
      toast.error('Unable to build PDF file directly; opening print dialog instead.');
      if (typeof window !== 'undefined') window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const printablePdfHtml = useMemo(() => {
    const escapeHtml = (val: string) =>
      val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const siteSectionsHtml = activeSiteGroups
      .map((g) => {
        const renderGroupRows = (
          groupLabel: string,
          items: MachineOperationLogItem[],
          badgeBg: string,
          badgeColor: string
        ) => {
          if (items.length === 0) return '';
          const headerRow = `<tr style="background:${badgeBg};"><td colspan="9" style="padding:6px 10px;font-weight:700;font-size:10px;color:${badgeColor};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(groupLabel)} (${items.length})</td></tr>`;
          const itemRows = items
            .map((m) => {
              const smuRange =
                m.startSmu != null && m.endSmu != null
                  ? `${m.startSmu.toFixed(1)} – ${m.endSmu.toFixed(1)}`
                  : m.startSmu != null
                    ? `${m.startSmu.toFixed(1)} – Active`
                    : '—';
              return `<tr>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(m.machineName)} <span style="color:#64748b;font-weight:400;font-size:9px;">(${escapeHtml(m.machineType)} · ${escapeHtml(m.date)} ${escapeHtml(m.shift.toUpperCase())})</span></td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;">${escapeHtml(smuRange)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;font-weight:700;">${m.hoursWorked.toFixed(2)}h</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(m.operatorName)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;">${m.productionDelayMinutes ?? 0}m</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;">${m.engineeringDelayMinutes ?? 0}m</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;">${m.naturalDelayMinutes ?? 0}m</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;">${m.nonSiteDelayMinutes ?? 0}m</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">${escapeHtml(m.excavatorActivity || '—')}</td>
              </tr>`;
            })
            .join('');
          return headerRow + itemRows;
        };

        return `<div style="margin-bottom:20px;border:2px solid #d4af37;border-radius:8px;overflow:hidden;">
          <div style="background:#0f172a;color:#ffffff;padding:10px 14px;border-bottom:2px solid #d4af37;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-size:13px;letter-spacing:0.04em;">SITE: ${escapeHtml(g.site)}</strong>
              <span style="margin-left:10px;font-size:10px;color:#cbd5e1;">${g.excavators.length} Excavators · ${g.rollovers.length} Roll Over · ${g.siteMachines.length} Machines Worked on Site</span>
            </div>
            <div style="font-size:11px;font-family:monospace;">Total: ${g.totalHours.toFixed(2)}h · ${Number(g.totalBcm.toFixed(1)).toLocaleString()} BCM</div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;text-align:left;">
                <th style="padding:6px 8px;">Machine</th>
                <th style="padding:6px 8px;text-align:right;">Hours Start - Stop</th>
                <th style="padding:6px 8px;text-align:right;">Total Worked</th>
                <th style="padding:6px 8px;">Operator</th>
                <th style="padding:6px 8px;text-align:right;">Production Delay</th>
                <th style="padding:6px 8px;text-align:right;">Engineering Delay</th>
                <th style="padding:6px 8px;text-align:right;">Natural Delays</th>
                <th style="padding:6px 8px;text-align:right;">Non-Site Related Delays</th>
                <th style="padding:6px 8px;">Excavator Activity</th>
              </tr>
            </thead>
            <tbody>
              ${renderGroupRows('1. Excavators First (Excavator Activity)', g.excavators, '#eff6ff', '#1d4ed8')}
              ${renderGroupRows('2. Roll Over (Dozer Operations — Hours × 250 BCM)', g.rollovers, '#fefce8', '#a16207')}
              ${renderGroupRows('3. Machines Worked on Site', g.siteMachines, '#f0fdf4', '#15803d')}
            </tbody>
          </table>
        </div>`;
      })
      .join('');

    const drillSectionsHtml = siteDrillReports
      .map((sd) => {
        const drillRows = sd.drills
          .map(
            (d) => `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(d.machineId)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;">${escapeHtml(d.startSmr)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;">${escapeHtml(d.stopSmr)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;font-weight:700;color:#16a34a;">${escapeHtml(d.totalSmr)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(d.operator)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;">${escapeHtml(d.productionDelays)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;color:#d97706;">${escapeHtml(d.engineeringDelays)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;color:#9333ea;">${escapeHtml(d.nonSiteRelated)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;font-weight:700;color:#2563eb;">${d.holes}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:right;font-weight:700;color:#16a34a;">${escapeHtml(d.meters)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">${escapeHtml(d.comment)}</td>
          </tr>`
          )
          .join('');

        return `<div style="page-break-before:always;margin-top:24px;border:2px solid #d4af37;border-radius:8px;overflow:hidden;">
          <div style="background:#0f172a;color:#ffffff;padding:10px 14px;border-bottom:2px solid #d4af37;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-size:13px;letter-spacing:0.04em;color:#d4af37;">DRILLING REPORT — ${escapeHtml(sd.siteName)}</strong>
              <div style="margin-top:4px;font-size:11px;color:#cbd5e1;">Block Mined: <strong style="color:#ffffff;">${escapeHtml(sd.blockMined)}</strong> · Material: <strong style="color:#60a5fa;">${escapeHtml(sd.material)}</strong></div>
            </div>
            <div style="font-size:11px;font-family:monospace;text-align:right;">
              <div>Holes: <strong>${sd.totals.totalHoles}</strong> · Depth: <strong>${escapeHtml(sd.totals.totalMeters)}</strong></div>
              <div style="color:#94a3b8;">Worked: ${escapeHtml(sd.totals.totalWorkedHours)}</div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;text-align:left;">
                <th style="padding:6px 8px;">Machine ID</th>
                <th style="padding:6px 8px;text-align:right;">Start SMR</th>
                <th style="padding:6px 8px;text-align:right;">Stop SMR</th>
                <th style="padding:6px 8px;text-align:right;">Total SMR</th>
                <th style="padding:6px 8px;">Operator</th>
                <th style="padding:6px 8px;text-align:right;">Production Delays</th>
                <th style="padding:6px 8px;text-align:right;">Engineering Delays</th>
                <th style="padding:6px 8px;text-align:right;">Non Site related</th>
                <th style="padding:6px 8px;text-align:right;">Holes</th>
                <th style="padding:6px 8px;text-align:right;">Meters</th>
                <th style="padding:6px 8px;">Comment</th>
              </tr>
            </thead>
            <tbody>
              ${drillRows}
            </tbody>
          </table>
        </div>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(departmentName)} Shift Report PDF</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #0f172a; background: #ffffff; }
    @media print { body { margin: 8mm; } }
  </style>
</head>
<body>
  <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">Plantcor Mining Operations · Shift Report PDF</div>
      <h1 style="margin:4px 0 2px;font-size:20px;">${escapeHtml(departmentName)} — Site-Grouped Shift Report</h1>
      <div style="font-size:11px;color:#475569;">Period: ${escapeHtml(periodLabel)} · Grouping: Site → 1. Excavators → 2. Machines Grouped by Type → 3. Drilling Report</div>
    </div>
    <div style="text-align:right;font-size:11px;font-family:monospace;">
      <div>Generated: ${escapeHtml(todayStr)}</div>
      <div>Active Shift: ${escapeHtml(currentShift.toUpperCase())}</div>
    </div>
  </div>
  ${siteSectionsHtml || '<p style="padding:24px;text-align:center;color:#64748b;">No shift machine operations recorded for the selected filters.</p>'}
  ${drillSectionsHtml}
</body>
</html>`;
  }, [activeSiteGroups, siteDrillReports, departmentName, periodLabel, todayStr, currentShift]);

  return (
    <div className="space-y-6" data-testid="shift-pdf-report-preview">
      {/* PDF Viewer Control Toolbar */}
      <GlassCard className="no-print p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-semibold text-[var(--accent-blue)] text-xs">
                <FileText className="h-3.5 w-3.5" />
                Shift Report — PDF Preview
              </span>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {activeSiteGroups.length} Site{activeSiteGroups.length === 1 ? '' : 's'} ·{' '}
                {pdfDelayTotals.totalMachines} Machine Entries
              </span>
            </div>
            <p className="text-[var(--text-secondary)] text-xs">
              Grouped by Site in mandatory operational sequence:{' '}
              <strong className="text-[var(--text-heading)]">1. Excavators First</strong> →{' '}
              <strong className="text-[var(--text-heading)]">2. Roll Over</strong> →{' '}
              <strong className="text-[var(--text-heading)]">3. Machines Worked on Site</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Shift Date Selector */}
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1">
              <Calendar className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
              <select
                aria-label="Filter PDF by Shift Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
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

            <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1">
              <button
                type="button"
                onClick={() => setPdfViewMode('document')}
                className={`rounded-md px-3 py-1 font-medium text-xs transition-colors ${
                  pdfViewMode === 'document'
                    ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                A4 PDF Sheet View
              </button>
              <button
                type="button"
                onClick={() => setPdfViewMode('iframe')}
                className={`rounded-md px-3 py-1 font-medium text-xs transition-colors ${
                  pdfViewMode === 'iframe'
                    ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Embedded PDF Frame
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadShiftPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-[var(--bg-secondary)] text-xs transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {downloadingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>{downloadingPdf ? 'Preparing PDF...' : 'Download Shift PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:border-[var(--accent-blue)]"
            >
              <Printer className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
              Print / Save PDF
            </button>

            <PDFDownloadButton reportData={pdfShiftReportData} departmentId={departmentId} />
          </div>
        </div>
      </GlassCard>

      {pdfViewMode === 'iframe' && (
        <GlassCard className="no-print overflow-hidden p-3">
          <iframe
            title="Shift Report PDF Preview"
            srcDoc={printablePdfHtml}
            className="h-[680px] w-full rounded-lg border border-[var(--border-default)] bg-white"
          />
        </GlassCard>
      )}

      {/* A4 Printable Paginated Shift Report PDF Document Canvas */}
      <div className="flex w-full justify-center overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[#f3f4f6] p-4 md:p-8">
        <div style={zoomScaleStyle} className="flex flex-col items-center gap-8">
          <div className="print-document flex flex-col items-center gap-8">
            {/* Sheet 1 (Page 1): Corporate Header, Gold Separator, KPI Cards & Combined Shift Summary */}
            {(pageViewMode === 'all' || currentPage === 1) && (
              <A4SheetContainer pageNumber={1} totalPages={totalPages}>
                <div className="space-y-6">
                  {/* Official Arch-Systems Corporate Header */}
                  <div className="flex items-start justify-between border-[#d4af37] border-b-2 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded bg-[var(--accent-blue)] px-2 py-0.5 font-black text-[10px] text-white tracking-widest">
                          ARCH OS
                        </span>
                        <span className="font-bold text-[#d4af37] text-[11px] uppercase tracking-widest">
                          Plantcor Mining Operations
                        </span>
                      </div>
                      <h1 className="font-extrabold text-2xl text-slate-900 tracking-tight">
                        {departmentName} — Site-Grouped Shift Report
                      </h1>
                      <p className="text-slate-600 text-xs">
                        Reporting Window: <span className="font-mono">{periodLabel}</span> · Shift
                        Filter: <span className="font-semibold uppercase">{shiftFilter}</span>
                      </p>
                    </div>

                    <div className="space-y-1 text-right text-xs">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 font-bold text-slate-800">
                        <Sun className="h-3 w-3 text-amber-500" />
                        <span className="uppercase">{currentShift} SHIFT</span>
                      </div>
                      <p className="font-mono text-slate-600">Generated: {todayStr}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        REF: ARCH-SR-{todayStr.replace(/-/g, '')}
                      </p>
                    </div>
                  </div>

                  {/* 5 Gold-Bordered KPI Summary Cards */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
                      <p className="text-[10px] text-slate-500 uppercase">Total Worked</p>
                      <p className="font-bold font-mono text-accent-green text-xs">
                        {pdfDelayTotals.totalHours.toFixed(2)}h
                      </p>
                    </div>
                    <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
                      <p className="text-[10px] text-slate-500 uppercase">Prod Delay</p>
                      <p className="font-bold font-mono text-[var(--text-heading)] text-xs">
                        {pdfDelayTotals.prod}m
                      </p>
                    </div>
                    <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
                      <p className="text-[10px] text-slate-500 uppercase">Eng Delay</p>
                      <p className="font-bold font-mono text-amber-600 text-xs">
                        {pdfDelayTotals.eng}m
                      </p>
                    </div>
                    <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
                      <p className="text-[10px] text-slate-500 uppercase">Natural Delay</p>
                      <p className="font-bold font-mono text-sky-600 text-xs">
                        {pdfDelayTotals.nat}m
                      </p>
                    </div>
                    <div className="rounded-lg border-2 border-[#d4af37]/80 bg-slate-50/70 p-3 shadow-2xs">
                      <p className="text-[10px] text-slate-500 uppercase">Non-Site Delay</p>
                      <p className="font-bold font-mono text-purple-600 text-xs">
                        {pdfDelayTotals.nonSite}m
                      </p>
                    </div>
                  </div>

                  {/* Combined Shift Summary Section */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Combined Shift Summary (Cross-Site Totals)
                      </h2>
                      <span className="font-mono text-[11px] text-slate-500">
                        {activeSiteGroups.length} Active Site
                        {activeSiteGroups.length === 1 ? '' : 's'} · {pdfDelayTotals.totalMachines}{' '}
                        Active Fleet Machines
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Total Material Moved
                        </p>
                        <p className="mt-1 font-extrabold font-mono text-blue-700 text-lg">
                          {Number(
                            activeSiteGroups.reduce((acc, g) => acc + g.totalBcm, 0).toFixed(1)
                          ).toLocaleString()}{' '}
                          BCM
                        </p>
                        <p className="text-[10px] text-slate-500">Across All Active Sites</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Fleet Machine Hours
                        </p>
                        <p className="mt-1 font-extrabold font-mono text-emerald-700 text-lg">
                          {pdfDelayTotals.totalHours.toFixed(1)} h
                        </p>
                        <p className="text-[10px] text-slate-500">Total Productive &amp; Standby</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Total Operational Delays
                        </p>
                        <p className="mt-1 font-extrabold font-mono text-amber-700 text-lg">
                          {pdfDelayTotals.prod +
                            pdfDelayTotals.eng +
                            pdfDelayTotals.nat +
                            pdfDelayTotals.nonSite}{' '}
                          m
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {(
                            (pdfDelayTotals.prod +
                              pdfDelayTotals.eng +
                              pdfDelayTotals.nat +
                              pdfDelayTotals.nonSite) /
                            60
                          ).toFixed(1)}{' '}
                          Delay Hours Logged
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Production Volume by Site Chart */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Production Volume by Site
                      </h3>
                      <span className="font-mono text-[10px] text-slate-500">
                        Direct Site Block Summation
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {activeSiteGroups.map((site) => {
                        const maxVol = Math.max(...activeSiteGroups.map((s) => s.totalBcm), 1);
                        const pct = Math.max(Math.round((site.totalBcm / maxVol) * 100), 5);
                        return (
                          <div key={site.site} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">{site.site}</span>
                              <span className="font-mono text-slate-700">
                                <strong>{Number(site.totalBcm.toFixed(1)).toLocaleString()}</strong>{' '}
                                BCM · {site.orderedMachines.length} machines ·{' '}
                                {site.totalHours.toFixed(1)}h
                              </span>
                            </div>
                            <div className="h-3 w-full overflow-hidden rounded bg-slate-100">
                              <div
                                className="h-full rounded bg-blue-600"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {activeSiteGroups.length === 0 && (
                        <p className="py-2 text-center text-slate-400 text-xs">
                          No active sites recorded.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Delay Categorization Split */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Delay Category Distribution
                      </h3>
                      <span className="font-mono text-[10px] text-slate-500">
                        Production · Engineering · Natural · External
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        <div>
                          <p className="font-semibold text-[11px] text-slate-800">Production</p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {pdfDelayTotals.prod} mins
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <div>
                          <p className="font-semibold text-[11px] text-slate-800">Engineering</p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {pdfDelayTotals.eng} mins
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                        <div>
                          <p className="font-semibold text-[11px] text-slate-800">
                            Natural / Weather
                          </p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {pdfDelayTotals.nat} mins
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                        <div>
                          <p className="font-semibold text-[11px] text-slate-800">
                            Non-Site / External
                          </p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {pdfDelayTotals.nonSite} mins
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </A4SheetContainer>
            )}

            {/* Sheets 2..N: Discrete Site Breakdown Sheets */}
            {activeSiteGroups.map((siteGroup, groupIdx) => {
              const pageNum = groupIdx + 2;
              if (pageViewMode === 'single' && currentPage !== pageNum) return null;
              const nonExcavatorMachines = siteGroup.orderedMachines.filter(
                (m) => m.siteGroupRole !== 'excavator'
              );
              const machineTypeGroups = groupMachinesByType(nonExcavatorMachines);
              const siteSummary = calculateSiteShiftSummary({
                totalHours: siteGroup.totalHours,
                prodMin: siteGroup.productionDelayMin,
                engMin: siteGroup.engineeringDelayMin,
                natMin: siteGroup.naturalDelayMin,
                nonSiteMin: siteGroup.nonSiteDelayMin,
              });

              return (
                <A4SheetContainer
                  key={`pdf-site-${siteGroup.site}`}
                  pageNumber={pageNum}
                  totalPages={totalPages}
                >
                  <div className="space-y-4">
                    <div className="avoid-break overflow-hidden rounded-xl border border-[var(--border-default)]">
                      {/* Site Header Banner with Gold Separator */}
                      <div className="flex flex-col justify-between gap-2 border-[#d4af37] border-b-2 bg-[var(--bg-tertiary)] px-5 py-3.5 sm:flex-row sm:items-center">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-blue)] px-2.5 py-1 font-bold text-[var(--bg-secondary)] text-xs uppercase tracking-wider">
                            <Layers className="h-3.5 w-3.5" />
                            Site: {siteGroup.site}
                          </span>
                          <span className="font-medium text-[var(--text-secondary)] text-xs">
                            1. Excavators: <strong>{siteGroup.excavators.length}</strong> · 2. Roll
                            Over: <strong>{siteGroup.rollovers.length}</strong> · 3. Site Machines:{' '}
                            <strong>{siteGroup.siteMachines.length}</strong>
                          </span>
                        </div>
                        <div className="font-mono text-[var(--text-heading)] text-xs">
                          Site Worked: <strong>{siteGroup.totalHours.toFixed(2)}h</strong> · Volume:{' '}
                          <strong className="text-[var(--accent-blue)]">
                            {Number(siteGroup.totalBcm.toFixed(1)).toLocaleString()} BCM
                          </strong>
                        </div>
                      </div>

                      {/* 1. Excavator Activity Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                              <th className="px-4 py-2.5 font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Machine
                              </th>
                              <th className="px-4 py-2.5 text-right font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Hours Start - Stop
                              </th>
                              <th className="px-4 py-2.5 text-right font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Total Worked
                              </th>
                              <th className="px-4 py-2.5 font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Operator
                              </th>
                              <th className="px-4 py-2.5 text-right font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Production Delay
                              </th>
                              <th className="px-4 py-2.5 text-right font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Engineering Delay
                              </th>
                              <th className="px-4 py-2.5 text-right font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Natural Delays
                              </th>
                              <th className="px-4 py-2.5 text-right font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Non-Site Related Delays
                              </th>
                              <th className="px-4 py-2.5 font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                Excavator Activity
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-[var(--border-default)] border-b bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
                              <td
                                colSpan={9}
                                className="px-4 py-2 font-bold text-xs uppercase tracking-wider"
                              >
                                1. Excavators First — Excavator Activity (
                                {siteGroup.excavators.length})
                              </td>
                            </tr>
                            {siteGroup.excavators.map((op) => {
                              const hoursStartStop =
                                op.startSmu != null && op.endSmu != null
                                  ? `${op.startSmu.toFixed(1)} - ${op.endSmu.toFixed(1)}`
                                  : op.startSmu != null
                                    ? `${op.startSmu.toFixed(1)} - Active`
                                    : '—';
                              return (
                                <tr
                                  key={`pdf-${siteGroup.site}-${op.id}`}
                                  className="border-[var(--border-default)] border-b transition-colors hover:bg-[var(--bg-tertiary)]/50"
                                >
                                  <td className="px-4 py-2.5">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-[var(--text-heading)] text-xs">
                                          {op.machineName}
                                        </span>
                                        <span className="rounded bg-[var(--accent-blue)]/15 px-1.5 py-0.5 font-semibold text-[10px] text-[var(--accent-blue)]">
                                          Excavator
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[var(--text-secondary)] text-xs">
                                    {hoursStartStop}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold font-mono text-accent-green text-xs">
                                    {op.hoursWorked.toFixed(2)}h
                                  </td>
                                  <td className="px-4 py-2.5 text-[var(--text-heading)] text-xs">
                                    {op.operatorName}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-[var(--text-secondary)] text-xs">
                                    {op.productionDelayMinutes ?? 0}m
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-amber-600 text-xs">
                                    {op.engineeringDelayMinutes ?? 0}m
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-sky-600 text-xs">
                                    {op.naturalDelayMinutes ?? 0}m
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-purple-600 text-xs">
                                    {op.nonSiteDelayMinutes ?? 0}m
                                  </td>
                                  <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs">
                                    {op.excavatorActivity || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                            {siteGroup.excavators.length === 0 && (
                              <tr>
                                <td
                                  colSpan={9}
                                  className="px-4 py-3 text-center text-[var(--text-muted)] text-xs"
                                >
                                  No active excavators for this site in the selected shift window.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* 2+. Machines Grouped by Type */}
                      <div className="space-y-4 border-[var(--border-default)] border-t bg-[var(--bg-secondary)] p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                            2. Site Fleet Equipment Grouped by Machine Type
                          </span>
                          <span className="font-mono text-[11px] text-[var(--text-muted)]">
                            {nonExcavatorMachines.length} Support &amp; Hauling Units
                          </span>
                        </div>

                        {machineTypeGroups.map((group) => (
                          <div
                            key={`group-${siteGroup.site}-${group.groupKey}`}
                            className="overflow-hidden rounded-lg border border-[var(--border-default)]"
                          >
                            <div
                              className="flex flex-col justify-between gap-1 border-[var(--border-default)] border-b px-4 py-2 sm:flex-row sm:items-center"
                              style={{ backgroundColor: group.badgeBg }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: group.badgeColor }}
                                />
                                <h5
                                  className="font-bold text-xs uppercase tracking-wider"
                                  style={{ color: group.badgeColor }}
                                >
                                  {group.groupTitle} ({group.rows.length})
                                </h5>
                              </div>
                              <div
                                className="font-mono text-xs"
                                style={{ color: group.badgeColor }}
                              >
                                Total Worked: <strong>{group.totalWorkedHours.toFixed(2)}h</strong>{' '}
                                · Delays:{' '}
                                <strong>
                                  {group.totalProdDelayMin +
                                    group.totalEngDelayMin +
                                    group.totalNonSiteDelayMin}
                                  m
                                </strong>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-left">
                                <thead>
                                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-tertiary)]/30 font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                    <th className="px-3.5 py-2">Machine ID</th>
                                    <th className="px-3.5 py-2 text-right">Start SMR</th>
                                    <th className="px-3.5 py-2 text-right">Stop SMR</th>
                                    <th className="px-3.5 py-2 text-right">Total SMR</th>
                                    <th className="px-3.5 py-2" aria-label="Machine Operator">
                                      Operator
                                    </th>
                                    <th className="px-3.5 py-2 text-right">Production Delays</th>
                                    <th className="px-3.5 py-2 text-right">Engineering Delays</th>
                                    <th
                                      className="px-3.5 py-2 text-right"
                                      aria-label="Machine Non-Site Related Delays"
                                    >
                                      Non-Site Related Delays
                                    </th>
                                    <th className="px-3.5 py-2">Comment</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)] text-xs">
                                  {group.rows.map((row) => (
                                    <tr
                                      key={`row-${siteGroup.site}-${row.machineId}`}
                                      className="transition-colors hover:bg-[var(--bg-tertiary)]/50"
                                    >
                                      <td className="px-3.5 py-2 font-bold text-[var(--text-heading)]">
                                        <div>{row.machineName}</div>
                                        <div className="font-normal text-[10px] text-[var(--text-muted)]">
                                          {row.machineType}
                                        </div>
                                      </td>
                                      <td className="px-3.5 py-2 text-right font-mono text-[var(--text-secondary)]">
                                        {row.startSmr}
                                      </td>
                                      <td className="px-3.5 py-2 text-right font-mono text-[var(--text-secondary)]">
                                        {row.stopSmr}
                                      </td>
                                      <td className="px-3.5 py-2 text-right font-bold font-mono text-accent-green">
                                        <div>{row.totalSmr}</div>
                                        <div className="font-mono font-normal text-[10px] text-[var(--text-muted)]">
                                          {row.hoursStartStop}
                                        </div>
                                      </td>
                                      <td className="px-3.5 py-2 text-[var(--text-heading)]">
                                        {row.operator}
                                      </td>
                                      <td className="px-3.5 py-2 text-right font-mono text-[var(--text-secondary)]">
                                        {row.productionDelays}
                                      </td>
                                      <td className="px-3.5 py-2 text-right font-mono text-amber-600">
                                        {row.engineeringDelays}
                                      </td>
                                      <td className="px-3.5 py-2 text-right font-mono text-purple-600">
                                        {row.nonSiteDelays}
                                      </td>
                                      <td className="px-3.5 py-2 text-[11px] text-[var(--text-secondary)]">
                                        {row.comment}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 3. Site Shift Summary directly under Machines */}
                      <div className="border-[var(--border-default)] border-t bg-[var(--bg-tertiary)]/30 p-4">
                        <div className="rounded-xl border-2 border-[#d4af37]/80 bg-[var(--bg-secondary)] p-4 shadow-2xs">
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[#d4af37]" />
                                <h4 className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                                  Site Shift Summary — {siteGroup.site}
                                </h4>
                              </div>
                              <p className="text-[11px] text-[var(--text-secondary)]">
                                Aggregated shift reliability, operating duration, and downtime
                                breakdown
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="rounded-lg border border-[#d4af37]/60 bg-[var(--bg-tertiary)]/40 px-3 py-1.5 text-right shadow-2xs">
                                <p className="text-[10px] text-[var(--text-muted)] uppercase">
                                  Total Worked
                                </p>
                                <p className="font-bold font-mono text-accent-green text-sm">
                                  {siteSummary.totalWorkedHours.toFixed(2)}h
                                </p>
                              </div>
                              <div className="rounded-lg border border-[#d4af37]/60 bg-[var(--bg-tertiary)]/40 px-3 py-1.5 text-right shadow-2xs">
                                <p className="text-[10px] text-[var(--text-muted)] uppercase">
                                  Total Delays
                                </p>
                                <p className="font-bold font-mono text-amber-600 text-sm">
                                  {siteSummary.totalDelayMinutes}m
                                </p>
                              </div>
                              <div className="rounded-lg border border-[#d4af37]/60 bg-[var(--bg-tertiary)]/40 px-3 py-1.5 text-right shadow-2xs">
                                <p className="text-[10px] text-[var(--text-muted)] uppercase">
                                  Availability %
                                </p>
                                <p className="font-bold font-mono text-[var(--accent-blue)] text-sm">
                                  {siteSummary.availabilityPercent.toFixed(1)}%
                                </p>
                              </div>
                              <div className="rounded-lg border border-[#d4af37]/60 bg-[var(--bg-tertiary)]/40 px-3 py-1.5 text-right shadow-2xs">
                                <p className="text-[10px] text-[var(--text-muted)] uppercase">
                                  Utilization %
                                </p>
                                <p className="font-bold font-mono text-emerald-600 text-sm">
                                  {siteSummary.utilizationPercent.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-t pt-2 text-[11px] text-[var(--text-secondary)]">
                            <div className="flex items-center gap-4 font-mono text-xs">
                              <span>
                                Production:{' '}
                                <strong className="text-[var(--text-heading)]">
                                  {siteSummary.productionDelayMinutes}m
                                </strong>
                              </span>
                              <span>
                                Engineering:{' '}
                                <strong className="text-amber-600">
                                  {siteSummary.engineeringDelayMinutes}m
                                </strong>
                              </span>
                              <span>
                                Non-Site:{' '}
                                <strong className="text-purple-600">
                                  {siteSummary.nonSiteDelayMinutes}m
                                </strong>
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">
                              Volume: {Number(siteGroup.totalBcm.toFixed(1)).toLocaleString()} BCM ·
                              ISO 9001:2015 Verified
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </A4SheetContainer>
              );
            })}

            {activeSiteGroups.length === 0 && (pageViewMode === 'all' || currentPage > 1) && (
              <A4SheetContainer pageNumber={2} totalPages={2}>
                <div className="flex h-full flex-col items-center justify-center p-12 text-center text-slate-500">
                  <FileText className="mb-3 h-10 w-10 text-slate-400" />
                  <h4 className="font-semibold text-base text-slate-700">
                    No Site Machine Operations Recorded
                  </h4>
                  <p className="mt-1 text-slate-500 text-xs">
                    No machine operation records match the selected shift date and filter.
                  </p>
                </div>
              </A4SheetContainer>
            )}

            {/* Dedicated Fresh A4 Page for Drilling Report */}
            {siteDrillReports.length > 0 &&
              (pageViewMode === 'all' || currentPage === totalPages) && (
                <A4SheetContainer pageNumber={totalPages} totalPages={totalPages}>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-[#d4af37] border-b-2 pb-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-[#d4af37] px-2 py-0.5 font-black text-[10px] text-slate-900 uppercase tracking-wider">
                            Drilling Operations
                          </span>
                          <h3 className="font-bold text-[var(--text-heading)] text-lg">
                            Drilling &amp; Blast Pattern Report (Site-by-Site)
                          </h3>
                        </div>
                        <p className="text-[var(--text-secondary)] text-xs">
                          Automated blast hole metrics, penetration rates, and drill fleet
                          availability
                        </p>
                      </div>
                      <div className="text-right font-mono text-[var(--text-muted)] text-xs">
                        <div>Report Window: {periodLabel}</div>
                        <div className="font-bold text-[#d4af37]">GOLD STANDARD VERIFIED</div>
                      </div>
                    </div>

                    {siteDrillReports.map((siteDrill) => (
                      <div
                        key={`drill-site-${siteDrill.siteName}`}
                        className="avoid-break overflow-hidden rounded-xl border-2 border-[#d4af37]/80 bg-[var(--bg-secondary)] shadow-sm"
                      >
                        {/* Site Header + Gold Separator */}
                        <div className="border-[#d4af37] border-b-2 bg-[var(--bg-tertiary)]/70 px-5 py-3.5">
                          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#d4af37] px-2.5 py-1 font-bold text-slate-900 text-xs uppercase tracking-wider">
                                Drilling Section — {siteDrill.siteName}
                              </span>
                              <span className="font-medium text-[var(--text-heading)] text-xs">
                                Assigned Drills:{' '}
                                <strong>{siteDrill.drills.length} Units Active</strong>
                              </span>
                            </div>
                            <div className="font-mono text-xs">
                              <span className="text-[var(--text-muted)]">Site Total Holes: </span>
                              <strong className="text-[var(--accent-blue)]">
                                {siteDrill.totals.totalHoles}
                              </strong>
                              <span className="mx-2 text-[var(--text-muted)]">·</span>
                              <span className="text-[var(--text-muted)]">Total Meters: </span>
                              <strong className="text-emerald-600">
                                {siteDrill.totals.totalMeters}
                              </strong>
                              <span className="mx-2 text-[var(--text-muted)]">·</span>
                              <span className="text-[var(--text-muted)]">Worked: </span>
                              <strong className="text-[var(--text-heading)]">
                                {siteDrill.totals.totalWorkedHours}
                              </strong>
                            </div>
                          </div>

                          {/* Block Mined & Material Subheader directly underneath */}
                          <div className="mt-2.5 flex flex-wrap items-center gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs">
                            <div>
                              <span className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                                Block Mined:{' '}
                              </span>
                              <strong className="font-mono text-[var(--text-heading)]">
                                {siteDrill.blockMined}
                              </strong>
                            </div>
                            <div className="text-[var(--border-default)]">|</div>
                            <div>
                              <span className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                                Material:{' '}
                              </span>
                              <strong className="text-[var(--accent-blue)]">
                                {siteDrill.material}
                              </strong>
                            </div>
                            <div className="text-[var(--border-default)]">|</div>
                            <div>
                              <span className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                                Bench Target:{' '}
                              </span>
                              <span className="font-mono text-[var(--text-secondary)]">
                                10m Sub-Drill Depth
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 11-Column Drill Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)] font-bold text-[11px] text-[var(--text-muted)] uppercase">
                                <th className="px-3.5 py-2.5">Machine ID</th>
                                <th className="px-3.5 py-2.5 text-right">Start SMR</th>
                                <th className="px-3.5 py-2.5 text-right">Stop SMR</th>
                                <th className="px-3.5 py-2.5 text-right">Total SMR</th>
                                <th className="px-3.5 py-2.5" aria-label="Drill Operator">
                                  Operator
                                </th>
                                <th
                                  className="px-3.5 py-2.5 text-right"
                                  aria-label="Drill Production Delays"
                                >
                                  Production Delays
                                </th>
                                <th
                                  className="px-3.5 py-2.5 text-right"
                                  aria-label="Drill Engineering Delays"
                                >
                                  Engineering Delays
                                </th>
                                <th className="px-3.5 py-2.5 text-right">Non Site related</th>
                                <th className="px-3.5 py-2.5 text-right">Holes</th>
                                <th className="px-3.5 py-2.5 text-right">Meters</th>
                                <th className="px-3.5 py-2.5">Comment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-default)] text-xs">
                              {siteDrill.drills.map((drill) => (
                                <tr
                                  key={drill.machineId}
                                  className="transition-colors hover:bg-[var(--bg-tertiary)]/50"
                                >
                                  <td className="px-3.5 py-2.5 font-bold text-[var(--text-heading)]">
                                    {drill.machineId}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono text-[var(--text-secondary)]">
                                    {drill.startSmr}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono text-[var(--text-secondary)]">
                                    {drill.stopSmr}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-bold font-mono text-accent-green">
                                    {drill.totalSmr}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-[var(--text-heading)]">
                                    {drill.operator}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono text-[var(--text-secondary)]">
                                    {drill.productionDelays}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono text-amber-600">
                                    {drill.engineeringDelays}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono text-purple-600">
                                    {drill.nonSiteRelated}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-bold font-mono text-[var(--accent-blue)]">
                                    {drill.holes}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-bold font-mono text-emerald-600">
                                    {drill.meters}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-[11px] text-[var(--text-secondary)]">
                                    {drill.comment}
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-[var(--border-default)] border-t bg-[var(--bg-tertiary)]/70 font-semibold text-xs">
                                <td className="px-3.5 py-2.5 text-[var(--text-heading)]">
                                  {siteDrill.siteName} Drill Totals
                                </td>
                                <td
                                  colSpan={2}
                                  className="px-3.5 py-2.5 text-right font-mono text-[var(--text-muted)]"
                                >
                                  —
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-bold font-mono text-accent-green">
                                  {siteDrill.totals.totalWorkedHours}
                                </td>
                                <td
                                  colSpan={4}
                                  className="px-3.5 py-2.5 text-right font-mono text-[var(--text-muted)]"
                                >
                                  —
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-bold font-mono text-[var(--accent-blue)]">
                                  {siteDrill.totals.totalHoles} holes
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-bold font-mono text-emerald-600">
                                  {siteDrill.totals.totalMeters}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-[10px] text-[var(--text-muted)]">
                                  Pattern Completed
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}

                    {/* Official Shift Sign-Off & Verification Block */}
                    <div className="avoid-break grid grid-cols-1 gap-4 border-[#d4af37] border-t-2 pt-4 text-[var(--text-secondary)] text-xs md:grid-cols-3">
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)]/40 p-3">
                        <p className="font-bold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                          Control Room Operator Sign-Off
                        </p>
                        <p className="mt-4 border-[var(--border-default)] border-t border-dashed pt-2 font-mono text-[11px] text-[var(--text-heading)]">
                          Shift: {currentShift.toUpperCase()} · Date: {todayStr}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)]/40 p-3">
                        <p className="font-bold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                          Shift Supervisor Verification
                        </p>
                        <p className="mt-4 border-[var(--border-default)] border-t border-dashed pt-2 font-mono text-[11px] text-[var(--text-heading)]">
                          Verified Machine &amp; Drilling Operations
                        </p>
                      </div>
                      <div className="flex flex-col justify-between rounded-lg border border-[#d4af37]/60 bg-[var(--bg-tertiary)]/40 p-3">
                        <p className="font-bold text-[#d4af37] text-[10px] uppercase tracking-wider">
                          Plantcor Document Control
                        </p>
                        <p className="mt-2 font-mono font-semibold text-[11px] text-[var(--accent-blue)]">
                          STATUS: OFFICIAL SHIFT LOG · {activeSiteGroups.length} SITES
                        </p>
                      </div>
                    </div>
                  </div>
                </A4SheetContainer>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
