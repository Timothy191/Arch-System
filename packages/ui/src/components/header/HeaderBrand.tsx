'use client';

import { Radio } from 'lucide-react';
import React from 'react';
import { cn } from '../../lib/utils';
import { Logo } from '../Logo';

export interface HeaderBrandProps {
  className?: string;
  siteName?: string;
  siteCode?: string;
  unreadCommsCount?: number;
  onOpenComms?: () => void;
}

export function HeaderBrand({
  className,
  siteName = 'ARCH OPS',
  siteCode = '// DELMAS PIT-01',
  unreadCommsCount = 2,
  onOpenComms,
}: HeaderBrandProps) {
  const handleCommsClick = () => {
    if (onOpenComms) {
      onOpenComms();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('open-split-view', {
          detail: { service: 'whatsapp', action: 'toggle' },
        })
      );
    }
  };

  return (
    <div className={cn('flex items-center gap-2.5 shrink-0', className)}>
      {/* ── Brand Logo & Site Context ── */}
      <div className="flex items-center gap-2">
        <div
          aria-hidden="true"
          className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-105"
        >
          <Logo className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-800 dark:text-slate-200">
            {siteName}
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 tracking-tight mt-0.5">
            {siteCode}
          </span>
        </div>
      </div>

      {/* ── Sub-divider ── */}
      <div
        className="h-5 w-[1px] bg-slate-200/60 dark:bg-slate-700/60 mx-1 hidden sm:block"
        aria-hidden="true"
      />

      {/* ── Dispatch / Comms Pill ── */}
      <button
        type="button"
        onClick={handleCommsClick}
        title="Site Comms & Blast Dispatch"
        className="h-8 px-2.5 rounded-full bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
      >
        <Radio className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
        <span className="hidden sm:inline text-[11px] font-medium text-slate-600 dark:text-slate-300">
          Comms
        </span>
        {unreadCommsCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {unreadCommsCount}
          </span>
        )}
      </button>
    </div>
  );
}
