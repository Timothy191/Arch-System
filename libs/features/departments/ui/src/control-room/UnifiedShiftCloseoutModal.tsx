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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-arch-bg-base/40 backdrop-blur-md animate-in fade-in duration-200">
      <GlassCard className="w-full max-w-md overflow-hidden border border-arch-border-subtle shadow-window bg-arch-surface-base/95 backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-arch-border-subtle px-6 py-4 bg-arch-surface-secondary/70">
          <div className="flex items-center gap-2 font-semibold text-arch-text-primary text-sm">
            <Lock className="h-4 w-4 text-arch-text-secondary" />
            <span>Lock & Sign Unified Shift</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading || isPendingWorkflow}
            className="rounded-full p-1 text-arch-text-tertiary hover:text-arch-text-primary hover:bg-arch-surface-tertiary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3.5 rounded-lg bg-arch-surface-secondary border border-arch-border-subtle space-y-1">
            <div className="text-arch-text-secondary font-medium">Shift Scope:</div>
            <div className="font-semibold text-arch-text-primary flex items-center justify-between">
              <span>{shiftDate}</span>
              <span className="uppercase text-[11px] px-2 py-0.5 rounded-full bg-arch-surface-tertiary text-arch-text-primary font-bold">
                {shiftType} Shift
              </span>
            </div>
            <p className="text-[11px] text-arch-text-muted pt-1 leading-relaxed">
              Signing locks this operational period. Loads, SMU hours, breakdowns, and tire records
              will be permanently archived.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-accent-red shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-semibold text-arch-text-primary">
              Supervisor Security PIN <span className="text-accent-red">*</span>
            </label>
            <div className="relative">
              <KeyRound className="h-4 w-4 absolute left-3 top-2.5 text-arch-text-muted" />
              <input
                type="password"
                maxLength={20}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-digit or supervisor PIN"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-arch-border-subtle bg-arch-surface-base text-arch-text-primary font-mono tracking-widest outline-hidden focus:border-arch-brand-blue focus:ring-1 focus:ring-arch-brand-blue transition-colors"
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
              className="w-full p-2.5 rounded-lg border border-arch-border-subtle bg-arch-surface-base text-arch-text-primary outline-hidden focus:border-arch-brand-blue focus:ring-1 focus:ring-arch-brand-blue resize-none transition-colors"
              disabled={loading || isPendingWorkflow}
            />
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="autoCompile"
              checked={autoCompile}
              onChange={(e) => setAutoCompile(e.target.checked)}
              className="rounded border-arch-border-subtle text-arch-brand-blue focus:ring-arch-brand-blue w-4 h-4"
              disabled={loading || isPendingWorkflow}
            />
            <label
              htmlFor="autoCompile"
              className="text-[11px] font-medium text-arch-text-secondary cursor-pointer"
            >
              Auto-compile and distribute background PDF report upon lock
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-arch-border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || isPendingWorkflow}
              className="px-4 py-2 rounded-full border border-arch-border-subtle text-arch-text-secondary hover:bg-arch-surface-secondary font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isPendingWorkflow}
              className="px-5 py-2 rounded-full bg-arch-surface-inverse hover:bg-arch-surface-inverse/90 text-arch-text-inverse font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
