'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { Download, FileText, Loader2, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EngineeringReportsNav } from './EngineeringReportsNav';
import type { EngineeringReportsPayload } from './engineering-reports-model';

interface EngineeringPdfReportClientProps {
  readonly payload: EngineeringReportsPayload;
}

const A4_PREVIEW_SHELL =
  'mx-auto box-border flex w-full max-w-[210mm] flex-col justify-between rounded-md border border-slate-300 bg-white p-8 text-slate-900 shadow-lg';
const PDF_PREVIEW_BADGE_CLASS =
  'inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-blue)]/10 px-2.5 py-1 font-bold text-[var(--accent-blue)] text-xs';

export function EngineeringPdfReportClient({ payload }: EngineeringPdfReportClientProps) {
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100' | '75'>('fit');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [includeBreakdowns, setIncludeBreakdowns] = useState(true);
  const [includeTireSummary, setIncludeTireSummary] = useState(true);
  const [includeMachineHours, setIncludeMachineHours] = useState(true);

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

  const zoomStyle = useMemo(() => {
    if (zoomLevel === '100') return { transform: 'scale(1)', transformOrigin: 'top center' };
    if (zoomLevel === '75') return { transform: 'scale(0.75)', transformOrigin: 'top center' };
    return undefined;
  }, [zoomLevel]);

  const { summary } = payload;

  return (
    <div className="space-y-6">
      <EngineeringReportsNav payload={payload} activeRoute="pdf-report" />

      <div className="space-y-4" data-testid="engineering-pdf-view">
        {/* PDF Toolbar & Formatting Controls */}
        <GlassCard className="no-print flex flex-wrap items-center justify-between gap-3 p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={PDF_PREVIEW_BADGE_CLASS}>
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Live A4 Executive Preview
            </span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={includeBreakdowns}
                onChange={(e) => setIncludeBreakdowns(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <span>Breakdowns</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={includeTireSummary}
                onChange={(e) => setIncludeTireSummary(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <span>Tire Summary</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={includeMachineHours}
                onChange={(e) => setIncludeMachineHours(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <span>Machine Hours</span>
            </label>
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
          <div style={zoomStyle} className={A4_PREVIEW_SHELL} data-testid="engineering-pdf-preview">
            <div className="space-y-6">
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

              {includeBreakdowns && (
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
              )}

              {(includeTireSummary || includeMachineHours) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {includeTireSummary && (
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
                  )}
                  {includeMachineHours && (
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
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between border-slate-300 border-t pt-3 font-mono text-[10px] text-slate-600">
              <span>Arch-Systems · Plantcor Engineering Document Control</span>
              <span>A4 · ISO 9001:2015</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
