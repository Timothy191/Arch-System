import { toast } from 'sonner';
import type { PresentationSnapshot } from './presentation-data';

export interface PresentationPdfDownloadResult {
  readonly ok: boolean;
  readonly filename: string;
}

/**
 * Generates and downloads the landscape A4 Investor & CEO Briefing PDF on demand.
 * `@react-pdf/renderer` is imported dynamically to avoid increasing initial JS bundles.
 */
export async function downloadInvestorPresentationPdf(
  snapshot: PresentationSnapshot
): Promise<PresentationPdfDownloadResult> {
  const dateStamp = snapshot.generatedAtIso.slice(0, 10) || 'latest';
  const filename = `Arch-System-Executive-Presentation-${dateStamp}.pdf`;

  try {
    const [{ pdf }, { InvestorBriefPdfDocument }, React] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./InvestorBriefPdfDocument'),
      import('react'),
    ]);

    const pdfElement = React.createElement(InvestorBriefPdfDocument, { snapshot });
    const blob = await pdf(pdfElement as Parameters<typeof pdf>[0]).toBlob();
    const blobUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    toast.success(`Downloaded ${filename}`);
    return { ok: true, filename };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF rendering failed';
    toast.error(`Unable to generate Investor PDF: ${message}`);
    return { ok: false, filename };
  }
}
