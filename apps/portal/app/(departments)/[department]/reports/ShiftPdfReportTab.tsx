'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Calendar, Download, FileText, Layers, Loader2, Printer } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PDFDownloadButton } from '@/features/analytics/components/PDFDownloadButton';
import type { MachineOperationLogItem, PdfSiteGroup } from './reports-types';

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

        return `<div style="margin-bottom:20px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
          <div style="background:#0f172a;color:#ffffff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
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
      <div style="font-size:11px;color:#475569;">Period: ${escapeHtml(periodLabel)} · Grouping: Site → 1. Excavators → 2. Roll Over → 3. Machines Worked on Site</div>
    </div>
    <div style="text-align:right;font-size:11px;font-family:monospace;">
      <div>Generated: ${escapeHtml(todayStr)}</div>
      <div>Active Shift: ${escapeHtml(currentShift.toUpperCase())}</div>
    </div>
  </div>
  ${siteSectionsHtml || '<p style="padding:24px;text-align:center;color:#64748b;">No shift machine operations recorded for the selected filters.</p>'}
</body>
</html>`;
  }, [activeSiteGroups, departmentName, periodLabel, todayStr, currentShift]);

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

      {/* A4 Printable Shift Report PDF Document Sheet */}
      <div className="print-document overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-sm">
        {/* PDF Document Header Banner */}
        <div className="flex flex-col justify-between gap-4 border-[var(--border-default)] border-b-2 bg-[var(--bg-tertiary)]/50 px-6 py-5 md:flex-row md:items-end">
          <div className="space-y-1">
            <p className="font-bold text-[11px] text-[var(--accent-blue)] uppercase tracking-widest">
              Plantcor Mining Operations · Official Shift Report PDF
            </p>
            <h3 className="font-bold text-[var(--text-heading)] text-xl">
              {departmentName} — Site-Grouped Shift Report
            </h3>
            <p className="text-[var(--text-secondary)] text-xs">
              Reporting Window: <span className="font-mono">{periodLabel}</span> · Shift Filter:{' '}
              <span className="font-semibold uppercase">{shiftFilter}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-5">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Total Worked</p>
              <p className="font-bold font-mono text-accent-green text-xs">
                {pdfDelayTotals.totalHours.toFixed(2)}h
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Prod Delay</p>
              <p className="font-bold font-mono text-[var(--text-heading)] text-xs">
                {pdfDelayTotals.prod}m
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Eng Delay</p>
              <p className="font-bold font-mono text-amber-600 text-xs">{pdfDelayTotals.eng}m</p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Natural Delay</p>
              <p className="font-bold font-mono text-sky-600 text-xs">{pdfDelayTotals.nat}m</p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Non-Site Delay</p>
              <p className="font-bold font-mono text-purple-600 text-xs">
                {pdfDelayTotals.nonSite}m
              </p>
            </div>
          </div>
        </div>

        {/* Site-Grouped Shift Tables */}
        <div className="space-y-8 p-6">
          {activeSiteGroups.map((siteGroup) => {
            const renderRoleSection = (
              sectionKey: string,
              sectionTitle: string,
              roleBadgeLabel: string,
              items: MachineOperationLogItem[],
              headerClassName: string,
              badgeClassName: string
            ) => {
              if (items.length === 0) return null;
              return (
                <Fragment key={sectionKey}>
                  <tr className={headerClassName}>
                    <td
                      colSpan={9}
                      className="px-4 py-2 font-bold text-xs uppercase tracking-wider"
                    >
                      {sectionTitle} ({items.length})
                    </td>
                  </tr>
                  {items.map((op) => {
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
                              <span
                                className={`rounded px-1.5 py-0.5 font-semibold text-[10px] ${badgeClassName}`}
                              >
                                {roleBadgeLabel}
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
                </Fragment>
              );
            };

            return (
              <div
                key={`pdf-site-${siteGroup.site}`}
                className="avoid-break overflow-hidden rounded-xl border border-[var(--border-default)]"
              >
                <div className="flex flex-col justify-between gap-2 border-[var(--border-default)] border-b bg-[var(--bg-tertiary)] px-5 py-3.5 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-blue)] px-2.5 py-1 font-bold text-[var(--bg-secondary)] text-xs uppercase tracking-wider">
                      <Layers className="h-3.5 w-3.5" />
                      Site: {siteGroup.site}
                    </span>
                    <span className="font-medium text-[var(--text-secondary)] text-xs">
                      1. Excavators: <strong>{siteGroup.excavators.length}</strong> · 2. Roll Over:{' '}
                      <strong>{siteGroup.rollovers.length}</strong> · 3. Site Machines:{' '}
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

                {/* Site Machines Table */}
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
                      {renderRoleSection(
                        'excavator',
                        '1. Excavators First — Excavator Activity',
                        'Excavator',
                        siteGroup.excavators,
                        'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-b border-[var(--border-default)]',
                        'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                      )}
                      {renderRoleSection(
                        'rollover',
                        '2. Roll Over — Dozer Operations (Hours × 250 BCM)',
                        'Roll Over',
                        siteGroup.rollovers,
                        'bg-amber-500/10 text-amber-700 border-b border-[var(--border-default)]',
                        'bg-amber-500/15 text-amber-700'
                      )}
                      {renderRoleSection(
                        'site_machine',
                        '3. Machines Worked on Site',
                        'Site Machine',
                        siteGroup.siteMachines,
                        'bg-emerald-500/10 text-emerald-700 border-b border-[var(--border-default)]',
                        'bg-emerald-500/15 text-emerald-700'
                      )}
                      <tr className="bg-[var(--bg-tertiary)]/70 font-semibold text-xs">
                        <td className="px-4 py-2.5 text-[var(--text-heading)]">
                          {siteGroup.site} Subtotal ({siteGroup.orderedMachines.length} machines)
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--text-muted)]">
                          —
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-accent-green">
                          {siteGroup.totalHours.toFixed(2)}h
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-muted)]">—</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--text-heading)]">
                          {siteGroup.productionDelayMin}m
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-600">
                          {siteGroup.engineeringDelayMin}m
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sky-600">
                          {siteGroup.naturalDelayMin}m
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-purple-600">
                          {siteGroup.nonSiteDelayMin}m
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[var(--accent-blue)]">
                          Excavator: {Number(siteGroup.excavatorBcm.toFixed(1)).toLocaleString()}{' '}
                          BCM · Roll-over:{' '}
                          {Number(siteGroup.rolloverBcm.toFixed(1)).toLocaleString()} BCM
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {activeSiteGroups.length === 0 && (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">
              No shift machine operations found for the selected site/shift filter.
            </div>
          )}

          {/* Official Shift Sign-Off & Verification Block */}
          <div className="avoid-break grid grid-cols-1 gap-4 border-[var(--border-default)] border-t pt-4 text-[var(--text-secondary)] text-xs md:grid-cols-3">
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
                Verified Site Sequence (1 → 2 → 3)
              </p>
            </div>
            <div className="flex flex-col justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)]/40 p-3">
              <p className="font-bold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Plantcor Document Control
              </p>
              <p className="mt-2 font-mono font-semibold text-[11px] text-[var(--accent-blue)]">
                STATUS: OFFICIAL SHIFT LOG · {activeSiteGroups.length} SITES
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
