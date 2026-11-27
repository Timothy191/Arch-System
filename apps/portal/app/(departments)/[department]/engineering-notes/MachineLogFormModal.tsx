'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Clock, Lock, Save, ShieldAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  computeMachineOverviewMetrics,
  MAX_SHIFT_HOURS,
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayHours,
  type OverviewDelayKey,
  reconcileOverviewShiftHoursOnDelayChange,
  validateOverviewRowDelaysAndComment,
  validateSmrOdometerEntry,
} from '@/lib/shift-sheet-buckets';

export interface MachineLogFormOperatorOption {
  id: string;
  fullName: string;
  employeeCode: string;
}

export interface MachineLogFormRowData {
  machineId: string;
  machineName: string;
  machineType: string;
  serialNumber: string | null;
  startSmr: number;
  stopSmr: number;
  previousClosingSmr: number;
  operatorId: string | null;
  operatorName: string | null;
  delays: OverviewDelayHours;
  comment: string;
  endsOnBreakdown: boolean;
  saved: boolean;
}

export interface MachineLogFormSavePayload {
  machineId: string;
  operatorId: string | null;
  stopSmr: number;
  delays: OverviewDelayHours;
  comment: string;
  endsOnBreakdown: boolean;
}

interface MachineLogFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: MachineLogFormRowData;
  operators: readonly MachineLogFormOperatorOption[];
  onSave: (payload: MachineLogFormSavePayload) => Promise<void>;
  isSaving?: boolean;
}

const MODAL_BACKDROP_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs';
const MODAL_CONTENT_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white/95 p-6 shadow-2xl';
const INPUT_CONTROL_BASE =
  'w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 font-medium text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]';
const INPUT_READONLY_BASE =
  'w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100/90 px-3 py-2 font-mono text-slate-700 text-xs';
const BTN_PRIMARY =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent-blue)] px-4 py-2.5 font-semibold text-white text-xs transition-opacity hover:opacity-90 disabled:opacity-50';
const BTN_SECONDARY =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 py-2.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]';

