'use client';

import type { Department } from '@repo/departments/data-access';
import { DepartmentCard } from '@repo/hub/ui';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { ArrowUpRight, BarChart3, Search, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useClearanceNotification } from '@/hooks/useClearanceNotification';
import { useDepartmentFilter } from '@/hooks/useDepartmentFilter';
import { usePinnedDepartments } from '@/hooks/usePinnedDepartments';
import { useTypewriterPlaceholder } from '@/hooks/useTypewriterPlaceholder';
import { dispatchActiveModuleChange } from '@/lib/event-manager';
import type { EmployeeClearance } from '@/lib/hub-departments';

interface CoreOperationalModulesProps {
  departments: Department[];
  clearance?: EmployeeClearance;
  canSeeExecutive?: boolean;
}

interface ModuleSearchInputProps {
  readonly searchQuery: string;
  readonly onSearchChange: (nextQuery: string) => void;
}

function ModuleSearchInput({ searchQuery, onSearchChange }: ModuleSearchInputProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchPlaceholder = useTypewriterPlaceholder(
    'Search modules... (/)',
    isSearchFocused || searchQuery.length > 0
  );

  return (
    <div className="gold-steel-border gold-steel-border-slim relative min-w-[200px] flex-1 rounded-full sm:w-64 sm:min-w-[240px]">
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-3.5 w-3.5 -translate-y-1/2 text-arch-text-tertiary" />
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
        className="gold-steel-border gold-steel-border-slim h-8 w-full rounded-full border border-arch-border-subtle bg-white/85 pr-9 pl-9 text-arch-text-primary text-xs shadow-xs transition-all placeholder:text-arch-text-tertiary focus:border-accent-amber focus:border-arch-accent-amber/50 focus:outline-none"
      />
      <span id="hub-module-search-hint" className="sr-only">
        Press slash or Command K to focus the module search
      </span>
      {searchQuery ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onSearchChange('')}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-arch-text-tertiary text-xs hover:text-arch-text-primary"
        >
          ✕
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full border border-arch-border-subtle bg-arch-surface-tertiary px-1.5 py-0.5 font-mono text-[10px] text-arch-text-tertiary">
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
  canSeeExecutive = false,
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
    <section
      className="group/row liquid-glass-light gold-steel-border relative -translate-y-1.5 animate-fade-up space-y-5 rounded-card border border-white/30 bg-white/[0.08] p-4 shadow-[0_32px_64px_-12px_rgba(15,23,42,0.22),0_16px_32px_-8px_rgba(15,23,42,0.12),0_4px_12px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_1px_rgba(255,255,255,0.7),inset_0_-1px_1px_rgba(15,23,42,0.04)] ring-1 ring-white/40 ring-inset backdrop-blur-md transition-[transform,box-shadow] duration-500 ease-mac-decelerate hover:-translate-y-2.5 hover:shadow-[0_40px_80px_-12px_rgba(15,23,42,0.28),0_20px_40px_-8px_rgba(15,23,42,0.16),inset_0_1.5px_1px_rgba(255,255,255,0.85)] sm:p-6"
      style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
    >
      {/* Section Header with Live Filtering & Executive Quick-Access */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-start">
          <h2 className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-2.5 rounded-full border border-arch-border-subtle bg-white/85 py-1 pr-3 pl-1 font-semibold text-arch-text-primary text-sm tracking-tight shadow-xs ring-1 ring-white/80 ring-inset backdrop-blur-md transition-all duration-300 group-hover/row:border-arch-accent-blue/40 group-hover/row:text-arch-accent-blue sm:text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-arch-accent-blue/35 bg-white text-arch-accent-blue shadow-sm">
              <Logo className="h-5 w-5 scale-110 text-arch-accent-blue drop-shadow-xs" />
            </span>
            <span className="font-anurati font-bold tracking-[0.06em]">
              Mining Department Modules
            </span>
            <span
              data-testid="core-modules-count-badge"
              className="gold-steel-border gold-steel-border-slim ml-0.5 rounded-full border border-accent-amber/45 bg-arch-surface-secondary px-2.5 py-0.5 font-mono text-[11px] text-arch-text-secondary tabular-nums"
            >
              {filteredDepartments.length} / {departments.length}
            </span>
          </h2>

          {canSeeExecutive && (
            <Link
              href="/hub/executive"
              className="gold-steel-border gold-steel-border-slim group/exec inline-flex items-center gap-1.5 rounded-full border border-arch-border-subtle bg-white/85 py-1 pr-3 pl-2 font-semibold text-arch-text-primary text-xs shadow-xs transition-all hover:border-arch-accent-blue/40 hover:bg-white hover:text-arch-accent-blue hover:shadow-card"
            >
              <span className="flex items-center justify-center rounded-full bg-arch-accent-blue/10 p-1 text-arch-accent-blue">
                <BarChart3 className="h-3 w-3" />
              </span>
              <span>Executive Dashboard</span>
              <ArrowUpRight className="h-3 w-3 text-arch-accent-blue transition-transform duration-200 group-hover/exec:translate-x-0.5 group-hover/exec:-translate-y-0.5" />
            </Link>
          )}
        </div>

        {/* Search & Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {/* Quick Search Input (isolated leaf to prevent 28ms typewriter state from re-rendering 13 cards) */}
          <ModuleSearchInput searchQuery={searchQuery} onSearchChange={setSearchQuery} />

          {/* Filter Pills */}
          <div
            className="gold-steel-border gold-steel-border-slim flex items-center gap-1 rounded-full border border-arch-border-subtle bg-arch-surface-secondary/85 p-1 font-medium text-xs shadow-xs"
            role="group"
            aria-label="Filter modules by category"
          >
            <button
              type="button"
              aria-pressed={activeFilter === 'all'}
              onClick={() => handleFilterSelect('all')}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs tabular-nums transition-all',
                activeFilter === 'all'
                  ? 'border border-black/[0.14] bg-white font-semibold text-arch-text-primary shadow-card'
                  : 'border border-black/[0.06] font-medium text-arch-text-secondary hover:border-black/[0.14] hover:bg-white/60 hover:text-arch-text-primary'
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
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs tabular-nums transition-all',
                  activeFilter === 'pinned'
                    ? 'border border-arch-accent-blue/35 bg-white font-semibold text-arch-accent-blue shadow-card'
                    : 'border border-black/[0.06] font-medium text-arch-text-secondary hover:border-black/[0.14] hover:bg-white/60 hover:text-arch-text-primary'
                )}
              >
                <Star className="h-3 w-3 fill-arch-accent-blue/20" />
                Pinned ({pinnedCount})
              </button>
            )}
            <button
              type="button"
              aria-pressed={activeFilter === 'active'}
              onClick={() => handleFilterSelect('active')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs tabular-nums transition-all',
                activeFilter === 'active'
                  ? 'border border-accent-green/35 bg-white font-semibold text-accent-green shadow-card'
                  : 'border border-black/[0.06] font-medium text-arch-text-secondary hover:border-black/[0.14] hover:bg-white/60 hover:text-arch-text-primary'
              )}
            >
              <span>Active</span>
              <span className="font-mono text-[10px] opacity-95">{activeCount}</span>
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === 'critical'}
              onClick={() => handleFilterSelect('critical')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs tabular-nums transition-all',
                activeFilter === 'critical'
                  ? 'border border-accent-amber/40 bg-white font-semibold text-accent-amber shadow-card'
                  : 'border border-black/[0.06] font-medium text-arch-text-secondary hover:border-black/[0.14] hover:bg-white/60 hover:text-arch-text-primary'
              )}
            >
              {criticalCount > 0 && (
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-amber"
                  aria-hidden="true"
                />
              )}
              <span>Alerts</span>
              {criticalCount > 0 && (
                <span className="font-mono font-semibold text-[10px] text-accent-amber">
                  {criticalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* System Default Golden Separator — divides header bar from module panels below */}
      <div
        data-testid="core-modules-header-separator"
        aria-hidden="true"
        className="flex w-full items-center justify-center gap-2.5 py-0.5"
      >
        <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-r from-transparent via-[#c59b27]/75 to-[#f3d37a] shadow-[0_0_8px_rgba(212,175,55,0.45)]" />
        <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] border border-[#b08318]/65 bg-gradient-to-br from-[#fff6d6] via-[#e6be5a] to-[#9e7312] shadow-[0_0_6px_rgba(212,175,55,0.55)]" />
        <span className="gold-steel-border gold-steel-border-slim flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#c59b27]/70 bg-gradient-to-b from-[#fffdf7] via-[#f7e7b4] to-[#d9ad42] shadow-[0_1px_5px_rgba(180,130,25,0.35),inset_0_1px_1px_rgba(255,255,255,0.95)]">
          <Logo className="h-3 w-3 text-[#7a5608] drop-shadow-[0_0.5px_0_rgba(255,255,255,0.8)]" />
        </span>
        <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] border border-[#b08318]/65 bg-gradient-to-br from-[#fff6d6] via-[#e6be5a] to-[#9e7312] shadow-[0_0_6px_rgba(212,175,55,0.55)]" />
        <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-l from-transparent via-[#c59b27]/75 to-[#f3d37a] shadow-[0_0_8px_rgba(212,175,55,0.45)]" />
      </div>

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
          className="grid auto-rows-fr grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4"
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
