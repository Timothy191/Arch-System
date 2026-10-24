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
    <div className="gold-steel-border gold-steel-border-slim flex flex-col items-start justify-between gap-4 rounded-2xl border border-arch-border-subtle bg-arch-surface-secondary/80 p-5 shadow-card backdrop-blur-xl xl:flex-row xl:items-center">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="font-bold text-arch-text-heading text-xl tracking-tight">
            Unified Shift Compilation
          </h1>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-xs uppercase tracking-wider ${
              isClosed
                ? 'bg-arch-surface-inverse text-arch-text-inverse'
                : 'border border-accent-green/20 bg-accent-green/10 text-accent-green'
            }`}
          >
            {isClosed ? <Lock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            Shift {status}
          </span>
        </div>
        <p className="text-arch-text-muted text-xs">
          Consolidated operational overview: loads, SMU utilization, downtime, and tire health
          {isClosed && closedAt && (
            <span className="ml-1 font-semibold text-arch-text-muted/70">
              • Locked on {new Date(closedAt).toLocaleString()}
            </span>
          )}
        </p>
        {workflowStatus && (
          <p className="fade-in flex animate-in items-center gap-1.5 pt-1 font-semibold text-arch-brand-blue text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {workflowStatus}
          </p>
        )}
      </div>

      <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
        {/* Date Selector */}
        <div className="flex items-center gap-2 rounded-lg border border-arch-border-subtle bg-arch-surface-base px-3 py-1.5 font-medium text-arch-text-primary text-xs shadow-sm transition-colors focus-within:border-arch-brand-blue focus-within:ring-1 focus-within:ring-arch-brand-blue hover:border-arch-brand-blue">
          <Calendar className="h-4 w-4 text-arch-text-muted" />
          <input
            type="date"
            value={shiftDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-[120px] cursor-pointer border-none bg-transparent font-mono text-arch-text-primary text-xs outline-hidden focus:ring-0"
          />
        </div>

        {/* Shift Type Switcher */}
        <div className="flex items-center rounded-lg border border-arch-border-subtle bg-arch-surface-secondary p-0.5 font-medium text-xs shadow-sm">
          <button
            type="button"
            onClick={() => handleShiftChange('day')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
              shiftType === 'day'
                ? 'bg-arch-surface-base font-semibold text-arch-text-primary shadow-card'
                : 'text-arch-text-muted hover:text-arch-text-secondary'
            }`}
          >
            <Sun className="h-3.5 w-3.5 text-accent-orange" />
            Day
          </button>
          <button
            type="button"
            onClick={() => handleShiftChange('night')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
              shiftType === 'night'
                ? 'bg-arch-surface-base font-semibold text-arch-text-primary shadow-card'
                : 'text-arch-text-muted hover:text-arch-text-secondary'
            }`}
          >
            <Moon className="h-3.5 w-3.5 text-arch-brand-blue" />
            Night
          </button>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-arch-border-subtle sm:block"></div>

        {/* Print Action */}
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-lg border border-arch-border-subtle px-3 py-2 font-medium text-arch-text-secondary text-xs shadow-sm transition-all hover:bg-arch-surface-tertiary"
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
            className="no-print flex min-h-[32px] cursor-pointer items-center gap-2 rounded-lg bg-arch-surface-inverse px-4 py-2 font-bold text-arch-text-inverse text-xs shadow-sm transition-all hover:bg-arch-surface-inverse/90"
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
              className="no-print flex min-h-[32px] cursor-pointer items-center gap-2 rounded-lg bg-arch-brand-blue px-4 py-2 font-bold text-white text-xs shadow-sm transition-all hover:bg-arch-brand-blue/90 disabled:opacity-50"
              title="Aggregate End-of-Shift SCADA Telemetry"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Database className="h-3.5 w-3.5" />
              )}
              Sync SCADA
            </button>
            <div className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-accent-green/20 bg-accent-green/10 px-3 py-1.5 font-bold text-accent-green text-xs">
              <CheckCircle className="h-3.5 w-3.5" />
              Locked
            </div>
          </>
        )}
      </div>
    </div>
  );
}
