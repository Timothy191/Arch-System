'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock, Globe, ShieldAlert, Timer } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export interface HeaderShiftDropdownProps {
  className?: string;
  shiftName?: string;
  shiftHours?: string;
  blastWindowTime?: string;
  blastWindowCountdown?: string;
}

export function HeaderShiftDropdown({
  className,
  shiftName = 'SHIFT 1',
  shiftHours = '06:00 - 18:00',
  blastWindowTime = '13:30',
  blastWindowCountdown = '4h 26m',
}: HeaderShiftDropdownProps) {
  const [open, setOpen] = useState(false);
  const [timezone, setTimezone] = useState<'SAST' | 'UTC'>('SAST');
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      if (timezone === 'SAST') {
        // SAST is UTC+2
        const options: Intl.DateTimeFormatOptions = {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Africa/Johannesburg',
        };
        setTimeString(`${now.toLocaleDateString('en-GB', options)} SAST`);
      } else {
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const mins = String(now.getUTCMinutes()).padStart(2, '0');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        setTimeString(`${days[now.getUTCDay()]} ${hours}:${mins} UTC (Zulu)`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Shift progress calculation (Assuming 06:00 to 18:00 = 12h)
  const shiftHoursElapsed = 5.2;
  const shiftHoursTotal = 12;
  const shiftProgressPct = Math.round((shiftHoursElapsed / shiftHoursTotal) * 100);

  return (
    <div className={cn('relative shrink-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/60 dark:border-slate-700/60 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        title="Shift Telemetry & Blast Window Details"
      >
        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="font-mono tabular-nums text-xs font-medium text-slate-700 dark:text-slate-300">
          {timeString || 'Loading...'}
        </span>
        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 hidden xl:inline">
          │ {shiftName} [{shiftHours}]
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-slate-400 transition-transform duration-200',
            open && 'rotate-180 text-slate-600 dark:text-slate-200'
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 z-50 text-slate-800 dark:text-slate-200 space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Operational Schedule
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                  {shiftName}
                </span>
              </div>

              {/* Timezone Switcher */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Timezone Reference
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setTimezone('SAST')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all text-center',
                      timezone === 'SAST'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70'
                    )}
                  >
                    SAST (UTC+2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimezone('UTC')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all text-center',
                      timezone === 'UTC'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70'
                    )}
                  >
                    UTC (Zulu)
                  </button>
                </div>
              </div>

              {/* Blast Window Timer */}
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Next Blast Clearance
                  </span>
                  <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 text-xs">
                    {blastWindowTime}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    Window Countdown:
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {blastWindowCountdown}
                  </span>
                </div>
              </div>

              {/* Shift Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Shift Elapsed ({shiftHours})</span>
                  <span className="font-mono tabular-nums text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {shiftHoursElapsed}h / {shiftHoursTotal}h [{shiftProgressPct}%]
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${shiftProgressPct}%` }}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
