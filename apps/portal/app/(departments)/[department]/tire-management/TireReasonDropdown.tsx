'use client';

/* cspell:ignore Tyre */

import { cn } from '@repo/ui/lib/utils';
import { TIRE_ACTIVITY_REASON_PRESETS } from './tire-constants';

export interface TireReasonDropdownProps {
  readonly value: string;
  readonly onChange: (reason: string) => void;
  readonly className?: string;
}

const CUSTOM_REASON_SENTINEL = '__custom__';

export function TireReasonDropdown({ value, onChange, className }: TireReasonDropdownProps) {
  const isCustomSelected =
    value === CUSTOM_REASON_SENTINEL ||
    !TIRE_ACTIVITY_REASON_PRESETS.some((preset) => preset === value);

  const selectValue = isCustomSelected ? CUSTOM_REASON_SENTINEL : value;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (next === CUSTOM_REASON_SENTINEL) {
      const customReason = window.prompt('Enter a custom reason (min 3 characters):');
      if (customReason && customReason.trim().length >= 3) {
        onChange(customReason.trim());
      }
      return;
    }
    onChange(next);
  };

  const options = TIRE_ACTIVITY_REASON_PRESETS.map((preset) => (
    <option key={preset} value={preset}>
      {preset}
    </option>
  ));

  return (
    <div
      className={cn(
        'gold-steel-border gold-steel-border-slim rounded-lg border border-[var(--border-default)] bg-white p-2',
        className
      )}
    >
      <select
        id="tire-reason-select"
        aria-label="Tire activity reason"
        value={selectValue}
        onChange={handleChange}
        className="gold-steel-border gold-steel-border-slim block w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 font-medium text-[var(--text-heading)] text-sm focus:border-[var(--accent-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/50"
        required
      >
        <option value="">Select reason...</option>
        {options}
        <option value={CUSTOM_REASON_SENTINEL}>+ Add custom reason...</option>
      </select>

      {isCustomSelected && value && value !== CUSTOM_REASON_SENTINEL && (
        <span className="mt-1.5 block text-[11px] text-[var(--text-muted)]">
          Custom reason: {value}
        </span>
      )}
    </div>
  );
}
