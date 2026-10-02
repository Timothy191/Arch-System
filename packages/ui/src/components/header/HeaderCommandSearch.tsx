'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Cpu, Crosshair, Layers, Search, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export type SearchScope = 'All' | 'Assets' | 'Telemetry' | 'Blast Patterns' | 'Personnel';

const SCOPES: { label: SearchScope; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'All', icon: Layers },
  { label: 'Assets', icon: Cpu },
  { label: 'Telemetry', icon: Crosshair },
  { label: 'Blast Patterns', icon: Crosshair },
  { label: 'Personnel', icon: Users },
];

export interface HeaderCommandSearchProps {
  className?: string;
  onOpenCommandBar?: () => void;
  onScopeChange?: (scope: SearchScope) => void;
}

export function HeaderCommandSearch({
  className,
  onOpenCommandBar,
  onScopeChange,
}: HeaderCommandSearchProps) {
  const [currentScope, setCurrentScope] = useState<SearchScope>('All');
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform));
    }
  }, []);

  const triggerModal = () => {
    if (onOpenCommandBar) {
      onOpenCommandBar();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: isMac,
          ctrlKey: !isMac,
          bubbles: true,
        })
      );
      window.dispatchEvent(new CustomEvent('open-command-bar'));
    }
  };

  const handleSelectScope = (scope: SearchScope, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentScope(scope);
    setScopeDropdownOpen(false);
    onScopeChange?.(scope);
  };

  return (
    <div className={cn('relative w-full max-w-md flex items-center justify-center', className)}>
      <motion.div
        whileTap={{ scale: 0.99 }}
        className="w-full bg-slate-100/70 dark:bg-slate-800/50 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-full h-9 px-3 flex items-center gap-2 transition-all cursor-pointer shadow-sm group focus-within:ring-2 focus-within:ring-amber-500/20"
        onClick={triggerModal}
        role="button"
        tabIndex={0}
        aria-label="Open command palette search"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerModal();
          }
        }}
      >
        {/* ── Scope Filter Dropdown ── */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setScopeDropdownOpen((prev) => !prev);
            }}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
            title="Filter search scope"
          >
            <span>{currentScope}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-150" />
          </button>

          <AnimatePresence>
            {scopeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScopeDropdownOpen(false);
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1.5 w-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-50 text-xs"
                >
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    Search Scope
                  </div>
                  {SCOPES.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={(e) => handleSelectScope(label, e)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors',
                        currentScope === label
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 opacity-70" />
                      <span>{label}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 shrink-0" aria-hidden="true" />

        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />

        <span className="text-xs text-slate-400 placeholder:text-slate-400 font-normal truncate flex-1 select-none text-left">
          Search assets, blast patterns, telemetry...
        </span>

        {/* ── Hotkey Indicator ── */}
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 shadow-sm shrink-0 select-none">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </motion.div>
    </div>
  );
}
