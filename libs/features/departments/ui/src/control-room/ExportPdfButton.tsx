'use client';

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

export interface ExportPdfParams {
  departmentId: string;
  shiftDate: string;
  shiftType: 'day' | 'night';
}

export interface ExportPdfResult {
  success: boolean;
  htmlContent?: string;
  pdfBase64?: string;
  fileName?: string;
  error?: string;
}

interface ExportPdfButtonProps {
  departmentId: string;
  shiftDate: string;
  shiftType: 'day' | 'night';
  isShiftClosed: boolean;
  onExport?: (params: ExportPdfParams) => Promise<ExportPdfResult>;
}

// AGENT-TRACE: Export signed PDF button triggering cryptographic compilation seal and print artifact download.
export function ExportPdfButton({
  departmentId,
  shiftDate,
  shiftType,
  isShiftClosed,
  onExport,
}: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload() {
    if (!onExport) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await onExport({ departmentId, shiftDate, shiftType });
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to generate report export');
        return;
      }

      if (res.htmlContent) {
        // Open print view in new window or trigger print
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(res.htmlContent);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 300);
        }
      } else if (res.pdfBase64) {
        const byteCharacters = atob(res.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = res.fileName || 'Shift_Report.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export error';
      setErrorMessage(`Export failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-arch-border-subtle bg-arch-surface-secondary px-3 py-1.5 font-semibold text-arch-text-primary text-xs shadow-card transition-all hover:bg-arch-surface-tertiary active:scale-95 disabled:opacity-50"
        title={isShiftClosed ? 'Export Signed PDF with Digital Seal' : 'Download Draft PDF'}
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-arch-brand-blue" />
            <span>Generating Signed Report...</span>
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5 text-arch-brand-blue" />
            <span>{isShiftClosed ? 'Export Signed PDF' : 'Download Draft PDF'}</span>
          </>
        )}
      </button>
      {errorMessage && (
        <span className="mt-1 font-medium text-[10px] text-accent-red">{errorMessage}</span>
      )}
    </div>
  );
}
