'use client';

import * as Popover from '@radix-ui/react-popover';
import { cn } from '@repo/ui/lib/utils';
import { useEffect, useState } from 'react';

const ACTIVE_POPOVER_TICK_MS = 1000;
const CLOSED_PILL_TICK_MS = 15000;
const CALENDAR_NAV_BUTTON_CLASS =
  'flex h-6 w-6 items-center justify-center rounded-lg font-bold text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-white hover:shadow-sm';

function formatJohannesburgClockLabel(now: Date): string {
  const timePart = now.toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const dayPart = now.toLocaleDateString('en-GB', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short',
  });

  return `${dayPart} ${timePart}`;
}

export function SystemClock({ embedded = false }: { readonly embedded?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeStr, setTimeStr] = useState<string>('');
  const [time, setTime] = useState<Date>(() => new Date());
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      if (isOpen) {
        setTime(now);
      }
      const formatted = formatJohannesburgClockLabel(now);
      setTimeStr((prev) => (prev === formatted ? prev : formatted));
    }

    updateClock();
    const tickIntervalMs = isOpen ? ACTIVE_POPOVER_TICK_MS : CLOSED_PILL_TICK_MS;
    const interval = setInterval(updateClock, tickIntervalMs);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!timeStr) {
    return (
      <span className="inline-block h-4 w-[58px] rounded-full bg-black/5" aria-hidden="true" />
    );
  }

  const today = new Date();
  const viewYear = calendarDate.getFullYear();
  const viewMonth = calendarDate.getMonth();
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

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

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
              ? 'flex cursor-default select-none items-center gap-1 rounded-full px-1 outline-none transition-colors hover:text-[var(--accent-blue)] active:scale-95'
              : 'gold-steel-border gold-steel-border-slim flex h-7 cursor-default select-none items-center gap-1.5 rounded-full border border-white/20 bg-[var(--material-ultra-thin)] px-2.5 shadow-diffusion-sm outline-none backdrop-blur-md transition-colors hover:bg-[var(--material-thin)] active:scale-95'
          )}
        >
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

                return (
                  <div
                    key={`day-${day}`}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg font-medium text-[11px] tabular-nums transition-colors',
                      isToday
                        ? 'bg-[var(--accent-blue)] font-bold text-white shadow-card ring-2 ring-[var(--accent-blue)]/25'
                        : isWeekend
                          ? 'bg-black/[0.02] text-[var(--text-secondary)] hover:bg-black/[0.06]'
                          : 'text-[var(--text-heading)] hover:bg-black/[0.05]'
                    )}
                  >
                    {day}
                  </div>
                );
              })}
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

            <div className="mt-3 rounded-lg border border-black/[0.06] bg-black/[0.03] px-2.5 py-1 text-center">
              <div className="select-all font-mono font-semibold text-[12px] text-[var(--text-heading)] tabular-nums">
                {time.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })}
              </div>
              <div className="font-mono text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                SAST · UTC+2
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
