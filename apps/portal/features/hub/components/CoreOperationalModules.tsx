'use client';

import type { Department } from '@repo/departments/data-access';
import { DepartmentCard } from '@repo/hub/ui';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, Search, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useClearanceNotification } from '@/hooks/useClearanceNotification';
import { useDepartmentFilter } from '@/hooks/useDepartmentFilter';
import { usePinnedDepartments } from '@/hooks/usePinnedDepartments';
import { useTypewriterPlaceholder } from '@/hooks/useTypewriterPlaceholder';
import { dispatchActiveModuleChange } from '@/lib/event-manager';
import type { EmployeeClearance } from '@/lib/hub-departments';

const EXECUTIVE_LINK_CLASS = cn(
  'gold-steel-border gold-steel-border-slim group/exec inline-flex min-h-11 items-center gap-2',
  'rounded-full border border-slate-300 bg-white px-3.5 py-1.5',
  'font-bold text-[13px] text-slate-950 leading-[18px] shadow-sm transition-all duration-150',
  'hover:-translate-y-px hover:border-arch-accent-blue hover:bg-white hover:text-arch-accent-blue active:scale-[0.985]'
);

interface CoreOperationalModulesProps {
  departments: Department[];
  clearance?: EmployeeClearance;
  canSeeExecutive?: boolean;
}

interface ModuleSearchInputProps {
  readonly searchQuery: string;
  readonly onSearchChange: (nextQuery: string) => void;
}

const FILTER_TAB_INACTIVE_CLASS =
  'border border-black/[0.06] font-medium text-arch-text-secondary hover:border-black/[0.14] hover:bg-white/60 hover:text-arch-text-primary';

interface StatChipProps {
  label: string;
  count: number;
  color: 'accent-green' | 'accent-amber' | 'accent-red';
  icon: React.ReactNode;
}

function StatChip({ label, count, color, icon }: StatChipProps) {
  const colorMap: Record<StatChipProps['color'], { bg: string; text: string; ring: string }> = {
    'accent-green': {
      bg: 'bg-emerald-950 border-emerald-700',
      text: 'text-white',
      ring: 'ring-emerald-600/45',
    },
    'accent-amber': {
      bg: 'bg-amber-950 border-amber-600',
      text: 'text-amber-50',
      ring: 'ring-amber-500/45',
    },
    'accent-red': {
      bg: 'bg-rose-950 border-rose-700',
      text: 'text-white',
      ring: 'ring-rose-600/45',
    },
  };
  const chipTheme = colorMap[color];
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-sm',
        chipTheme.bg,
        chipTheme.text,
        `ring-1 ${chipTheme.ring}`
      )}
    >
      {icon}
      <span className="font-bold font-mono text-[13px] tabular-nums leading-[18px]">{count}</span>
      <span className="font-bold text-[13px] leading-[18px]">{label}</span>
    </div>
  );
}

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
    <section className="group/row relative space-y-5">
      {/* Section Hero Banner: identity + live metrics + executive access */}
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
            <span className="gold-steel-border gold-steel-border-slim flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-arch-accent-blue/30 bg-white shadow-sm">
              <Logo className="h-6 w-6 scale-110 text-arch-accent-blue drop-shadow-xs" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-anurati font-bold text-[var(--text-heading)] text-base tracking-[0.06em] sm:text-lg">
                  Mining Department Modules
                </h2>
                <span
                  data-testid="core-modules-count-badge"
                  className="gold-steel-border gold-steel-border-slim rounded-full border border-accent-gold/45 bg-arch-surface-secondary px-2.5 py-0.5 font-mono text-[13px] text-arch-text-secondary tabular-nums leading-[18px]"
                >
                  {filteredDepartments.length} / {departments.length}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.14em]">
                Live operational surface
              </p>
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap items-center gap-2">
            <StatChip
              label="Active"
              count={activeCount}
              color="accent-green"
              icon={<Activity className="h-3.5 w-3.5 text-emerald-300" />}
            />
            <StatChip
              label="Pinned"
              count={pinnedCount}
              color="accent-amber"
              icon={<Star className="h-3.5 w-3.5 text-amber-300" />}
            />
            <StatChip
              label="Alerts"
              count={criticalCount}
              color="accent-red"
              icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
            />

            {canSeeExecutive && (
              <Link href="/hub/executive" className={EXECUTIVE_LINK_CLASS}>
                <span className="flex items-center justify-center rounded-full bg-arch-accent-blue/10 p-1 text-arch-accent-blue">
                  <BarChart3 className="h-3.5 w-3.5" />
                </span>
                <span>Executive Dashboard</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-arch-accent-blue transition-transform duration-200 group-hover/exec:translate-x-0.5 group-hover/exec:-translate-y-0.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {/* Quick Search Input (isolated leaf to prevent 28ms typewriter state from re-rendering 13 cards) */}
          <ModuleSearchInput searchQuery={searchQuery} onSearchChange={setSearchQuery} />

          {/* Filter Pills */}
          <div
            className="gold-steel-border gold-steel-border-slim flex min-h-11 items-center gap-1 rounded-full border border-arch-border-subtle bg-arch-surface-secondary/85 p-1 font-medium text-[13px] shadow-xs"
            role="group"
            aria-label="Filter modules by category"
          >
            <button
              type="button"
              aria-pressed={activeFilter === 'all'}
              onClick={() => handleFilterSelect('all')}
              className={cn(
                'min-h-9 rounded-full px-3 py-1.5 text-[13px] tabular-nums leading-[18px] transition-all',
                activeFilter === 'all'
                  ? 'border border-black/[0.14] bg-white font-semibold text-arch-text-primary shadow-card'
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
                  'flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] tabular-nums leading-[18px] transition-all',
                  activeFilter === 'pinned'
                    ? 'border border-arch-accent-blue/35 bg-white font-semibold text-arch-accent-blue shadow-card'
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
                'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] tabular-nums leading-[18px] transition-all',
                activeFilter === 'active'
                  ? 'border border-accent-green/35 bg-white font-semibold text-accent-green shadow-card'
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
                'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] tabular-nums leading-[18px] transition-all',
                activeFilter === 'critical'
                  ? 'border border-accent-amber/40 bg-white font-semibold text-accent-amber shadow-card'
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
      <div
        data-testid="core-modules-header-separator"
        aria-hidden="true"
        className="flex w-full items-center justify-center gap-2.5 py-0.5"
      >
        <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-r from-transparent via-accent-gold/55 to-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.45)]" />
        <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] border border-accent-gold/80 bg-accent-gold/35 shadow-[0_0_6px_rgba(212,175,55,0.55)]" />
        <span className="gold-steel-border gold-steel-border-slim flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent-gold/55 bg-white/95 text-accent-gold shadow-xs">
          <Logo variant="gold" className="h-3 w-3 text-accent-gold" />
        </span>
        <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] border border-accent-gold/80 bg-accent-gold/35 shadow-[0_0_6px_rgba(212,175,55,0.55)]" />
        <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-l from-transparent via-accent-gold/55 to-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.45)]" />
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
