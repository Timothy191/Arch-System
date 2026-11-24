'use client';

import * as Popover from '@radix-ui/react-popover';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { cn } from '@repo/ui/lib/utils';
import { Clock, Hammer, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

const ACTIVE_POPOVER_TICK_MS = 1000;
const CLOSED_PILL_TICK_MS = 15000;
const DEFAULT_DAILY_TARGET_TONS = 2400;
const CALENDAR_NAV_BUTTON_CLASS =
  'flex h-6 w-6 items-center justify-center rounded-lg font-bold text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-white hover:shadow-sm';

type ClockTimezoneMode = 'sast' | 'utc' | 'local';

interface DayOperationalStatus {
  readonly targetState?: 'met' | 'missed';
  readonly hasBreakdown: boolean;
}

const TIMEZONE_META: Readonly<
  Record<
    ClockTimezoneMode,
    { readonly label: string; readonly iana?: string; readonly badge: string }
  >
> = {
  sast: { label: 'SAST', iana: 'Africa/Johannesburg', badge: 'SAST · UTC+2' },
  utc: { label: 'UTC', iana: 'UTC', badge: 'UTC · UTC+0' },
  local: { label: 'Local', badge: 'LOCAL · DEVICE' },
};

function getTimePartsForZone(
  now: Date,
  mode: ClockTimezoneMode
): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const iana = TIMEZONE_META[mode].iana;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: iana,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const read = (type: 'hour' | 'minute' | 'second') =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    hours: read('hour') % 24,
    minutes: read('minute'),
    seconds: read('second'),
  };
}

function formatClockPillLabel(now: Date, mode: ClockTimezoneMode, hour12: boolean): string {
  const iana = TIMEZONE_META[mode].iana;
  const timePart = now.toLocaleTimeString('en-GB', {
    timeZone: iana,
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });

  const dayPart = now.toLocaleDateString('en-GB', {
    timeZone: iana,
    weekday: 'short',
  });

  return `${dayPart} ${timePart}`;
}

