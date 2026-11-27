'use client';

import type { Department } from '@repo/departments/data-access';
import { DepartmentCard } from '@repo/hub/ui';
import { ArchLogoBadge } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { ArchSeparator } from '@repo/ui/Separator';
import { Search, Star } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { useClearanceNotification } from '@/hooks/useClearanceNotification';
import { useDepartmentFilter } from '@/hooks/useDepartmentFilter';
import { usePinnedDepartments } from '@/hooks/usePinnedDepartments';
import { useTypewriterPlaceholder } from '@/hooks/useTypewriterPlaceholder';
import { dispatchActiveModuleChange } from '@/lib/event-manager';
import type { EmployeeClearance } from '@/lib/hub-departments';

interface CoreOperationalModulesProps {
  departments: Department[];
  clearance?: EmployeeClearance;
}

interface ModuleSearchInputProps {
  readonly searchQuery: string;
  readonly onSearchChange: (nextQuery: string) => void;
}

const FILTER_GROUP_CLASS = cn(
  'gold-steel-border gold-steel-border-slim chip-elevated-3d shining',
  'flex min-h-11 items-center gap-1.5 rounded-full border border-arch-border-subtle',
  'bg-arch-surface-secondary/90 p-1.5 font-medium text-[13px]'
);

const FILTER_TAB_BASE_CLASS =
  'chip-elevated-3d shining inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] tabular-nums leading-[18px] transition-all';

const FILTER_TAB_INACTIVE_CLASS =
  'border border-slate-500/80 bg-white/70 font-medium text-arch-text-secondary hover:border-slate-800 hover:bg-white/95 hover:text-arch-text-primary';

const HEADING_INITIAL_CLASS = 'font-black text-[1.35em] leading-none';

function ModuleSearchInput({ searchQuery, onSearchChange }: ModuleSearchInputProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchPlaceholder = useTypewriterPlaceholder(
    'Search modules... (/)',
    isSearchFocused || searchQuery.length > 0
  );

  return (
    <div className="gold-steel-border gold-steel-border-slim relative min-w-[200px] flex-1 rounded-full sm:w-64 sm:min-w-[240px]">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-4 w-4 -translate-y-1/2 text-accent-gold brightness-110" />
      <input
        id="hub-module-search"
        type="text"
        aria-label="Search operational modules"
        aria-describedby="hub-module-search-hint"
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={() => setIsSearchFocused(true)}
        onBlur={() => setIsSearchFocused(false)}
        className="gold-steel-border gold-steel-border-slim h-11 w-full rounded-full border border-accent-gold/45 bg-white/95 px-10 font-bold text-[13px] text-accent-gold caret-accent-gold brightness-110 placeholder:font-bold placeholder:text-accent-gold focus:border-accent-gold focus:outline-none"
      />
      <span id="hub-module-search-hint" className="sr-only">
        Press slash or Command K to focus the module search
      </span>
      {searchQuery ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onSearchChange('')}
          className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full font-bold text-[13px] text-accent-gold hover:bg-arch-surface-tertiary"
        >
          ✕
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-accent-gold/45 bg-white px-2 py-0.5 font-bold font-mono text-[13px] text-accent-gold leading-[18px]">
          /
        </kbd>
      )}
    </div>
  );
}

