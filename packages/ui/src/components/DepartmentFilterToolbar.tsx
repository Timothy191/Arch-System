'use client';

import type React from 'react';
import { GlassCard } from './GlassCard';

export interface DepartmentShiftOption {
  readonly optionValue: string;
  readonly label: string;
}

export interface DepartmentFilterToolbarProps {
  readonly searchQuery?: string;
  readonly onSearchChange?: (nextQuery: string) => void;
  readonly searchPlaceholder?: string;
  readonly shiftFilter?: string;
  readonly onShiftFilterChange?: (nextShift: string) => void;
  readonly shiftOptions?: readonly DepartmentShiftOption[];
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly onDateFromChange?: (nextDate: string) => void;
  readonly onDateToChange?: (nextDate: string) => void;
  readonly onExportCsv?: () => void;
  readonly exportLabel?: string;
  readonly actionsSlot?: React.ReactNode;
  readonly className?: string;
}

const DEFAULT_SHIFT_OPTIONS: readonly DepartmentShiftOption[] = [
  { optionValue: 'ALL', label: 'All Shifts' },
  { optionValue: 'DAY', label: 'Day Shift' },
  { optionValue: 'NIGHT', label: 'Night Shift' },
];

const INPUT_CLASS =
  'min-h-[40px] rounded-lg border border-[var(--border-default)] bg-white/90 px-3 py-1.5 text-[var(--text-heading)] text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]';

const BUTTON_CLASS =
  'inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--border-default)] bg-white/90 px-3.5 py-1.5 font-medium text-[var(--text-heading)] text-sm shadow-xs transition-colors hover:bg-[var(--bg-secondary)]';

export function DepartmentFilterToolbar(props: DepartmentFilterToolbarProps) {
  const {
    searchQuery = '',
    onSearchChange,
    searchPlaceholder = 'Filter records...',
    shiftFilter = 'ALL',
    onShiftFilterChange,
    shiftOptions = DEFAULT_SHIFT_OPTIONS,
    dateFrom = '',
    dateTo = '',
    onDateFromChange,
    onDateToChange,
    onExportCsv,
    exportLabel = 'Export CSV',
    actionsSlot,
    className = '',
  } = props;

  return (
    <GlassCard
      variant="default"
      data-testid="department-filter-toolbar"
      className={`flex flex-wrap items-center justify-between gap-3 p-3.5 ${className}`.trim()}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {onSearchChange && (
          <input
            type="search"
            data-testid="department-filter-search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className={`${INPUT_CLASS} min-w-[200px] flex-1`}
          />
        )}

        {onShiftFilterChange && (
          <select
            data-testid="department-filter-shift"
            aria-label="Filter by shift"
            value={shiftFilter}
            onChange={(event) => onShiftFilterChange(event.target.value)}
            className={INPUT_CLASS}
          >
            {shiftOptions.map((option) => (
              <option key={option.optionValue} value={option.optionValue}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {onDateFromChange && (
          <input
            type="date"
            data-testid="department-filter-date-from"
            aria-label="From date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className={INPUT_CLASS}
          />
        )}

        {onDateToChange && (
          <input
            type="date"
            data-testid="department-filter-date-to"
            aria-label="To date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className={INPUT_CLASS}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actionsSlot}
        {onExportCsv && (
          <button
            type="button"
            data-testid="department-filter-export"
            onClick={onExportCsv}
            className={BUTTON_CLASS}
          >
            {exportLabel}
          </button>
        )}
      </div>
    </GlassCard>
  );
}
