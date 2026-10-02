'use client';

import { motion } from 'framer-motion';
import React from 'react';
import { cn } from '../../lib/utils';
import { HeaderBrand } from './HeaderBrand';
import { HeaderCommandSearch, type SearchScope } from './HeaderCommandSearch';
import { HeaderDiagnostics } from './HeaderDiagnostics';
import { HeaderShiftDropdown } from './HeaderShiftDropdown';
import { HeaderUserMenu } from './HeaderUserMenu';

export interface OperationsAppBarProps {
  className?: string;
  siteName?: string;
  siteCode?: string;
  unreadCommsCount?: number;
  onOpenComms?: () => void;
  onOpenCommandBar?: () => void;
  onScopeChange?: (scope: SearchScope) => void;
  latencyMs?: number;
  criticalAlertsCount?: number;
  shiftName?: string;
  shiftHours?: string;
  blastWindowTime?: string;
  blastWindowCountdown?: string;
  userName?: string;
  userRole?: string;
  userInitials?: string;
  onLogout?: () => void;
  /**
   * Optional custom slot for right side widgets or legacy compatibility
   */
  rightSlot?: React.ReactNode;
}

export function OperationsAppBar({
  className,
  siteName,
  siteCode,
  unreadCommsCount,
  onOpenComms,
  onOpenCommandBar,
  onScopeChange,
  latencyMs,
  criticalAlertsCount,
  shiftName,
  shiftHours,
  blastWindowTime,
  blastWindowCountdown,
  userName,
  userRole,
  userInitials,
  onLogout,
  rightSlot,
}: OperationsAppBarProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Operations Application Bar"
      className={cn(
        'fixed top-2 left-3 right-3 z-50 h-14 px-4 flex items-center justify-between',
        'rounded-full bg-white/80 dark:bg-slate-900/75 backdrop-blur-md',
        'border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)]',
        'transition-colors duration-200',
        className
      )}
    >
      {/* ── 1. Left Zone: Site Identity & Dispatch Comms ── */}
      <div className="flex items-center shrink-0">
        <HeaderBrand
          siteName={siteName}
          siteCode={siteCode}
          unreadCommsCount={unreadCommsCount}
          onOpenComms={onOpenComms}
        />
      </div>

      {/* Subtle vertical divider */}
      <div
        className="h-6 w-[1px] bg-slate-200/60 dark:bg-slate-700/60 mx-2 hidden md:block shrink-0"
        aria-hidden="true"
      />

      {/* ── 2. Center Zone: Command Palette / Global Telemetry Search ── */}
      <div className="flex-1 flex items-center justify-center mx-2 max-w-md">
        <HeaderCommandSearch onOpenCommandBar={onOpenCommandBar} onScopeChange={onScopeChange} />
      </div>

      {/* Subtle vertical divider */}
      <div
        className="h-6 w-[1px] bg-slate-200/60 dark:bg-slate-700/60 mx-2 hidden sm:block shrink-0"
        aria-hidden="true"
      />

      {/* ── 3. Right Zone: System Diagnostics, Shift Clock, Alert Counter & User Profile ── */}
      <div className="flex items-center gap-2 shrink-0">
        <HeaderDiagnostics latencyMs={latencyMs} criticalAlertsCount={criticalAlertsCount} />

        <div
          className="h-5 w-[1px] bg-slate-200/60 dark:bg-slate-700/60 mx-1 hidden lg:block shrink-0"
          aria-hidden="true"
        />

        <HeaderShiftDropdown
          shiftName={shiftName}
          shiftHours={shiftHours}
          blastWindowTime={blastWindowTime}
          blastWindowCountdown={blastWindowCountdown}
        />

        <div
          className="h-5 w-[1px] bg-slate-200/60 dark:bg-slate-700/60 mx-1 hidden sm:block shrink-0"
          aria-hidden="true"
        />

        <HeaderUserMenu
          name={userName}
          role={userRole}
          initials={userInitials}
          onLogout={onLogout}
        />

        {rightSlot}
      </div>
    </motion.header>
  );
}
