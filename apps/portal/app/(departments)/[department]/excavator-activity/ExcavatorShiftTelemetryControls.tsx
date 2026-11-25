'use client';

import { CheckCircle2, Clock, MessageSquare, Save, UserCheck } from 'lucide-react';
import { START_SMR_SOURCE_LABELS, type StartSmrSource } from './excavator-shift-helpers';

export interface ExcavatorOperatorOption {
  readonly id: string;
  readonly full_name: string;
  readonly employee_code: string;
}

export interface ExcavatorShiftTelemetryDraft {
  readonly startSmrInput: string;
  readonly stopSmrInput: string;
  readonly startSmrSource: StartSmrSource;
  readonly operatorId: string;
  readonly comment: string;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly lastSavedAt?: string | null;
}

interface ExcavatorShiftTelemetryControlsProps {
  readonly excavatorName: string;
  readonly operators: readonly ExcavatorOperatorOption[];
  readonly draft: ExcavatorShiftTelemetryDraft;
  readonly onUpdateDraft: (
    patch: Partial<
      Pick<
        ExcavatorShiftTelemetryDraft,
        'startSmrInput' | 'stopSmrInput' | 'operatorId' | 'comment'
      >
    >
  ) => void;
  readonly onSave: () => void;
}

const SECTION_BOX_CLASS =
  'space-y-2.5 rounded-xl border border-accent-gold/35 bg-[var(--bg-secondary)]/55 p-3';
const FIELD_INPUT_CLASS =
  'w-full rounded-lg border border-accent-gold/45 bg-white px-2.5 py-1.5 font-medium text-[var(--text-heading)] text-xs focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold/40';
const FIELD_LABEL_CLASS =
  'flex items-center gap-1 font-medium text-[11px] text-[var(--text-muted)]';

function computeShiftHoursSummary(
  startSmrInput: string,
  stopSmrInput: string
): {
  readonly isValid: boolean;
  readonly hoursLabel: string | null;
  readonly error: string | null;
} {
  if (!startSmrInput.trim() || !stopSmrInput.trim()) {
    return { isValid: true, hoursLabel: null, error: null };
  }
  const startVal = Number(startSmrInput);
  const stopVal = Number(stopSmrInput);
  if (!Number.isFinite(startVal) || !Number.isFinite(stopVal) || startVal < 0 || stopVal < 0) {
    return { isValid: false, hoursLabel: null, error: 'Enter valid non-negative SMR values.' };
  }
  if (stopVal < startVal) {
    return { isValid: false, hoursLabel: null, error: 'Stop SMR cannot be lower than Start SMR.' };
  }
  return {
    isValid: true,
    hoursLabel: `${(stopVal - startVal).toFixed(1)} hrs`,
    error: null,
  };
}

export function ExcavatorShiftTelemetryControls({
  excavatorName,
  operators,
  draft,
  onUpdateDraft,
  onSave,
}: ExcavatorShiftTelemetryControlsProps) {
  const smrStatus = computeShiftHoursSummary(draft.startSmrInput, draft.stopSmrInput);
  const sourceLabel = START_SMR_SOURCE_LABELS[draft.startSmrSource];

  return (
    <div className="space-y-2.5">
      {/* Step 2: Operator & Shift SMR Readings */}
      <div className={SECTION_BOX_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-[11px] text-[var(--text-heading)] uppercase tracking-wide">
            2. Operator &amp; Shift SMR
          </span>
          {smrStatus.hoursLabel ? (
            <span
              data-testid={`shift-hours-badge-${excavatorName}`}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono font-semibold text-[10px] text-emerald-700"
            >
              <Clock className="h-3 w-3" aria-hidden="true" />
              {smrStatus.hoursLabel}
            </span>
          ) : (
            <span className="rounded-full border border-accent-gold/40 bg-white px-2 py-0.5 font-medium text-[10px] text-amber-800">
              Start: {sourceLabel}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className={FIELD_LABEL_CLASS} htmlFor={`operator-${excavatorName}`}>
            <UserCheck className="h-3 w-3 text-[var(--accent-blue)]" aria-hidden="true" />
            Operator
          </label>
          <select
            id={`operator-${excavatorName}`}
            aria-label={`Select Operator for ${excavatorName}`}
            value={draft.operatorId}
            onChange={(e) => onUpdateDraft({ operatorId: e.target.value })}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">Select operator...</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.full_name} ({op.employee_code})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className={FIELD_LABEL_CLASS} htmlFor={`start-smr-${excavatorName}`}>
              Start SMR
            </label>
            <input
              id={`start-smr-${excavatorName}`}
              type="number"
              step="0.1"
              min="0"
              value={draft.startSmrInput}
              onChange={(e) => onUpdateDraft({ startSmrInput: e.target.value })}
              placeholder="e.g. 14500.0"
              aria-label={`Start SMR for ${excavatorName}`}
              className={`${FIELD_INPUT_CLASS} font-mono`}
            />
          </div>

          <div className="space-y-1">
            <label className={FIELD_LABEL_CLASS} htmlFor={`stop-smr-${excavatorName}`}>
              Stop SMR
            </label>
            <input
              id={`stop-smr-${excavatorName}`}
              type="number"
              step="0.1"
              min="0"
              value={draft.stopSmrInput}
              onChange={(e) => onUpdateDraft({ stopSmrInput: e.target.value })}
              placeholder="Enter Stop SMR"
              aria-label={`Stop SMR for ${excavatorName}`}
              className={`${FIELD_INPUT_CLASS} font-mono`}
            />
          </div>
        </div>

        {smrStatus.error && (
          <p role="alert" className="font-medium text-[11px] text-red-600">
            {smrStatus.error}
          </p>
        )}
      </div>

      {/* Step 3: Shift Comment & Save Action */}
      <div className={SECTION_BOX_CLASS}>
        <div className="flex items-center justify-between gap-2">
          <label className={FIELD_LABEL_CLASS} htmlFor={`comment-${excavatorName}`}>
            <MessageSquare className="h-3 w-3 text-accent-amber" aria-hidden="true" />
            <span className="font-semibold text-[var(--text-heading)] uppercase tracking-wide">
              3. Shift Comment
            </span>
          </label>
          {draft.lastSavedAt && !draft.isDirty && (
            <span className="inline-flex items-center gap-1 font-medium text-[10px] text-emerald-700">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Saved
            </span>
          )}
        </div>

        <textarea
          id={`comment-${excavatorName}`}
          rows={2}
          maxLength={500}
          value={draft.comment}
          onChange={(e) => onUpdateDraft({ comment: e.target.value })}
          placeholder="Bench notes, floor condition, or handover comment..."
          aria-label={`Shift comment for ${excavatorName}`}
          className={`${FIELD_INPUT_CLASS} resize-none`}
        />

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[11px] text-[var(--text-muted)]">
            {draft.isDirty ? 'Unsaved SMR / operator edits' : 'Shift telemetry ready'}
          </span>
          <button
            type="button"
            disabled={draft.isSaving || !smrStatus.isValid}
            onClick={onSave}
            aria-label={`Save shift telemetry for ${excavatorName}`}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs shadow-2xs transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {draft.isSaving ? 'Saving...' : 'Save Shift Log'}
          </button>
        </div>
      </div>
    </div>
  );
}