export function MachineLogFormModal({
  isOpen,
  onClose,
  row,
  operators,
  onSave,
  isSaving = false,
}: MachineLogFormModalProps) {
  const [operatorId, setOperatorId] = useState<string>(row.operatorId ?? '');
  const [stopSmr, setStopSmr] = useState<number>(row.stopSmr);
  const [delays, setDelays] = useState<OverviewDelayHours>({ ...row.delays });
  const [comment, setComment] = useState<string>(row.comment);
  const [endsOnBreakdown, setEndsOnBreakdown] = useState<boolean>(row.endsOnBreakdown);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync state whenever active row changes
  useEffect(() => {
    setOperatorId(row.operatorId ?? '');
    setStopSmr(row.stopSmr);
    setDelays({ ...row.delays });
    setComment(row.comment);
    setEndsOnBreakdown(row.endsOnBreakdown);
    setLocalError(null);
  }, [row]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const metrics = useMemo(
    () => computeMachineOverviewMetrics(row.startSmr, stopSmr, delays, MAX_SHIFT_HOURS),
    [row.startSmr, stopSmr, delays]
  );

  if (!isOpen) return null;

  const handleStopSmrChange = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    const val = Number.isNaN(parsed) ? row.startSmr : Math.max(row.startSmr, parsed);
    setStopSmr(val);
    setLocalError(null);
  };

  const handleDelayChange = (key: OverviewDelayKey, rawValue: string) => {
    // Lunches are locked at 0.5h
    if (key === 'lunches') return;

    const parsed = Number.parseFloat(rawValue);
    const val = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    const reconciled = reconcileOverviewShiftHoursOnDelayChange({
      startSmr: row.startSmr,
      stopSmr,
      delays,
      changedKey: key,
      nextDelayValue: key === 'safetyTalks' ? Math.max(0.5, val) : val,
      maxShiftHours: MAX_SHIFT_HOURS,
    });
    setDelays(reconciled.delays);
    if (key === 'breakdown' && reconciled.delays.breakdown > 0) {
      setEndsOnBreakdown(true);
    }
    setLocalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const smrCheck = validateSmrOdometerEntry({
      startSmr: row.startSmr,
      stopSmr,
      minAllowedStartSmr: row.previousClosingSmr,
      maxAllowedShiftHours: MAX_SHIFT_HOURS,
    });
    if (!smrCheck.valid) {
      setLocalError(smrCheck.error);
      return;
    }

    const commentCheck = validateOverviewRowDelaysAndComment(delays, comment);
    if (!commentCheck.valid) {
      setLocalError(commentCheck.error);
      return;
    }

    setLocalError(null);
    await onSave({
      machineId: row.machineId,
      operatorId: operatorId || null,
      stopSmr,
      delays,
      comment: comment.trim(),
      endsOnBreakdown,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="machine-log-form-title"
      className={MODAL_BACKDROP_CLASS}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <GlassCard className={MODAL_CONTENT_CLASS}>
        {/* Header */}
        <div className="flex items-start justify-between border-black/[0.08] border-b pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="machine-log-form-title"
                className="font-bold text-[var(--text-heading)] text-base"
              >
                Log Form: {row.machineName}
              </h2>
              <span className="rounded-full bg-[var(--accent-blue)]/10 px-2 py-0.5 font-mono font-semibold text-[10px] text-[var(--accent-blue)]">
                {row.machineType}
              </span>
              {row.saved && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-[10px] text-emerald-700">
                  Previously Saved
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
              Complete machine shift SMR hours, assigned operator, and shift delay entries.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="cursor-pointer rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-heading)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Section 1: Operator & SMR Details */}
          <div className="space-y-3 rounded-xl border border-black/[0.06] bg-[var(--bg-secondary)]/50 p-3.5">
            <h3 className="font-bold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
              1. Operator &amp; Shift SMR Hours
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Operator */}
              <div>
                <label className="mb-1 block font-semibold text-[11px] text-[var(--text-secondary)]">
                  Operator
                </label>
                <select
                  aria-label="Modal Operator"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className={INPUT_CONTROL_BASE}
                >
                  <option value="">Select operator...</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.fullName} ({op.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Start SMR (Immutable) */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="flex items-center gap-1 font-semibold text-[11px] text-[var(--text-secondary)]">
                    <Lock className="h-3 w-3 text-slate-500" />
                    Start SMR (Immutable)
                  </label>
                  <span className="font-mono text-[10px] text-slate-500">Locked</span>
                </div>
                <input
                  type="number"
                  readOnly
                  aria-readonly="true"
                  aria-label="Modal Start SMR"
                  value={row.startSmr}
                  className={INPUT_READONLY_BASE}
                />
              </div>

              {/* Stop SMR (Editable) */}
              <div>
                <label className="mb-1 block font-semibold text-[11px] text-[var(--text-secondary)]">
                  Stop SMR (Editable)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={row.startSmr}
                  max={Number((row.startSmr + MAX_SHIFT_HOURS).toFixed(2))}
                  aria-label="Modal Stop SMR"
                  value={stopSmr}
                  onChange={(e) => handleStopSmrChange(e.target.value)}
                  className={`${INPUT_CONTROL_BASE} font-mono`}
                />
              </div>
            </div>

            {/* Computed Total Worked Duration */}
            <div className="flex items-center justify-between rounded-lg border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 px-3 py-2 font-mono text-xs">
              <span className="flex items-center gap-1.5 font-bold text-[var(--accent-blue)]">
                <Clock className="h-4 w-4" />
                Computed Total Worked Duration:
              </span>
              <span className="font-bold text-[var(--accent-blue)] text-sm">
                {metrics.totalSmrWorked.toFixed(1)}h
              </span>
            </div>
          </div>

          {/* Section 2: Delay Inputs */}
          <div className="space-y-3 rounded-xl border border-black/[0.06] bg-[var(--bg-secondary)]/50 p-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
                2. Shift Delays (Total Logged: {metrics.totalDelayHours.toFixed(1)}h)
              </h3>
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                Max Delays Allowed: {metrics.maxDelaysAllowedHours.toFixed(1)}h
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {OVERVIEW_DELAY_COLUMNS.map((col) => {
                const val = delays[col.key] ?? 0;
                const isLockedLunch = col.key === 'lunches';
                const isSafetyTalks = col.key === 'safetyTalks';

                return (
                  <div key={col.key} className="space-y-1">
                    <label className="block truncate font-semibold text-[10px] text-[var(--text-secondary)]">
                      {col.label}
                      {isLockedLunch && ' (Locked)'}
                      {isSafetyTalks && ' (Min 0.5h)'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={isSafetyTalks ? 0.5 : 0}
                      readOnly={isLockedLunch}
                      aria-readonly={isLockedLunch ? 'true' : 'false'}
                      aria-label={`Modal ${col.label}`}
                      value={val}
                      onChange={(e) => handleDelayChange(col.key, e.target.value)}
                      className={
                        isLockedLunch
                          ? `${INPUT_READONLY_BASE} py-1 text-center`
                          : `${INPUT_CONTROL_BASE} py-1 text-center font-mono`
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Comment & Breakdown Toggle */}
          <div className="space-y-2">
            <label className="block font-semibold text-[11px] text-[var(--text-secondary)]">
              Comment (Required when any delay is recorded)
            </label>
            <input
              type="text"
              aria-label="Modal Comment"
              placeholder="Enter explanation for shift delays or operational notes..."
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setLocalError(null);
              }}
              className={INPUT_CONTROL_BASE}
            />

            <label className="inline-flex cursor-pointer items-center gap-2 pt-1 text-[var(--text-heading)] text-xs">
              <input
                type="checkbox"
                checked={endsOnBreakdown}
                onChange={(e) => setEndsOnBreakdown(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-default)]"
              />
              <span className="flex items-center gap-1 font-medium">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                Ends shift on breakdown (Carry Over into next shift)
              </span>
            </label>
          </div>

          {/* Error Banner */}
          {localError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 font-semibold text-red-700 text-xs">
              {localError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-black/[0.08] border-t pt-3.5">
            <button
              type="button"
              data-testid="log-form-cancel-btn"
              onClick={onClose}
              className={BTN_SECONDARY}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="log-form-save-btn"
              disabled={isSaving}
              className={BTN_PRIMARY}
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving Shift Log...' : 'Save Shift Log'}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
