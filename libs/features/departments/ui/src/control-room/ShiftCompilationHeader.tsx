'use client';

import {
  Calendar,
  CheckCircle,
  Clock,
  Database,
  Loader2,
  Lock,
  Moon,
  Printer,
  Sun,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ExportPdfButton, type ExportPdfParams, type ExportPdfResult } from './ExportPdfButton';

interface ShiftCompilationHeaderProps {
  departmentId: string;
  departmentSlug: string;
  shiftDate: string;
  shiftType: 'day' | 'night';
  status: 'open' | 'closed';
  closedAt?: string | null;
  onOpenCloseoutModal: () => void;
  onExportPdf?: (params: ExportPdfParams) => Promise<ExportPdfResult>;
}

export function ShiftCompilationHeader({
  departmentId,
  departmentSlug,
  shiftDate,
  shiftType,
  status,
  closedAt,
  onOpenCloseoutModal,
  onExportPdf,
}: ShiftCompilationHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);

  const handleDateChange = (newDate: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('date', newDate);
    router.push(`/${departmentSlug}/shift-compilation?${params.toString()}`);
  };

  const handleShiftChange = (newShift: 'day' | 'night') => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('shift', newShift);
    router.push(`/${departmentSlug}/shift-compilation?${params.toString()}`);
  };

  const handleGenerateReport = async () => {
    startTransition(async () => {
      try {
        const shiftId = `shift_${departmentSlug}_${shiftDate}_${shiftType}`;
        const res = await fetch('/api/control-room/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shiftId }),
        });

        if (!res.ok) throw new Error('Workflow failed');
        setWorkflowStatus('Aggregating SCADA telemetry in background...');
        setTimeout(() => setWorkflowStatus(null), 5000);
      } catch (e) {
        setWorkflowStatus('Failed to start report compilation');
        setTimeout(() => setWorkflowStatus(null), 5000);
      }
    });
  };

  const isClosed = status === 'closed';

  return (
    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-5 rounded-2xl border border-arch-border-subtle bg-arch-surface-secondary/80 backdrop-blur-xl shadow-card">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-arch-text-heading tracking-tight">
            Unified Shift Compilation
          </h1>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
              isClosed
                ? 'bg-arch-surface-inverse text-arch-text-inverse'
                : 'bg-accent-green/10 text-accent-green border border-accent-green/20'
            }`}
          >
            {isClosed ? <Lock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            Shift {status}
          </span>
        </div>
        <p className="text-xs text-arch-text-muted">
          Consolidated operational overview: loads, SMU utilization, downtime, and tire health
          {isClosed && closedAt && (
            <span className="ml-1 text-arch-text-muted/70 font-semibold">
              • Locked on {new Date(closedAt).toLocaleString()}
            </span>
          )}
        </p>
        {workflowStatus && (
          <p className="text-xs font-semibold text-arch-brand-blue pt-1 animate-in fade-in flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {workflowStatus}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
        {/* Date Selector */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-arch-border-subtle bg-arch-surface-base text-xs font-medium text-arch-text-primary shadow-sm hover:border-arch-brand-blue transition-colors focus-within:border-arch-brand-blue focus-within:ring-1 focus-within:ring-arch-brand-blue">
          <Calendar className="h-4 w-4 text-arch-text-muted" />
          <input
            type="date"
            value={shiftDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-transparent border-none outline-hidden text-arch-text-primary font-mono text-xs cursor-pointer focus:ring-0 w-[120px]"
          />
        </div>

        {/* Shift Type Switcher */}
        <div className="flex items-center rounded-lg border border-arch-border-subtle bg-arch-surface-secondary p-0.5 text-xs font-medium shadow-sm">
          <button
            type="button"
            onClick={() => handleShiftChange('day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              shiftType === 'day'
                ? 'bg-arch-surface-base text-arch-text-primary shadow-card font-semibold'
                : 'text-arch-text-muted hover:text-arch-text-secondary'
            }`}
          >
            <Sun className="h-3.5 w-3.5 text-accent-orange" />
            Day
          </button>
          <button
            type="button"
            onClick={() => handleShiftChange('night')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              shiftType === 'night'
                ? 'bg-arch-surface-base text-arch-text-primary shadow-card font-semibold'
                : 'text-arch-text-muted hover:text-arch-text-secondary'
            }`}
          >
            <Moon className="h-3.5 w-3.5 text-arch-brand-blue" />
            Night
          </button>
        </div>

        <div className="h-6 w-px bg-arch-border-subtle hidden sm:block mx-1"></div>

        {/* Print Action */}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-arch-border-subtle hover:bg-arch-surface-tertiary text-arch-text-secondary text-xs font-medium shadow-sm transition-all cursor-pointer no-print min-h-[32px]"
          title="Print Compliance Summary"
        >
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Print</span>
        </button>

        {/* Export PDF Button */}
        <ExportPdfButton
          departmentId={departmentId}
          shiftDate={shiftDate}
          shiftType={shiftType}
          isShiftClosed={isClosed}
          onExport={onExportPdf}
        />

        {!isClosed ? (
          <button
            type="button"
            onClick={onOpenCloseoutModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-arch-surface-inverse hover:bg-arch-surface-inverse/90 text-arch-text-inverse text-xs font-bold shadow-sm transition-all cursor-pointer no-print min-h-[32px]"
          >
            <Lock className="h-3.5 w-3.5" />
            Lock & Sign Shift
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={handleGenerateReport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-arch-brand-blue hover:bg-arch-brand-blue/90 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 no-print min-h-[32px]"
              title="Aggregate End-of-Shift SCADA Telemetry"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Database className="h-3.5 w-3.5" />
              )}
              Sync SCADA
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/10 text-accent-green text-xs font-bold border border-accent-green/20 min-h-[32px]">
              <CheckCircle className="h-3.5 w-3.5" />
              Locked
            </div>
          </>
        )}
      </div>
    </div>
  );
}
