import { toast } from 'sonner';
import type { OfficeSopLiveReportData } from './actions';

const OBJECT_URL_REVOKE_DELAY_MS = 5_000;
const SOP_DOCUMENT_ID = 'office-doc-shift-handover-sop';

export interface OfficeSopPdfDownloadOptions {
  readonly reportData: OfficeSopLiveReportData;
  readonly fileName?: string;
}

function buildOfficePdfFileName(reportData: OfficeSopLiveReportData): string {
  if (reportData.documentId === SOP_DOCUMENT_ID) {
    return `Executive-Shift-Handover-Safety-SOP-${reportData.operationalDate}.pdf`;
  }
  const cleanSlug = reportData.documentTitle
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const baseName = cleanSlug.length > 0 ? cleanSlug : 'Office-Executive-Report';
  return `${baseName}-${reportData.operationalDate}.pdf`;
}

function triggerPdfBlobDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MS);
}

/**
 * Dynamically imports `@react-pdf/renderer` and `OfficeSopPdfDocument` on demand,
 * populates the A4 SOP template with live operational telemetry, and triggers
 * an immediate browser file auto-download.
 */
export async function downloadOfficeSopPdf(options: OfficeSopPdfDownloadOptions): Promise<boolean> {
  const { reportData, fileName } = options;
  const targetFileName = fileName ?? buildOfficePdfFileName(reportData);

  try {
    const [{ pdf }, { OfficeSopPdfDocument }, React] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./OfficeSopPdfDocument'),
      import('react'),
    ]);
    const docElement = React.createElement(OfficeSopPdfDocument, { reportData });
    const blob = await pdf(docElement as never).toBlob();
    triggerPdfBlobDownload(blob, targetFileName);
    toast.success(`Downloaded live PDF report: ${targetFileName}`);
    return true;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    toast.error(`Failed to generate live SOP PDF (${reason}).`);
    return false;
  }
}