export function SystemClock({ embedded = false }: { readonly embedded?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeStr, setTimeStr] = useState<string>('');
  const [time, setTime] = useState<Date>(() => new Date());
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [timezoneMode, setTimezoneMode] = useState<ClockTimezoneMode>(() => {
    if (typeof window === 'undefined') return 'sast';
    const stored = window.localStorage.getItem('arch-clock-timezone');
    return stored === 'utc' || stored === 'local' ? stored : 'sast';
  });
  const [hour12, setHour12] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('arch-clock-hour12') === 'true';
  });
  const [dayStatusMap, setDayStatusMap] = useState<Readonly<Record<string, DayOperationalStatus>>>(
    {}
  );

  const selectTimezone = (nextMode: ClockTimezoneMode) => {
    setTimezoneMode(nextMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('arch-clock-timezone', nextMode);
    }
  };

  const toggleHour12 = () => {
    setHour12((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('arch-clock-hour12', String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      if (isOpen) {
        setTime(now);
      }
      const formatted = formatClockPillLabel(now, timezoneMode, hour12);
      setTimeStr((prev) => (prev === formatted ? prev : formatted));
    }

    updateClock();
    const tickIntervalMs = isOpen ? ACTIVE_POPOVER_TICK_MS : CLOSED_PILL_TICK_MS;
    const interval = setInterval(updateClock, tickIntervalMs);
    return () => clearInterval(interval);
  }, [isOpen, timezoneMode, hour12]);

  const viewYear = calendarDate.getFullYear();
  const viewMonth = calendarDate.getMonth();

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadMonthOperationalStatus() {
      const monthPadded = String(viewMonth + 1).padStart(2, '0');
      const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
      const monthStart = `${viewYear}-${monthPadded}-01`;
      const monthEnd = `${viewYear}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

      try {
        const supabase = createBrowserSupabaseClient();
        const [{ data: dailyLogs }, { data: breakdowns }] = await Promise.all([
          supabase
            .from('daily_logs')
            .select('id, log_date, production_logs(coal_tonnes, waste_tonnes)')
            .gte('log_date', monthStart)
            .lte('log_date', monthEnd),
          supabase
            .from('breakdowns')
            .select('id, date_in, created_at')
            .is('deleted_at', null)
            .gte('created_at', `${monthStart}T00:00:00.000Z`)
            .lte('created_at', `${monthEnd}T23:59:59.999Z`),
        ]);

        if (cancelled) return;

        const nextMap: Record<string, DayOperationalStatus> = {};
        const totalsByDate = new Map<string, number>();

        if (Array.isArray(dailyLogs)) {
          for (const row of dailyLogs) {
            const dateKey = String(row.log_date ?? '').slice(0, 10);
            if (!dateKey) continue;
            const prodEntries = Array.isArray(row.production_logs)
              ? row.production_logs
              : row.production_logs
                ? [row.production_logs]
                : [];
            let dayTotal = totalsByDate.get(dateKey) ?? 0;
            for (const entry of prodEntries) {
              dayTotal += Number(entry.coal_tonnes ?? 0) + Number(entry.waste_tonnes ?? 0);
            }
            totalsByDate.set(dateKey, dayTotal);
          }
        }

        for (const [dateKey, totalTons] of totalsByDate.entries()) {
          nextMap[dateKey] = {
            targetState: totalTons >= DEFAULT_DAILY_TARGET_TONS ? 'met' : 'missed',
            hasBreakdown: false,
          };
        }

        if (Array.isArray(breakdowns)) {
          for (const bd of breakdowns) {
            const dateKey = String(bd.date_in ?? bd.created_at ?? '').slice(0, 10);
            if (!dateKey) continue;
            const existing = nextMap[dateKey];
            nextMap[dateKey] = {
              targetState: existing?.targetState,
              hasBreakdown: true,
            };
          }
        }

        setDayStatusMap(nextMap);
      } catch {
        // Leave calendar operational markers empty when Supabase client is unavailable
      }
    }

    void loadMonthOperationalStatus();
    return () => {
      cancelled = true;
    };
  }, [isOpen, viewYear, viewMonth]);

  if (!timeStr) {
    return (
      <span className="inline-block h-4 w-[58px] rounded-full bg-black/5" aria-hidden="true" />
    );
  }

  const today = new Date();
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const monthLabel = calendarDate.toLocaleString('en-US', { month: 'long' });
  const todaySummary = today.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    daysArray.push(d);
  }

  const prevMonth = () => setCalendarDate(new Date(viewYear, viewMonth - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(viewYear, viewMonth + 1, 1));
  const prevYear = () => setCalendarDate(new Date(viewYear - 1, viewMonth, 1));
  const nextYear = () => setCalendarDate(new Date(viewYear + 1, viewMonth, 1));
  const jumpToToday = () => setCalendarDate(new Date());

  const { hours, minutes, seconds } = getTimePartsForZone(time, timezoneMode);

  const hourDeg = ((hours % 12) / 12) * 360 + (minutes / 60) * 30;
  const minuteDeg = (minutes / 60) * 360 + (seconds / 60) * 6;
  const secondDeg = (seconds / 60) * 360;

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Clock & Calendar"
          className={cn(
            embedded
              ? 'flex cursor-default select-none items-center gap-1 rounded-full px-1 outline-none transition-colors hover:text-accent-gold active:scale-95'
              : 'gold-steel-border gold-steel-border-slim flex h-7 cursor-default select-none items-center gap-1.5 rounded-full border border-accent-gold/45 bg-[var(--material-ultra-thin)] px-2.5 shadow-diffusion-sm outline-none backdrop-blur-md transition-colors hover:bg-[var(--material-thin)] active:scale-95'
          )}
        >
          <Clock className="h-3 w-3 shrink-0 text-accent-gold" aria-hidden="true" />
          <span className="font-mono font-semibold text-[12px] text-[var(--text-heading)] tabular-nums leading-none">
            {timeStr}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-popover flex select-none gap-5 rounded-2xl border border-black/[0.08] bg-white/95 p-4 shadow-window backdrop-blur-2xl focus:outline-none"
        >
          {/* Left panel: Calendar */}
          <div className="w-[218px]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono font-semibold text-[10px] text-[var(--accent-blue)] uppercase tracking-wider">
                {todaySummary}
              </span>
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={jumpToToday}
                  className="rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-semibold text-[10px] text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)]/20"
                >
                  Today
                </button>
              )}
            </div>

            <div className="mb-3 flex items-center justify-between rounded-xl border border-black/[0.06] bg-black/[0.02] px-1.5 py-1">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={prevYear}
                  title="Previous Year"
                  aria-label="Previous Year"
                  className={CALENDAR_NAV_BUTTON_CLASS}
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  onClick={prevMonth}
                  title="Previous Month"
                  aria-label="Previous Month"
                  className={CALENDAR_NAV_BUTTON_CLASS}
                >
                  &lsaquo;
                </button>
              </div>
              <span className="font-semibold text-[12.5px] text-[var(--text-heading)] tracking-tight">
                {monthLabel.substring(0, 3)} {viewYear}
              </span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={nextMonth}
                  title="Next Month"
                  aria-label="Next Month"
                  className={CALENDAR_NAV_BUTTON_CLASS}
                >
                  &rsaquo;
                </button>
                <button
                  type="button"
                  onClick={nextYear}
                  title="Next Year"
                  aria-label="Next Year"
                  className={CALENDAR_NAV_BUTTON_CLASS}
                >
                  &raquo;
                </button>
              </div>
            </div>

            <div className="mb-1.5 grid grid-cols-7 gap-1 text-center font-semibold text-[9.5px] text-[var(--text-muted)] tracking-wider">
              <span className="text-amber-700/80">SU</span>
              <span>MO</span>
              <span>TU</span>
              <span>WE</span>
              <span>TH</span>
              <span>FR</span>
              <span className="text-amber-700/80">SA</span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {daysArray.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-7 w-7" />;
                }
                const isToday =
                  day === today.getDate() &&
                  viewMonth === today.getMonth() &&
                  viewYear === today.getFullYear();
                const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayStatus = dayStatusMap[dateKey];

                return (
                  <div
                    key={`day-${day}`}
                    aria-current={isToday ? 'date' : undefined}
                    title={
                      dayStatus
                        ? `${dayStatus.targetState === 'met' ? 'Target met' : dayStatus.targetState === 'missed' ? 'Target missed' : 'No production log'}${dayStatus.hasBreakdown ? ' · Engineering breakdown' : ''}`
                        : undefined
                    }
                    className={cn(
                      'relative flex h-7 w-7 items-center justify-center rounded-lg font-medium text-[11px] tabular-nums transition-colors',
                      isToday
                        ? 'bg-[var(--accent-blue)] font-bold text-white shadow-card ring-2 ring-[var(--accent-blue)]/25'
                        : dayStatus?.hasBreakdown
                          ? 'bg-rose-50/90 text-rose-900 ring-1 ring-rose-400/75 hover:bg-rose-100/80'
                          : isWeekend
                            ? 'bg-black/[0.02] text-[var(--text-secondary)] hover:bg-black/[0.06]'
                            : 'text-[var(--text-heading)] hover:bg-black/[0.05]'
                    )}
                  >
                    <span>{day}</span>
                    {dayStatus?.targetState && (
                      <Hammer
                        data-testid={
                          dayStatus.targetState === 'met'
                            ? `calendar-target-met-${day}`
                            : `calendar-target-missed-${day}`
                        }
                        className={cn(
                          'absolute bottom-0.5 left-0.5 h-2.5 w-2.5',
                          isToday
                            ? dayStatus.targetState === 'met'
                              ? 'text-emerald-200'
                              : 'text-rose-200'
                            : dayStatus.targetState === 'met'
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                        )}
                      />
                    )}
                    {dayStatus?.hasBreakdown && (
                      <Wrench
                        data-testid={`calendar-breakdown-spanner-${day}`}
                        className={cn(
                          'absolute right-0.5 bottom-0.5 h-2.5 w-2.5',
                          isToday ? 'text-rose-200' : 'text-rose-600'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center justify-between border-black/[0.06] border-t pt-2 text-[9px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <Hammer className="h-2.5 w-2.5 text-emerald-600" />
                Target Met
              </span>
              <span className="inline-flex items-center gap-1">
                <Hammer className="h-2.5 w-2.5 text-rose-600" />
                Missed
              </span>
              <span className="inline-flex items-center gap-1">
                <Wrench className="h-2.5 w-2.5 text-rose-600" />
                Breakdown
              </span>
            </div>
          </div>

          {/* Right panel: Analog + Digital Clock */}
          <div className="flex min-w-[132px] flex-col items-center justify-center border-black/[0.06] border-l pl-5">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-black/[0.08] bg-gradient-to-b from-white to-black/[0.03] shadow-inner ring-1 ring-black/[0.03]">
              <div className="absolute top-1.5 h-1.5 w-0.5 rounded-full bg-amber-600/70" />
              <div className="absolute bottom-1.5 h-1.5 w-0.5 rounded-full bg-black/25" />
              <div className="absolute left-1.5 h-0.5 w-1.5 rounded-full bg-black/25" />
              <div className="absolute right-1.5 h-0.5 w-1.5 rounded-full bg-black/25" />

              <div
                className="absolute bottom-1/2 left-1/2 h-6 w-[3px] origin-bottom rounded-full bg-zinc-900"
                style={{
                  transform: `translate(-50%, 0) rotate(${hourDeg}deg)`,
                  transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              />
              <div
                className="absolute bottom-1/2 left-1/2 h-8 w-[2px] origin-bottom rounded-full bg-zinc-600"
                style={{
                  transform: `translate(-50%, 0) rotate(${minuteDeg}deg)`,
                  transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              />
              <div
                className="absolute bottom-1/2 left-1/2 h-9 w-[1px] origin-bottom rounded-full bg-[var(--accent-red)]"
                style={{
                  transform: `translate(-50%, 0) rotate(${secondDeg}deg)`,
                  transition: secondDeg === 0 ? 'none' : 'transform 0.1s ease-out',
                }}
              />
              <div
                className="absolute h-2 w-2 rounded-full border border-white bg-zinc-900 shadow-sm"
                style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              />
            </div>

            <div className="mt-3 w-full rounded-lg border border-black/[0.06] bg-black/[0.03] px-2.5 py-1 text-center">
              <div className="select-all font-mono font-semibold text-[12px] text-[var(--text-heading)] tabular-nums">
                {time.toLocaleTimeString('en-US', {
                  timeZone: TIMEZONE_META[timezoneMode].iana,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12,
                })}
              </div>
              <div className="font-mono text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                {TIMEZONE_META[timezoneMode].badge}
              </div>
            </div>

            <div className="mt-2 flex w-full items-center justify-between gap-1">
              <div
                className="flex flex-1 rounded-lg border border-black/[0.06] bg-black/[0.02] p-0.5"
                role="group"
                aria-label="Clock timezone"
              >
                {(['sast', 'utc', 'local'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => selectTimezone(mode)}
                    aria-pressed={timezoneMode === mode}
                    className={cn(
                      'flex-1 rounded-md px-1.5 py-0.5 font-mono font-semibold text-[9px] uppercase transition-colors',
                      timezoneMode === mode
                        ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-black/[0.04]'
                    )}
                  >
                    {TIMEZONE_META[mode].label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={toggleHour12}
                aria-label="Toggle 12 or 24 hour format"
                className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-1.5 py-1 font-mono font-semibold text-[9px] text-[var(--text-secondary)] transition-colors hover:bg-black/[0.05]"
              >
                {hour12 ? '12H' : '24H'}
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
