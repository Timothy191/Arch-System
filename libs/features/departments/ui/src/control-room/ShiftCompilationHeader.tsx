'use client';

import { Calendar, CheckCircle, Database, Loader2, Lock, Printer } from 'lucide-react';
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

const HEADER_SHELL_CLASS =
  'gold-steel-border gold-steel-border-slim group relative isolate flex flex-col items-start justify-between gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/85 p-5 shadow-glass-depth backdrop-blur-xl transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-glass-depth-hover focus-within:shadow-glass-depth-hover motion-reduce:transform-none motion-reduce:transition-none xl:flex-row xl:items-center';

const HEADER_TITLE_ROW_CLASS = 'flex items-center gap-2.5';

const HEADER_TITLE_CLASS = 'font-bold text-[var(--text-heading)] text-xl tracking-tight';

const HEADER_SUBTITLE_CLASS = 'text-[var(--text-muted)] text-xs';

const WORKFLOW_STATUS_CLASS =
  'fade-in flex animate-in items-center gap-1.5 pt-1 font-semibold text-[var(--accent-blue)] text-xs';

const HEADER_ACTIONS_CLASS = 'flex w-full flex-wrap items-center gap-3 xl:w-auto';

const DATE_PICKER_CLASS =
  'group/date flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-body)] text-xs shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out focus-within:border-[var(--accent-gold)] focus-within:ring-2 focus-within:ring-[var(--accent-gold)]/40 hover:-translate-y-0.5 hover:border-[var(--accent-gold)]/60 hover:shadow-card-hover motion-reduce:transform-none motion-reduce:transition-none';

const DATE_INPUT_CLASS =
  'w-[120px] cursor-pointer border-none bg-transparent font-mono text-[var(--text-body)] text-xs outline-hidden focus:ring-0';

const HEADER_DIVIDER_CLASS = 'mx-1 hidden h-6 w-px bg-[var(--border-subtle)] sm:block';

const PRINT_BUTTON_CLASS =
  'no-print flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 font-medium text-[var(--text-body)] text-xs shadow-card transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--bg-tertiary)] hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/50 active:translate-y-0 active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none';

const LOCK_SIGN_BUTTON_CLASS =
  'no-print flex min-h-[32px] cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent-charcoal)] px-4 py-2 font-bold text-[var(--bg-primary)] text-xs shadow-card transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--accent-charcoal)]/90 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/50 active:translate-y-0 active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none';

const SYNC_SCADA_BUTTON_CLASS =
  'no-print flex min-h-[32px] cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-bold text-white text-xs shadow-card transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--accent-blue)]/90 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/50 active:translate-y-0 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none';

const LOCKED_PILL_CLASS =
  'flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[var(--accent-green)]/20 bg-[var(--accent-green)]/10 px-3 py-1.5 font-bold text-[var(--accent-green)] text-xs';

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
      } catch {
        setWorkflowStatus('Failed to start report compilation');
        setTimeout(() => setWorkflowStatus(null), 5000);
      }
    });
  };

  const isClosed = status === 'closed';

  return (
    <div className={HEADER_SHELL_CLASS}>
      <div className="space-y-1">
        <div className={HEADER_TITLE_ROW_CLASS}>
          <h1 className={HEADER_TITLE_CLASS}>Unified Shift Compilation</h1>
        </div>
        <p className={HEADER_SUBTITLE_CLASS}>
          Consolidated operational overview: loads, SMU utilization, downtime, and tire health
          {isClosed && closedAt && (
            <span className="ml-1 font-semibold text-[var(--text-muted)]/70">
              • Locked on {new Date(closedAt).toLocaleString('en-ZA')}
            </span>
          )}
        </p>
        {workflowStatus && (
          <p className={WORKFLOW_STATUS_CLASS}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {workflowStatus}
          </p>
        )}
      </div>

      <div className={HEADER_ACTIONS_CLASS}>
        {/* Date Selector */}
        <div className={DATE_PICKER_CLASS}>
          <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="date"
            value={shiftDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </div>

        <div className={HEADER_DIVIDER_CLASS}></div>
        {/* Print Action */}
        <button
          type="button"
          onClick={() => window.print()}
          className={PRINT_BUTTON_CLASS}
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
          <button type="button" onClick={onOpenCloseoutModal} className={LOCK_SIGN_BUTTON_CLASS}>
            <Lock className="h-3.5 w-3.5" />
            Lock &amp; Sign Shift
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={handleGenerateReport}
              className={SYNC_SCADA_BUTTON_CLASS}
              title="Aggregate End-of-Shift SCADA Telemetry"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Database className="h-3.5 w-3.5" />
              )}
              Sync SCADA
            </button>
            <div className={LOCKED_PILL_CLASS}>
              <CheckCircle className="h-3.5 w-3.5" />
              Locked
            </div>
          </>
        )}
      </div>
    </div>
  );
}