// AGENT-TRACE: Refactored Core Operational Modules component for Hub page with interactive search, category/status filtering, and pinned priority ordering.
// Business logic extracted to custom hooks for cleaner separation of concerns.
export function CoreOperationalModules({
  departments,
  clearance = { state: 'clear', details: [] },
}: CoreOperationalModulesProps) {
  // Custom hooks for business logic
  const { pinnedNames, handlePinnedChange } = usePinnedDepartments({ departments });
  const {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    filteredDepartments,
    pinnedCount,
    activeCount,
    criticalCount,
  } = useDepartmentFilter({ departments, pinnedNames });

  // Route clearance notices to the Top Taskbar Bell Notification Center
  useClearanceNotification(clearance);

  const handleFilterSelect = (filter: typeof activeFilter) => {
    setActiveFilter(filter);
    if (typeof window === 'undefined') return;
    if (filter === 'all') {
      dispatchActiveModuleChange({ name: 'overview', title: 'Central Hub' });
      return;
    }
    const matching = departments.find((d) => {
      if (filter === 'pinned') return pinnedNames.has(d.name);
      if (filter === 'active') return d.status === 'active';
      if (filter === 'critical') return d.status === 'alert' || d.status === 'maintenance';
      return false;
    });
    if (matching) {
      dispatchActiveModuleChange({ name: matching.name, title: matching.displayName });
    }
  };

  // Keyboard shortcut: Press '/' or 'Cmd+K' to focus module search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
        e.preventDefault();
        const input = document.getElementById('hub-module-search') as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <section className="group/row relative isolate space-y-5">
      {/* Ambient live surface: reuses the panel-card drift animations behind the grid */}
      <div
        aria-hidden="true"
        data-testid="core-modules-live-background"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[28px]"
      >
        <span className="absolute top-8 -left-16 h-56 w-56 rounded-full bg-accent-gold/[0.055] blur-3xl motion-safe:animate-[float-slow_18s_ease-in-out_infinite]" />
        <span className="absolute -right-20 bottom-4 h-64 w-64 rounded-full bg-[var(--accent-blue)]/[0.05] blur-3xl motion-safe:animate-[float-delayed_22s_ease-in-out_infinite]" />
        <span className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(15,23,42,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.5)_1px,transparent_1px)] [background-size:36px_36px] motion-safe:animate-[grid-drift_28s_linear_infinite]" />
      </div>

      {/* Section Hero Banner: module identity + source controls */}
      <div
        className={cn(
          'gold-steel-border gold-steel-border-slim relative overflow-hidden rounded-[22px]',
          'border border-white/40 bg-white/60 p-5 shadow-window backdrop-blur-xl sm:p-6'
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-accent-gold/70 to-transparent"
        />

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Identity block */}
          <div className="flex items-center gap-3.5">
            <ArchLogoBadge size="lg" className="chip-elevated-3d shining rounded-2xl" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  aria-label="Mining Department Modules"
                  className="heading-crisp-ink font-anurati font-extrabold text-base text-slate-950 tracking-[0.06em] sm:text-lg"
                >
                  {['Mining', 'Department', 'Modules'].map((word, wordIdx) => (
                    <Fragment key={word}>
                      {wordIdx > 0 && ' '}
                      <span className={HEADING_INITIAL_CLASS}>{word[0]}</span>
                      {word.slice(1)}
                    </Fragment>
                  ))}
                </h2>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.14em]">
                Live operational surface
              </p>
            </div>
          </div>
        </div>

        {/* Identity separator: divides the module identity header from source controls */}
        <ArchSeparator variant="gold" testId="core-modules-identity-separator" className="mt-4" />

        {/* Search & Category Filter Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {/* Quick Search Input (isolated leaf to prevent 28ms typewriter state from re-rendering 13 cards) */}
          <ModuleSearchInput searchQuery={searchQuery} onSearchChange={setSearchQuery} />

          {/* Filter Pills */}
          <div className={FILTER_GROUP_CLASS} role="group" aria-label="Filter modules by category">
            <button
              type="button"
              aria-pressed={activeFilter === 'all'}
              onClick={() => handleFilterSelect('all')}
              className={cn(
                FILTER_TAB_BASE_CLASS,
                activeFilter === 'all'
                  ? 'border border-slate-700/85 bg-white font-semibold text-arch-text-primary'
                  : FILTER_TAB_INACTIVE_CLASS
              )}
            >
              All
            </button>
            {pinnedCount > 0 && (
              <button
                type="button"
                aria-pressed={activeFilter === 'pinned'}
                onClick={() => handleFilterSelect('pinned')}
                className={cn(
                  FILTER_TAB_BASE_CLASS,
                  'chip-shine-delay-1',
                  activeFilter === 'pinned'
                    ? 'border border-arch-accent-blue/75 bg-white font-semibold text-arch-accent-blue'
                    : FILTER_TAB_INACTIVE_CLASS
                )}
              >
                <Star className="h-3.5 w-3.5 fill-arch-accent-blue/20" />
                Pinned ({pinnedCount})
              </button>
            )}
            <button
              type="button"
              aria-pressed={activeFilter === 'active'}
              onClick={() => handleFilterSelect('active')}
              className={cn(
                FILTER_TAB_BASE_CLASS,
                'chip-shine-delay-1',
                activeFilter === 'active'
                  ? 'border border-emerald-800/85 bg-white font-semibold text-accent-green ring-1 ring-emerald-900/20'
                  : FILTER_TAB_INACTIVE_CLASS
              )}
            >
              <span>Active</span>
              <span className="font-mono text-[13px] leading-[18px] opacity-95">{activeCount}</span>
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === 'critical'}
              onClick={() => handleFilterSelect('critical')}
              className={cn(
                FILTER_TAB_BASE_CLASS,
                'chip-shine-delay-2',
                activeFilter === 'critical'
                  ? 'border border-amber-800/85 bg-white font-semibold text-accent-amber ring-1 ring-amber-900/20'
                  : FILTER_TAB_INACTIVE_CLASS
              )}
            >
              {criticalCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-accent-amber" aria-hidden="true" />
              )}
              <span>Alerts</span>
              {criticalCount > 0 && (
                <span className="font-mono font-semibold text-[13px] text-accent-amber leading-[18px]">
                  {criticalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* System Default Golden Separator — divides header bar from module panels below */}
      <ArchSeparator
        variant="gold-emblem"
        glow
        testId="core-modules-header-separator"
        className="py-0.5"
      />

      {/* Grid Display */}
      {filteredDepartments.length === 0 ? (
        <div className="space-y-3 rounded-card border border-arch-border-subtle bg-arch-surface-secondary/40 p-8 text-center sm:p-12">
          <p className="font-medium text-arch-text-secondary text-sm">
            No operational modules matched your search filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
            className="font-medium text-arch-accent-blue text-xs hover:underline"
          >
            Clear search and category filters
          </button>
        </div>
      ) : (
        <div
          data-testid="department-cards-grid"
          className="cv-auto-grid grid auto-rows-fr grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4"
          aria-label="Department modules"
          role="list"
        >
          {filteredDepartments.map((dept, i) => (
            <div key={dept.name} role="listitem">
              <DepartmentCard
                department={dept}
                index={i}
                isPinned={pinnedNames.has(dept.name)}
                onPinnedChange={handlePinnedChange}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
