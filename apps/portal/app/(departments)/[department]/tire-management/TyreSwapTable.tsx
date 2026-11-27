'use client';

/* cspell:ignore Tyre */

import { cn } from '@repo/ui/lib/utils';
import { TyreArtwork } from './TyreArtwork';
import { TIRE_MAKES } from './tire-constants';

export interface TyreSwapFieldValues {
  serial: string;
  size: string;
  make: string;
  tra: string;
  treadDepth: string;
  remainInSite: boolean;
  scrap: boolean;
  repair: boolean;
  isNew: boolean;
  repaired: boolean;
}

export interface TyreSwapTableProps {
  readonly off: TyreSwapFieldValues;
  readonly on: TyreSwapFieldValues;
  readonly showOff: boolean;
  readonly showOn: boolean;
  readonly offLocked?: boolean;
  readonly onChange: (
    side: 'off' | 'on',
    field: keyof TyreSwapFieldValues,
    value: string | boolean
  ) => void;
}

const FIELD_INPUT_CLASS =
  'w-full rounded-md border border-[var(--border-default)] bg-white px-2 py-1.5 text-xs text-[var(--text-heading)] focus:border-[var(--accent-gold)] focus:outline-none disabled:bg-[var(--bg-secondary)] disabled:text-[var(--text-muted)] read-only:bg-[var(--bg-secondary)] read-only:text-[var(--text-secondary)]';
const ROW_LABEL_CLASS =
  'border-[var(--border-default)] border-b px-3 py-2 font-medium text-[var(--text-secondary)] text-xs';
const CELL_CLASS = 'border-[var(--border-default)] border-b px-3 py-2 align-top';
const GROUP_HEADER_CLASS = 'border-[var(--border-default)] border-b px-3 py-3 text-left align-top';

const FIELD_ROWS = [
  { key: 'serial', label: 'Serial Number', placeholder: 'TIRE-2026-041' },
  { key: 'size', label: 'Size', placeholder: '59/80R63' },
  { key: 'make', label: 'Make', placeholder: 'Select make...' },
  { key: 'tra', label: 'TRA', placeholder: '8' },
  { key: 'treadDepth', label: 'Tread Depth', placeholder: '42' },
] as const;

const CHECKBOX_ROWS = [
  { key: 'remainInSite', label: 'Remain in Site', side: 'off' },
  { key: 'scrap', label: 'Scrap', side: 'off' },
  { key: 'repair', label: 'Repair', side: 'off' },
  { key: 'isNew', label: 'New', side: 'on' },
  { key: 'repaired', label: 'Repaired', side: 'on' },
] as const;

const DISABLED_CELL_CLASS =
  'flex items-center justify-center font-mono text-[var(--text-muted)] text-xs';

function checkboxLabelClass(checked: boolean): string {
  return cn(
    'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
    checked
      ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 font-semibold text-[var(--text-heading)] shadow-xs'
      : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--accent-gold)]/50'
  );
}

