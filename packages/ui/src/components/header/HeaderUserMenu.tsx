'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, Settings, Shield, User } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { cn } from '../../lib/utils';

export interface HeaderUserMenuProps {
  className?: string;
  name?: string;
  role?: string;
  initials?: string;
  onLogout?: () => void;
}

export function HeaderUserMenu({
  className,
  name = 'Rudie C.',
  role = 'Drill & Blast Manager',
  initials = 'RC',
  onLogout,
}: HeaderUserMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative shrink-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
        title="User Profile & Security Access"
        aria-label="User account menu"
      >
        {/* Initials circle */}
        <div className="h-7 w-7 rounded-full bg-slate-900 text-amber-400 text-xs font-mono font-semibold flex items-center justify-center shrink-0 border border-amber-500/30 shadow-sm">
          {initials}
        </div>

        {/* Compact text (hidden on mobile, visible on desktop) */}
        <div className="hidden lg:flex flex-col text-left leading-none">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{name}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight mt-0.5">
            {role}
          </span>
        </div>

        <ChevronDown
          className={cn(
            'w-3 h-3 text-slate-400 transition-transform duration-200 hidden sm:block',
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
              className="absolute right-0 top-full mt-2 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs text-slate-800 dark:text-slate-200 space-y-1"
            >
              {/* Profile Card Header */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-900 text-amber-400 text-xs font-mono font-semibold flex items-center justify-center border border-amber-500/30 shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold text-xs text-slate-900 dark:text-white leading-tight">
                      {name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {role}
                    </p>
                  </div>
                </div>
                <div className="pt-1.5 flex items-center gap-2 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Clearance Level 4 · Active</span>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="py-1 space-y-0.5">
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Admin Security Console</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Operational Settings</span>
                </Link>

                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Operator Profile</span>
                </Link>
              </div>

              {/* Sign out */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (onLogout) {
                      onLogout();
                    } else if (typeof window !== 'undefined') {
                      window.location.href = '/login';
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
