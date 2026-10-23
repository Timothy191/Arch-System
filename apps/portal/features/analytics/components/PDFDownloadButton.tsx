'use client';

import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { generateMonthlyReport } from '@/app/actions';

interface PDFDownloadButtonProps {
  reportData: {
    title: string;
    subtitle: string;
    kpis: { label: string; value: string }[];
    tableHeaders: string[];
    tableRows: string[][];
  };
  departmentId?: string;
}

export function PDFDownloadButton({ reportData, departmentId }: PDFDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await generateMonthlyReport(reportData, departmentId);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
        toast.success('PDF report generated successfully!');
      } else {
        toast.error('Failed to generate PDF report.');
      }
    } catch (_err) {
      toast.error('An error occurred while generating the PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-black/[0.08] bg-white/70 px-4 py-2 font-medium text-[var(--text-body)] text-sm shadow-card backdrop-blur-xl transition-colors hover:bg-white/90 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-blue)]" />
      ) : (
        <FileText className="h-4 w-4 text-accent-red" />
      )}
      <span>{loading ? 'Generating PDF...' : 'Export PDF'}</span>
    </button>
  );
}
