'use client';

import * as Popover from '@radix-ui/react-popover';
import { cn } from '@repo/ui/lib/utils';
import { useEffect, useState } from 'react';

// AGENT-TRACE: Consolidated clock timer effect and guarded setTime/setTimeStr updates to prevent state update depth recursion in Turbopack.
export function SystemClock() {
  const [timeStr, setTimeStr] = useState<string>('');
  const [time, setTime] = useState<Date>(() => new Date());
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTime(now);

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

      const formatted = `${dayPart} ${timePart}`;
      setTimeStr((prev) => (prev === formatted ? prev : formatted));
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeStr) return null;

  // Calendar calculations
  const viewYear = calendarDate.getFullYear();
  const viewMonth = calendarDate.getMonth();

  const monthLabel = calendarDate.toLocaleString('en-US', { month: 'long' });
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    daysArray.push(d);
  }

  // Navigation handlers
  const prevMonth = () => {
    setCalendarDate(new Date(viewYear, viewMonth - 1, 1));
  };
  const nextMonth = () => {
    setCalendarDate(new Date(viewYear, viewMonth + 1, 1));
  };
  const prevYear = () => {
    setCalendarDate(new Date(viewYear - 1, viewMonth, 1));
  };
  const nextYear = () => {
    setCalendarDate(new Date(viewYear + 1, viewMonth, 1));
  };

  // Analog clock hands rotations
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourDeg = ((hours % 12) / 12) * 360 + (minutes / 60) * 30;
  const minuteDeg = (minutes / 60) * 360 + (seconds / 60) * 6;
  const secondDeg = (seconds / 60) * 360;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="System Clock"
          title="Clock & Calendar"
          className="gold-steel-border gold-steel-border-slim flex h-7 cursor-default select-none items-center gap-1.5 rounded-full border border-white/20 bg-[var(--material-ultra-thin)] px-2.5 shadow-diffusion-sm outline-none backdrop-blur-md transition-colors hover:bg-[var(--material-thin)] active:scale-95"
        >
          <span className="font-mono font-semibold text-[13px] text-[var(--text-heading)] tabular-nums leading-none">
            {timeStr}
          </span>
          <span className="font-semibold text-[9.5px] text-[var(--text-secondary)] uppercase leading-none tracking-wider opacity-70">
            SAST
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-popover rounded-xl border border-black/[0.08] bg-white/95 p-4 shadow-window backdrop-blur-2xl',
            'flex select-none gap-5 focus:outline-none'
          )}
        >
          {/* Left panel: Calendar */}
          <div className="w-[185px]">
            {/* Header / Month Controls */}
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={prevYear}
                  title="Previous Year"
                  className="flex h-5 w-5 items-center justify-center rounded font-bold text-[12px] text-[var(--text-secondary)] hover:bg-black/[0.05]"
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  onClick={prevMonth}
                  title="Previous Month"
                  className="flex h-5 w-5 items-center justify-center rounded font-bold text-[12px] text-[var(--text-secondary)] hover:bg-black/[0.05]"
                >
                  &lsaquo;
                </button>
              </div>
              <span className="font-bold text-[12px] text-[var(--text-heading)]">
                {monthLabel.substring(0, 3)} {viewYear}
              </span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={nextMonth}
                  title="Next Month"
                  className="flex h-5 w-5 items-center justify-center rounded font-bold text-[12px] text-[var(--text-secondary)] hover:bg-black/[0.05]"
                >
                  &rsaquo;
                </button>
                <button
                  type="button"
                  onClick={nextYear}
                  title="Next Year"
                  className="flex h-5 w-5 items-center justify-center rounded font-bold text-[12px] text-[var(--text-secondary)] hover:bg-black/[0.05]"
                >
                  &raquo;
                </button>
              </div>
            </div>

            {/* Weekdays header */}
            <div className="mb-1.5 grid grid-cols-7 gap-0.5 text-center font-bold text-[9px] text-[var(--text-muted)]">
              <span>SU</span>
              <span>MO</span>
              <span>TU</span>
              <span>WE</span>
              <span>TH</span>
              <span>FR</span>
              <span>SA</span>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {daysArray.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-[24px] w-[24px]" />;
                }
                const today = new Date();
                const isToday =
                  day === today.getDate() &&
                  viewMonth === today.getMonth() &&
                  viewYear === today.getFullYear();

                return (
                  <div
                    key={`day-${day}`}
                    className={cn(
                      'flex h-[24px] w-[24px] items-center justify-center rounded-full font-medium text-[10.5px] transition-colors',
                      isToday
                        ? 'bg-[var(--accent-blue)] font-bold text-white shadow-card'
                        : 'text-[var(--text-heading)] hover:bg-black/[0.04]'
                    )}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel: Analog Clock */}
          <div className="flex min-w-[120px] flex-col items-center justify-center border-black/[0.06] border-l pl-5">
            {/* Clock Face */}
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-black/[0.08] bg-black/[0.01] shadow-inner">
              {/* Top hour indicator dot */}
              <div className="absolute top-1 h-1 w-1 rounded-full bg-black/20" />
              {/* Bottom hour indicator dot */}
              <div className="absolute bottom-1 h-1 w-1 rounded-full bg-black/20" />
              {/* Left hour indicator dot */}
              <div className="absolute left-1 h-1 w-1 rounded-full bg-black/20" />
              {/* Right hour indicator dot */}
              <div className="absolute right-1 h-1 w-1 rounded-full bg-black/20" />

              {/* Hour hand */}
              <div
                className="absolute bottom-1/2 left-1/2 h-6 w-[3px] origin-bottom rounded-full bg-black/85"
                style={{
                  transform: `translate(-50%, 0) rotate(${hourDeg}deg)`,
                  transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              />
              {/* Minute hand */}
              <div
                className="absolute bottom-1/2 left-1/2 h-9 w-[2px] origin-bottom rounded-full bg-black/60"
                style={{
                  transform: `translate(-50%, 0) rotate(${minuteDeg}deg)`,
                  transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              />
              {/* Second hand */}
              <div
                className="absolute bottom-1/2 left-1/2 h-10 w-[1px] origin-bottom rounded-full bg-[var(--accent-red)]"
                style={{
                  transform: `translate(-50%, 0) rotate(${secondDeg}deg)`,
                  transition: secondDeg === 0 ? 'none' : 'transform 0.1s ease-out',
                }}
              />
              {/* Center Pin */}
              <div
                className="absolute h-1.5 w-1.5 rounded-full border border-white bg-black"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>

            {/* Digital Time text */}
            <span className="mt-3 select-all font-semibold text-[11px] text-[var(--text-secondary)] tabular-nums">
              {time.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