export function TyreSwapTable({
  off,
  on,
  showOff,
  showOn,
  offLocked = false,
  onChange,
}: TyreSwapTableProps) {
  const makeOptions = (currentValue: string): readonly string[] => {
    if (!currentValue || (TIRE_MAKES as readonly string[]).includes(currentValue)) {
      return TIRE_MAKES;
    }
    return [currentValue, ...TIRE_MAKES];
  };

  const renderField = (side: 'off' | 'on', field: (typeof FIELD_ROWS)[number]) => {
    const values = side === 'off' ? off : on;
    const isInactive = side === 'off' ? !showOff : !showOn;
    const isLocked = side === 'off' && offLocked;
    const value = values[field.key];

    if (field.key === 'make') {
      return (
        <select
          aria-label={`Tyre ${side === 'off' ? 'Off' : 'On'} make`}
          value={value}
          disabled={isInactive || isLocked}
          onChange={(event) => onChange(side, 'make', event.target.value)}
          className={FIELD_INPUT_CLASS}
        >
          <option value="">Select make...</option>
          {makeOptions(value).map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </select>
      );
    }

    const isNumeric = field.key === 'tra' || field.key === 'treadDepth';
    return (
      <input
        type={isNumeric ? 'number' : 'text'}
        aria-label={`Tyre ${side === 'off' ? 'Off' : 'On'} ${field.label.toLowerCase()}`}
        placeholder={field.placeholder}
        value={value}
        min={field.key === 'tra' ? 0 : undefined}
        max={field.key === 'tra' ? 200 : field.key === 'treadDepth' ? 150 : undefined}
        step={field.key === 'treadDepth' ? 0.1 : isNumeric ? 1 : undefined}
        readOnly={isNumeric ? false : isLocked}
        disabled={isInactive}
        onChange={(event) => onChange(side, field.key, event.target.value)}
        className={FIELD_INPUT_CLASS}
      />
    );
  };

  return (
    <div className="gold-steel-border gold-steel-border-slim overflow-x-auto rounded-xl border border-[var(--border-default)]">
      <table
        className="w-full min-w-[620px] border-collapse text-left"
        aria-label="Tyre Off and Tyre On changeout table"
      >
        <thead>
          <tr>
            <th scope="col" className={cn(GROUP_HEADER_CLASS, 'w-[150px]')}>
              <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                Field
              </span>
            </th>
            <th scope="col" className={cn(GROUP_HEADER_CLASS, 'bg-amber-500/[0.04]')}>
              <div className="flex items-center gap-2">
                <TyreArtwork variant="worn" className="h-9 w-9 shrink-0" />
                <div>
                  <span className="block font-bold text-[var(--text-heading)] text-sm">
                    Tyre Off
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Tyre removed from equipment
                  </span>
                </div>
              </div>
            </th>
            <th scope="col" className={cn(GROUP_HEADER_CLASS, 'bg-emerald-500/[0.04]')}>
              <div className="flex items-center gap-2">
                <TyreArtwork variant="new" className="h-9 w-9 shrink-0" />
                <div>
                  <span className="block font-bold text-[var(--text-heading)] text-sm">
                    Tyre On
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Tyre installed onto equipment
                  </span>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {FIELD_ROWS.map((field) => (
            <tr key={field.key}>
              <th scope="row" className={ROW_LABEL_CLASS}>
                {field.label}
              </th>
              <td className={cn(CELL_CLASS, !showOff && 'opacity-50')}>
                {renderField('off', field)}
              </td>
              <td className={cn(CELL_CLASS, !showOn && 'opacity-50')}>
                {renderField('on', field)}
              </td>
            </tr>
          ))}
          {CHECKBOX_ROWS.map((row) => {
            const values = row.side === 'off' ? off : on;
            const isActive = row.side === 'off' ? showOff : showOn;
            const isChecked = Boolean(values[row.key]);
            return (
              <tr key={row.key}>
                <th scope="row" className={ROW_LABEL_CLASS}>
                  {row.label}
                </th>
                <td className={CELL_CLASS}>
                  {row.side === 'off' ? (
                    <label className={cn(checkboxLabelClass(isChecked), !isActive && 'opacity-50')}>
                      <input
                        type="checkbox"
                        aria-label={`${row.label} (Tyre Off)`}
                        checked={isChecked}
                        disabled={!isActive}
                        onChange={(event) => onChange('off', row.key, event.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--accent-gold)]"
                      />
                      <span>{row.label}</span>
                    </label>
                  ) : (
                    <span className={DISABLED_CELL_CLASS}>—</span>
                  )}
                </td>
                <td className={CELL_CLASS}>
                  {row.side === 'on' ? (
                    <label className={cn(checkboxLabelClass(isChecked), !isActive && 'opacity-50')}>
                      <input
                        type="checkbox"
                        aria-label={`${row.label} (Tyre On)`}
                        checked={isChecked}
                        disabled={!isActive}
                        onChange={(event) => onChange('on', row.key, event.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--accent-gold)]"
                      />
                      <span>{row.label}</span>
                    </label>
                  ) : (
                    <span className={DISABLED_CELL_CLASS}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
