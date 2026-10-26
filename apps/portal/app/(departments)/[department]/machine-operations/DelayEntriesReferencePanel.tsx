'use client';

import { AlertCircle, CheckCircle, Clock, HelpCircle, Info, Plus, Trash2 } from 'lucide-react';
import {
  calculateDelayDurationHours,
  type DelayCategoryItem,
  type DelayFormEntry,
} from './machine-operations-constants';

interface DelayEntriesHeaderAndGuideProps {
  totalDelayHours: number;
  engineeringDelayHours: number;
  engineeringDelayReasons: string[];
  showHelp: boolean;
  readOnly: boolean;
  onToggleHelp: () => void;
  onAddDelay: () => void;
}

export function DelayEntriesHeaderAndGuide({
  totalDelayHours,
  engineeringDelayHours,
  engineeringDelayReasons,
  showHelp,
  readOnly,
  onToggleHelp,
  onAddDelay,
}: DelayEntriesHeaderAndGuideProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[var(--text-heading)] text-lg">Delay Entries</h3>
          <p className="text-[var(--text-muted)] text-sm">
            Log delays with start/end times for accurate tracking
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[var(--text-muted)] text-xs">Total Delay Hours (12h Shift)</p>
            <p className="font-medium text-2xl text-accent-red">
              {(totalDelayHours + engineeringDelayHours).toFixed(2)}h
              <span className="ml-1 text-[var(--text-muted)] text-xs">/ 12h max</span>
            </p>
            {engineeringDelayHours > 0 && (
              <p className="font-mono text-[11px] text-amber-700">
                Eng: {engineeringDelayHours.toFixed(1)}h + CR: {totalDelayHours.toFixed(1)}h (Max
                CR: {Math.max(0, 12 - engineeringDelayHours).toFixed(1)}h)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleHelp}
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-heading)]"
            title="Show help"
          >
            <HelpCircle size={20} />
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={onAddDelay}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[var(--accent-blue)]/90"
            >
              <Plus size={16} />
              Add Delay
            </button>
          )}
        </div>
      </div>

      {engineeringDelayHours > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-300/70 bg-amber-50/90 p-3 text-amber-900 text-xs">
          <div className="flex items-center justify-between font-semibold">
            <span>
              Engineering Breakdown Delay Synced ({engineeringDelayHours.toFixed(1)}h logged)
            </span>
            <span className="font-mono">
              Remaining Control Room Shift Cap: {Math.max(0, 12 - engineeringDelayHours).toFixed(1)}
              h
            </span>
          </div>
          {engineeringDelayReasons.length > 0 && (
            <p className="text-[11px] text-amber-800">{engineeringDelayReasons.join(' | ')}</p>
          )}
        </div>
      )}

      {showHelp && (
        <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
          <div className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 flex-shrink-0 text-[var(--accent-blue)]" />
            <div className="text-[var(--text-secondary)] text-sm">
              <p className="mb-1 font-medium text-[var(--text-heading)]">Delay Entry Guide</p>
              <ul className="list-inside list-disc space-y-1.5">
                <li>
                  <strong>Category:</strong> Select the type of delay (External, Production,
                  Engineering)
                </li>
                <li>
                  <strong>Start/End Time:</strong> Auto-calculates duration. Times are stored in UTC
                  and displayed in your local timezone.
                </li>
                <li>
                  <strong>Manual Override:</strong> Enable to manually specify duration when exact
                  times aren't available. This is flagged for audit trail.
                </li>
                <li>
                  <strong>12-Hour Limit:</strong> Total delay hours per operation cannot exceed 12
                  hours per shift.
                </li>
                <li>
                  <strong>Draft vs. Committed:</strong> Draft entries can be edited. Only
                  supervisors can commit entries, which locks them for editing.
                </li>
                <li>
                  <strong>Description:</strong> Optional context about the delay cause and impact.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface DelayEntryRowCardProps {
  entry: DelayFormEntry;
  index: number;
  categories: DelayCategoryItem[];
  readOnly: boolean;
  error?: string;
  onUpdateField: <K extends keyof DelayFormEntry>(
    index: number,
    field: K,
    value: DelayFormEntry[K]
  ) => void;
  onRemoveClick: (index: number) => void;
}

export function DelayEntryRowCard({
  entry,
  index,
  categories,
  readOnly,
  error,
  onUpdateField,
  onRemoveClick,
}: DelayEntryRowCardProps) {
  const duration = entry.is_manual_override
    ? entry.manual_duration_hours || 0
    : calculateDelayDurationHours(entry.delay_start_time, entry.delay_end_time);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* Category */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[var(--text-secondary)] text-xs">
              Category <span className="text-accent-red">*</span>
              <span title="Select the type of delay: External, Production, or Engineering">
                <HelpCircle size={12} className="text-[var(--text-muted)]" />
              </span>
            </label>
            <select
              id={`delay-category-${index}`}
              title="Category"
              value={entry.delay_category_id}
              onChange={(e) => onUpdateField(index, 'delay_category_id', e.target.value)}
              disabled={readOnly || entry.status === 'committed'}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[var(--text-secondary)] text-xs">
              Start Time <span className="text-accent-red">*</span>
              <span title="When the delay began. Displayed in local time, stored in UTC.">
                <HelpCircle size={12} className="text-[var(--text-muted)]" />
              </span>
            </label>
            <input
              id={`delay-start-time-${index}`}
              title="Start Time"
              type="datetime-local"
              value={entry.delay_start_time.slice(0, 16)}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const d = new Date(val);
                if (!Number.isNaN(d.getTime())) {
                  onUpdateField(index, 'delay_start_time', d.toISOString());
                }
              }}
              disabled={readOnly || entry.status === 'committed' || entry.is_manual_override}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* End Time */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[var(--text-secondary)] text-xs">
              End Time <span className="text-accent-red">*</span>
              <span title="When the delay ended. Duration is auto-calculated from start time.">
                <HelpCircle size={12} className="text-[var(--text-muted)]" />
              </span>
            </label>
            <input
              id={`delay-end-time-${index}`}
              title="End Time"
              type="datetime-local"
              value={entry.delay_end_time.slice(0, 16)}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const d = new Date(val);
                if (!Number.isNaN(d.getTime())) {
                  onUpdateField(index, 'delay_end_time', d.toISOString());
                }
              }}
              disabled={readOnly || entry.status === 'committed' || entry.is_manual_override}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Duration Display */}
          <div className="space-y-1">
            <label className="block text-[var(--text-secondary)] text-xs">Duration</label>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-heading)] text-lg">
                {duration.toFixed(2)}h
              </span>
              {!readOnly && entry.status === 'draft' && (
                <label
                  className="flex cursor-pointer items-center gap-1"
                  title="Enable to manually specify duration when exact times aren't available"
                >
                  <input
                    type="checkbox"
                    checked={entry.is_manual_override}
                    onChange={(e) => onUpdateField(index, 'is_manual_override', e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-default)]"
                  />
                  <span className="flex items-center gap-1 text-[var(--text-muted)] text-xs">
                    Override
                    <HelpCircle size={10} className="text-[var(--text-muted)]" />
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Remove Button */}
        {!readOnly && entry.status === 'draft' && (
          <button
            type="button"
            onClick={() => onRemoveClick(index)}
            className="text-[var(--text-muted)] transition-colors hover:text-accent-red"
            title="Remove delay entry"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Manual Override Duration */}
      {entry.is_manual_override && !readOnly && entry.status === 'draft' && (
        <div className="space-y-1">
          <label className="block text-[var(--text-secondary)] text-xs">
            Manual Duration (hours) <span className="text-accent-red">*</span>
          </label>
          <input
            id={`delay-manual-duration-${index}`}
            title="Manual Duration"
            type="number"
            step="0.01"
            min="0"
            max="12"
            value={entry.manual_duration_hours || ''}
            onChange={(e) =>
              onUpdateField(index, 'manual_duration_hours', parseFloat(e.target.value) || null)
            }
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none md:w-48"
          />
          <p className="text-[var(--text-muted)] text-xs">Manual entry flagged for audit trail</p>
        </div>
      )}

      {/* Description */}
      <div className="space-y-1">
        <label className="block text-[var(--text-secondary)] text-xs">Description (optional)</label>
        <textarea
          value={entry.description || ''}
          onChange={(e) => onUpdateField(index, 'description', e.target.value)}
          disabled={readOnly || entry.status === 'committed'}
          rows={2}
          className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Describe the delay cause and impact..."
        />
      </div>

      {/* Status Badge */}
      {entry.status === 'committed' && (
        <div className="flex items-center gap-2 text-[var(--accent-green)] text-xs">
          <Clock size={14} />
          Committed - locked for editing
        </div>
      )}

      {/* Validation Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50/80 px-3 py-2 text-accent-red text-xs">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}

interface DelayEntriesConfirmModalProps {
  confirmAction: 'commit' | 'remove' | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DelayEntriesConfirmModal({
  confirmAction,
  onCancel,
  onConfirm,
}: DelayEntriesConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 shadow-window">
        <div className="mb-4 flex items-start gap-3">
          {confirmAction === 'commit' ? (
            <CheckCircle className="text-[var(--accent-green)]" size={24} />
          ) : (
            <Trash2 className="text-accent-red" size={24} />
          )}
          <div>
            <h3 className="font-medium text-[var(--text-heading)] text-lg">
              {confirmAction === 'commit' ? 'Commit Delay Entries' : 'Remove Delay Entry'}
            </h3>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              {confirmAction === 'commit'
                ? 'This will transition all draft delay entries to committed status. Committed entries cannot be edited. Are you sure?'
                : 'This will remove the delay entry. This action cannot be undone. Are you sure?'}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-[var(--bg-secondary)] px-4 py-2 font-medium text-[var(--text-heading)] transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              confirmAction === 'commit'
                ? 'bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green)]/90'
                : 'bg-accent-red text-white hover:bg-red-600'
            }`}
          >
            {confirmAction === 'commit' ? 'Confirm Commit' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
