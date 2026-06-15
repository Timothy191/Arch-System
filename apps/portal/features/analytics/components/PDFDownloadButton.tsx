"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { generateMonthlyReport } from "@/app/actions";
import { toast } from "sonner";

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

export function PDFDownloadButton({
  reportData,
  departmentId,
}: PDFDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await generateMonthlyReport(reportData, departmentId);
      if (res.success && res.url) {
        window.open(res.url, "_blank");
        toast.success("PDF report generated successfully!");
      } else {
        toast.error("Failed to generate PDF report.");
      }
    } catch (err) {
      toast.error("An error occurred while generating the PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/70 backdrop-blur-xl border border-black/[0.08] text-[var(--text-body)] text-sm font-medium hover:bg-white/90 shadow-card transition-colors disabled:opacity-50 min-h-[44px]"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-blue)]" />
      ) : (
        <FileText className="w-4 h-4 text-accent-red" />
      )}
      <span>{loading ? "Generating PDF..." : "Export PDF"}</span>
    </button>
  );
}
