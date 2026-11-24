import { toast } from 'sonner';
import type { ProductionPdfScope, ProductionPerformanceData } from './production-types';

const OBJECT_URL_REVOKE_DELAY_MS = 5_000;

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
}

/**
 * Generates the vector A4 Production Foreman & Combined Delays PDF on demand.
 */
export async function downloadProductionForemanPdf(options: {
  data: ProductionPerformanceData;
  scope: ProductionPdfScope;
}): Promise<boolean> {
  try {
    const [{ pdf }, { ProductionForemanPdfDocument }, React] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./ProductionForemanPdfDocument'),
      import('react'),
    ]);
    const docElement = React.createElement(ProductionForemanPdfDocument, {
      data: options.data,
      scope: options.scope,
    });
    const blob = await pdf(docElement as never).toBlob();
    triggerBlobDownload(blob, `Production-Foreman-Delays-${options.data.selectedMonth}.pdf`);
    toast.success('Production Foreman & Delays PDF downloaded.');
    return true;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    toast.error(`Direct PDF generation failed (${reason}); opening print preview instead.`);
    if (typeof window !== 'undefined') window.print();
    return false;
  }
}

export function downloadProductionReportCsv(data: ProductionPerformanceData): void {
  const headers = [
    'Date',
    'Status',
    'Pit BCM Moved',
    'Daily Pit BCM Target',
    'Variance (BCM)',
    'Haul Loads',
    'Rollover BCM',
    'ROM Coal (t)',
    'Overburden Waste (t)',
    'Combined Delays (hrs)',
  ];
  const rows = data.dailyRows.map((row) => [
    row.date,
    row.hasData ? 'Captured' : 'No data captured',
    row.pitBcm,
    row.pitBcmTarget,
    row.pitBcmVariance,
    row.haulLoads,
    row.rolloverBcm,
    row.coalTonnes,
    row.wasteTonnes,
    row.combinedDelayHours,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  triggerBlobDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `production-foreman-delays-${data.selectedMonth}.csv`
  );
  toast.success(`Exported ${data.monthLabel} Production vs Delays CSV.`);
}
