'use client';

import type { LockAndSignShiftInput } from '@repo/contract/types/shift-compilation.types';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Lock, X } from 'lucide-react';
import { useState, useTransition } from 'react';

interface UnifiedShiftCloseoutModalProps {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  departmentSlug: string;
  shiftDate: string;
  shiftType: 'day' | 'night';
  onSignShift: (
    payload: LockAndSignShiftInput & { departmentSlug?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  onSuccess: () => void;
}

export function UnifiedShiftCloseoutModal({
  open,
  onClose,
  departmentId,
  departmentSlug,
  shiftDate,
  shiftType,
  onSignShift,
  onSuccess,
}: UnifiedShiftCloseoutModalProps) {
  const [pin, setPin] = useState('');
  const [notes, setNotes] = useState('');
  const [autoCompile, setAutoCompile] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isPendingWorkflow, startWorkflowTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  const triggerWorkflow = async () => {
    try {
      const shiftId = `shift_${departmentSlug}_${shiftDate}_${shiftType}`;
      await fetch('/api/control-room/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId }),
      });
    } catch (e) {
      console.warn('Failed to auto-trigger workflow:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMessage('Supervisor PIN is required to close out shift.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await onSignShift({
        departmentId,
        shiftDate,
        shiftType,
        pin: pin.trim(),
        notes: notes.trim() || undefined,
        departmentSlug,
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to sign and close shift.');
        setLoading(false);
        return;
      }

      if (autoCompile) {
        startWorkflowTransition(() => {
          triggerWorkflow();
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-arch-bg-base/40 p-4 backdrop-blur-md duration-200">
      <GlassCard className="w-full max-w-md overflow-hidden border border-arch-border-subtle bg-arch-surface-base/95 shadow-window backdrop-blur-2xl">
        <div className="flex items-center justify-between border-arch-border-subtle border-b bg-arch-surface-secondary/70 px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-arch-text-primary text-sm">
            <Lock className="h-4 w-4 text-arch-text-secondary" />
            <span>Lock & Sign Unified Shift</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading || isPendingWorkflow}
            className="rounded-full p-1 text-arch-text-tertiary transition-colors hover:bg-arch-surface-tertiary hover:text-arch-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 text-xs">
          <div className="space-y-1 rounded-lg border border-arch-border-subtle bg-arch-surface-secondary p-3.5">
            <div className="font-medium text-arch-text-secondary">Shift Scope:</div>
            <div className="flex items-center justify-between font-semibold text-arch-text-primary">
              <span>{shiftDate}</span>
              <span className="rounded-full bg-arch-surface-tertiary px-2 py-0.5 font-bold text-[11px] text-arch-text-primary uppercase">
                {shiftType} Shift
              </span>
            </div>
            <p className="pt-1 text-[11px] text-arch-text-muted leading-relaxed">
              Signing locks this operational period. Loads, SMU hours, breakdowns, and tire records
              will be permanently archived.
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-accent-red/20 bg-accent-red/10 p-3 text-accent-red">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-red" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-semibold text-arch-text-primary">
              Supervisor Security PIN <span className="text-accent-red">*</span>
            </label>
            <div className="relative">
              <KeyRound className="absolute top-2.5 left-3 h-4 w-4 text-arch-text-muted" />
              <input
                type="password"
                maxLength={20}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-digit or supervisor PIN"
                className="w-full rounded-lg border border-arch-border-subtle bg-arch-surface-base py-2 pr-3 pl-9 font-mono text-arch-text-primary tracking-widest outline-hidden transition-colors focus:border-arch-brand-blue focus:ring-1 focus:ring-arch-brand-blue"
                disabled={loading || isPendingWorkflow}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-semibold text-arch-text-primary">
              Compilation Sign-off Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational remarks, weather anomalies, or shift turnover notes..."
              className="w-full resize-none rounded-lg border border-arch-border-subtle bg-arch-surface-base p-2.5 text-arch-text-primary outline-hidden transition-colors focus:border-arch-brand-blue focus:ring-1 focus:ring-arch-brand-blue"
              disabled={loading || isPendingWorkflow}
            />
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="autoCompile"
              checked={autoCompile}
              onChange={(e) => setAutoCompile(e.target.checked)}
              className="h-4 w-4 rounded border-arch-border-subtle text-arch-brand-blue focus:ring-arch-brand-blue"
              disabled={loading || isPendingWorkflow}
            />
            <label
              htmlFor="autoCompile"
              className="cursor-pointer font-medium text-[11px] text-arch-text-secondary"
            >
              Auto-compile and distribute background PDF report upon lock
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-arch-border-subtle border-t pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || isPendingWorkflow}
              className="cursor-pointer rounded-full border border-arch-border-subtle px-4 py-2 font-semibold text-arch-text-secondary transition-colors hover:bg-arch-surface-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isPendingWorkflow}
              className="flex cursor-pointer items-center gap-2 rounded-full bg-arch-surface-inverse px-5 py-2 font-bold text-arch-text-inverse transition-all hover:bg-arch-surface-inverse/90 disabled:opacity-50"
            >
              {loading || isPendingWorkflow ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying & Locking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sign & Finalize Shift
                </>
              )}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
