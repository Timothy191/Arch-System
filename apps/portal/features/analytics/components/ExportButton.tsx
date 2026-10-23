'use client';

import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ExportButtonProps {
  filename: string;
  rows: Record<string, unknown>[];
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) =>
      headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ];
  return lines.join('\n');
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportCsv = () => {
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleExportExcel = async () => {
    const { exportToExcel } = await import('@repo/utils/client');
    await exportToExcel(rows, filename, 'Sheet1');
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={rows.length === 0}
        type="button"
        className="flex min-h-[44px] items-center gap-2 rounded-lg border border-black/[0.08] bg-white/70 px-4 py-2 font-medium text-[var(--text-body)] text-sm shadow-card backdrop-blur-xl transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-4 w-4" />
        <span>Export Report</span>
        <Logo
          variant="gold"
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out',
            isOpen ? 'rotate-0' : 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="fade-in slide-in-from-top-1 absolute right-0 z-50 mt-2 w-48 animate-in overflow-hidden rounded-lg border border-black/[0.08] bg-white/90 py-1 shadow-window backdrop-blur-xl duration-150">
          <button
            onClick={handleExportCsv}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[var(--text-body)] text-sm transition-colors hover:bg-[var(--bg-secondary)]"
          >
            <FileText className="h-4 w-4 text-[var(--text-muted)]" />
            Download CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[var(--text-body)] text-sm transition-colors hover:bg-[var(--bg-secondary)]"
          >
            <FileSpreadsheet className="h-4 w-4 text-accent-green" />
            Download Excel (.xlsx)
          </button>
        </div>
      )}
    </div>
  );
}
