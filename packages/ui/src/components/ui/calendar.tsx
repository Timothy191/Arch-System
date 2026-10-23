'use client';

import { ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface DateRange {
  start?: Date | null;
  end?: Date | null;
}

export type DateValue = Date;
export type RangeValue<T> = { start?: T | null; end?: T | null };

export interface DatePreset {
  text: string;
  start: Date;
  end: Date;
}

export interface CalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: DateRange | Date | null;
  onChange?: (value: DateRange | any) => void;
  size?: 'small' | 'medium';
  allowClear?: boolean;
  compact?: boolean;
  stacked?: boolean;
  horizontalLayout?: boolean;
  presets?: Record<string, DatePreset>;
  presetIndex?: number;
  minValue?: Date | number;
  maxValue?: Date | number;
  pinnedTimezone?: string;
  showTimeInput?: boolean;
  popoverAlignment?: 'start' | 'center' | 'end';
}

export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  (
    {
      value,
      onChange,
      size = 'medium',
      allowClear = false,
      compact = false,
      stacked = false,
      horizontalLayout = false,
      presets,
      presetIndex,
      minValue,
      maxValue,
      pinnedTimezone,
      className,
      ...props
    },
    ref
  ) => {
    // Current viewed month
    const [viewDate, setViewDate] = React.useState<Date>(() => {
      if (value && 'start' in value && value.start instanceof Date) return value.start;
      if (value instanceof Date) return value;
      return new Date();
    });

    // Preset selection on mount
    React.useEffect(() => {
      if (presets && presetIndex !== undefined) {
        const keys = Object.keys(presets);
        const targetKey = keys[presetIndex];
        if (targetKey && presets[targetKey]) {
          onChange?.({
            start: presets[targetKey].start,
            end: presets[targetKey].end,
          });
        }
      }
    }, [presets, presetIndex, onChange]);

    // Normalizing current selection
    const rangeStart =
      value && typeof value === 'object' && 'start' in value
        ? value.start
        : value instanceof Date
          ? value
          : null;
    const rangeEnd = value && typeof value === 'object' && 'end' in value ? value.end : null;

    const min = minValue ? new Date(minValue) : null;
    const max = maxValue ? new Date(maxValue) : null;

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Days in month calculation
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const handlePrevMonth = () => {
      setViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
      setViewDate(new Date(year, month + 1, 1));
    };

    const handleDateClick = (day: number) => {
      const clicked = new Date(year, month, day);

      if (min && clicked < min) return;
      if (max && clicked > max) return;

      if (!rangeStart || (rangeStart && rangeEnd)) {
        // First click sets start, clears end
        onChange?.({ start: clicked, end: null });
      } else {
        // Second click sets end
        if (clicked < rangeStart) {
          onChange?.({ start: clicked, end: rangeStart });
        } else {
          onChange?.({ start: rangeStart, end: clicked });
        }
      }
    };

    const handleClear = () => {
      onChange?.(null);
    };

    const handlePresetClick = (preset: DatePreset) => {
      onChange?.({ start: preset.start, end: preset.end });
      setViewDate(preset.start);
    };

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const isSmall = size === 'small';

    return (
      <div
        ref={ref}
        role="region"
        aria-label="Calendar"
        className={cn(
          'inline-flex select-none rounded-xl border border-neutral-200 bg-white p-4 shadow-sm',
          horizontalLayout || (!stacked && presets)
            ? 'flex-col gap-6 md:flex-row'
            : 'flex-col gap-4',
          isSmall ? 'text-xs' : 'text-sm',
          className
        )}
        {...props}
      >
        {/* Presets Sidebar (if present) */}
        {presets && (
          <div
            className={cn(
              'flex shrink-0 flex-col gap-1',
              stacked ? 'border-neutral-200 border-b pb-3' : 'border-neutral-200 border-r pr-4'
            )}
          >
            <span className="mb-1 font-mono text-[11px] text-neutral-400 uppercase tracking-wider">
              Presets
            </span>
            <div className={cn('flex', stacked ? 'flex-row flex-wrap gap-1.5' : 'flex-col gap-1')}>
              {Object.entries(presets).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="rounded-md px-2.5 py-1 text-left font-medium text-neutral-600 text-xs transition-colors hover:bg-neutral-100"
                >
                  {preset.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calendar Core */}
        <div className="flex min-w-[240px] flex-col gap-3">
          {/* Header Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-neutral-900">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next Month"
              className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-medium text-neutral-400 text-xs">
            {weekDays.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);

              const isStart = rangeStart && date.toDateString() === rangeStart.toDateString();
              const isEnd = rangeEnd && date.toDateString() === rangeEnd.toDateString();
              const isInRange = rangeStart && rangeEnd && date > rangeStart && date < rangeEnd;

              const isDisabled = (min && date < min) || (max && date > max);

              return (
                <button
                  key={day}
                  type="button"
                  disabled={Boolean(isDisabled)}
                  onClick={() => handleDateClick(day)}
                  className={cn(
                    'mx-auto flex h-8 w-8 items-center justify-center rounded-md font-medium text-xs transition-colors',
                    isStart || isEnd
                      ? 'bg-neutral-900 font-semibold text-white shadow-2xs'
                      : isInRange
                        ? 'rounded-none bg-neutral-100 text-neutral-900'
                        : 'text-neutral-700 hover:bg-neutral-100',
                    isDisabled && 'pointer-events-none cursor-not-allowed opacity-30'
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Controls: Allow Clear & Pinned Timezone */}
          {(allowClear || pinnedTimezone) && (
            <div className="flex items-center justify-between border-neutral-200 border-t pt-3 text-neutral-500 text-xs">
              {pinnedTimezone ? (
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="h-3 w-3" />
                  {pinnedTimezone}
                </span>
              ) : (
                <div />
              )}

              {allowClear && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 text-neutral-500 text-xs transition-colors hover:text-neutral-900"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Calendar.displayName = 'Calendar';
