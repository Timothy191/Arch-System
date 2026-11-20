import { toast } from 'sonner';
import {
  buildPlantInventoryCsv,
  type EnrichedPlantStockItem,
  type PlantInventoryPdfExportOptions,
} from './plant-inventory-analytics';

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
 * Generates the vector A4 Plant Inventory report on demand. `@react-pdf/renderer` is
 * dynamically imported so it never lands in the initial client bundle. Falls back to the
 * browser print dialog when direct generation fails. Resolves `true` on a direct download.
 */
export async function downloadPlantInventoryPdf(
  options: PlantInventoryPdfExportOptions
): Promise<boolean> {
  try {
    const [{ pdf }, { PlantInventoryPdfDocument }, React] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./PlantInventoryPdfDocument'),
      import('react'),
    ]);
    const docElement = React.createElement(PlantInventoryPdfDocument, options);
    const blob = await pdf(docElement as never).toBlob();
    triggerBlobDownload(blob, `Plant-Inventory-Report-${options.today}.pdf`);
    toast.success('Plant Inventory PDF report downloaded.');
    return true;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    toast.error(`Direct PDF generation failed (${reason}); opening print preview instead.`);
    if (typeof window !== 'undefined') window.print();
    return false;
  }
}

export function downloadPlantInventoryCsv(options: {
  readonly items: readonly EnrichedPlantStockItem[];
  readonly today: string;
}): void {
  const csv = buildPlantInventoryCsv(options);
  triggerBlobDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `plant-inventory-report-${options.today}.csv`
  );
  toast.success(`Exported ${options.items.length} stock lines to CSV.`);
}
