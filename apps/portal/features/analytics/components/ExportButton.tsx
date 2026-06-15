"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";

interface ExportButtonProps {
  filename: string;
  rows: Record<string, unknown>[];
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) =>
      headers
        .map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

export function ExportButton({ filename, rows }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportCsv = () => {
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleExportExcel = async () => {
    const { exportToExcel } = await import("@repo/utils/client");
    await exportToExcel(rows, filename, "Sheet1");
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={rows.length === 0}
        type="button"
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/70 backdrop-blur-xl border border-black/[0.08] text-[var(--text-body)] text-sm font-medium hover:bg-white/90 shadow-card transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
      >
        <Download className="w-4 h-4" />
        <span>Export Report</span>
        <ChevronDown className="w-4.5 h-4.5 text-[var(--text-muted)]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white/90 backdrop-blur-xl border border-black/[0.08] shadow-window z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <FileText className="w-4 h-4 text-[var(--text-muted)]" />
            Download CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-accent-green" />
            Download Excel (.xlsx)
          </button>
        </div>
      )}
    </div>
  );
}
