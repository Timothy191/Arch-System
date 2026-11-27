'use client';

import { m } from 'framer-motion';
import { CheckCircle2, Clock, MessageSquare, Save, Timer, UserCheck } from 'lucide-react';
import { useMemo } from 'react';
import {
  FIELD_LABEL_CLASS,
  GOLD_FIELD_CLASS,
  SECTION_BOX_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_STAGGER_VARIANTS,
} from './excavator-activity-styles';
import {
  computeMaxStopSmr,
  filterExcavatorOperators,
  normalizeDelayHours,
  START_SMR_SOURCE_LABELS,
  type StartSmrSource,
  validateStopSmrCap,
} from './excavator-shift-helpers';

export interface ExcavatorOperatorOption {
  readonly id: string;
  readonly full_name: string;
  readonly employee_code: string;
  readonly role?: string | null;
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
  /** Delay hours logged against this excavator's shift (machine_operations_with_delays). */
  readonly delayHours?: number;
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

const SAVE_BUTTON_CLASS =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs shadow-2xs transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45';
const HOURS_BADGE_CLASS =
  'inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono font-semibold text-[10px] text-emerald-700';
const SOURCE_BADGE_CLASS =
  'rounded-full border border-accent-gold/50 bg-white px-2 py-0.5 font-semibold text-[10px] text-amber-800';
const CAP_HINT_CLASS =
  'flex items-center gap-1 font-medium text-[10px] text-[var(--text-secondary)]';

function parseSmrInput(value: string): number | null {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

export function computeShiftHoursSummary(
  startSmrInput: string,
  stopSmrInput: string,
  delayHours = 0
): {
  readonly isValid: boolean;
  readonly hoursLabel: string | null;
  readonly error: string | null;
} {
  const startVal = parseSmrInput(startSmrInput);
  const stopVal = parseSmrInput(stopSmrInput);
  if (startVal === null || stopVal === null) {
    return { isValid: true, hoursLabel: null, error: null };
  }
  if (Number.isNaN(startVal) || Number.isNaN(stopVal) || startVal < 0 || stopVal < 0) {
    return { isValid: false, hoursLabel: null, error: 'Enter valid non-negative SMR values.' };
  }
  if (stopVal < startVal) {
    return { isValid: false, hoursLabel: null, error: 'Stop SMR cannot be lower than Start SMR.' };
  }
  const capError = validateStopSmrCap({ startSmr: startVal, stopSmr: stopVal, delayHours });
  if (capError) {
    return { isValid: false, hoursLabel: null, error: capError };
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
  delayHours = 0,
  onUpdateDraft,
  onSave,
}: ExcavatorShiftTelemetryControlsProps) {
  const smrStatus = computeShiftHoursSummary(draft.startSmrInput, draft.stopSmrInput, delayHours);
  const sourceLabel = START_SMR_SOURCE_LABELS[draft.startSmrSource];
  const parsedStart = parseSmrInput(draft.startSmrInput);
  const maxStopSmr =
    parsedStart !== null && !Number.isNaN(parsedStart)
      ? computeMaxStopSmr(parsedStart, delayHours)
      : null;
  const normalizedDelay = normalizeDelayHours(delayHours);
  const excavatorOperators = useMemo(
    () => filterExcavatorOperators(operators, draft.operatorId),
    [operators, draft.operatorId]
  );
  const errorId = `smr-error-${excavatorName}`;

  return (
    <div className="space-y-2.5">
      {/* Step 2: Operator & Shift SMR Readings */}
      <m.div
        className={SECTION_BOX_CLASS}
        variants={SECTION_STAGGER_VARIANTS}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={SECTION_HEADER_CLASS}>2. Operator &amp; Shift SMR</span>
          {smrStatus.hoursLabel ? (
            <span data-testid={`shift-hours-badge-${excavatorName}`} className={HOURS_BADGE_CLASS}>
              <Clock className="h-3 w-3" aria-hidden="true" />
              {smrStatus.hoursLabel}
            </span>
          ) : (
            <span className={SOURCE_BADGE_CLASS}>Start: {sourceLabel}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className={FIELD_LABEL_CLASS} htmlFor={`operator-${excavatorName}`}>
            <UserCheck className="h-3 w-3 text-accent-gold" aria-hidden="true" />
            Operator
          </label>
          <select
            id={`operator-${excavatorName}`}
            aria-label={`Select Operator for ${excavatorName}`}
            value={draft.operatorId}
            onChange={(e) => onUpdateDraft({ operatorId: e.target.value })}
            className={GOLD_FIELD_CLASS}
          >
            <option value="">Select excavator operator...</option>
            {excavatorOperators.map((op) => (
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
              className={`${GOLD_FIELD_CLASS} font-mono`}
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
              min={parsedStart !== null && !Number.isNaN(parsedStart) ? parsedStart : 0}
              max={maxStopSmr ?? undefined}
              value={draft.stopSmrInput}
              onChange={(e) => onUpdateDraft({ stopSmrInput: e.target.value })}
              placeholder="Enter Stop SMR"
              aria-label={`Stop SMR for ${excavatorName}`}
              aria-invalid={smrStatus.error ? true : undefined}
              aria-describedby={smrStatus.error ? errorId : undefined}
              className={`${GOLD_FIELD_CLASS} font-mono`}
            />
          </div>
        </div>

        <p data-testid={`smr-cap-hint-${excavatorName}`} className={CAP_HINT_CLASS}>
          <Timer className="h-3 w-3 text-accent-gold" aria-hidden="true" />
          {maxStopSmr !== null
            ? `Max Stop SMR ${maxStopSmr} (12 h − ${normalizedDelay} h delay)`
            : `Shift cap: 12 h − ${normalizedDelay} h delay`}
        </p>

        {smrStatus.error && (
          <p id={errorId} role="alert" className="font-semibold text-[11px] text-red-700">
            {smrStatus.error}
          </p>
        )}
      </m.div>

      {/* Step 3: Shift Comment & Save Action */}
      <m.div
        className={SECTION_BOX_CLASS}
        variants={SECTION_STAGGER_VARIANTS}
        initial="hidden"
        animate="visible"
        custom={2}
      >
        <div className="flex items-center justify-between gap-2">
          <label className={FIELD_LABEL_CLASS} htmlFor={`comment-${excavatorName}`}>
            <MessageSquare className="h-3 w-3 text-accent-gold" aria-hidden="true" />
            <span className={SECTION_HEADER_CLASS}>3. Shift Comment</span>
          </label>
          {draft.lastSavedAt && !draft.isDirty && (
            <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-emerald-700">
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
          className={`${GOLD_FIELD_CLASS} resize-none`}
        />

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="font-medium text-[11px] text-[var(--text-secondary)]">
            {draft.isDirty ? 'Unsaved SMR / operator edits' : 'Shift telemetry ready'}
          </span>
          <button
            type="button"
            disabled={draft.isSaving || !smrStatus.isValid}
            onClick={onSave}
            aria-label={`Save shift telemetry for ${excavatorName}`}
            className={SAVE_BUTTON_CLASS}
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {draft.isSaving ? 'Saving...' : 'Save Shift Log'}
          </button>
        </div>
      </m.div>
    </div>
  );
}
