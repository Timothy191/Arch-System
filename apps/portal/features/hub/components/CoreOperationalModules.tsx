'use client';

import type { Department } from '@repo/departments/data-access';
import { cn } from '@repo/ui/lib/utils';
import { ArrowUpRight, BarChart3, Boxes, Search, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { DepartmentCard } from '@/features/hub';
import { useClearanceNotification } from '@/hooks/useClearanceNotification';
import { useDepartmentFilter } from '@/hooks/useDepartmentFilter';
import { usePinnedDepartments } from '@/hooks/usePinnedDepartments';
import { dispatchActiveModuleChange } from '@/lib/event-manager';
import type { EmployeeClearance } from '@/lib/hub-departments';

interface CoreOperationalModulesProps {
  departments: Department[];
  clearance?: EmployeeClearance;
  canSeeExecutive?: boolean;
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
      className="space-y-5 animate-fade-up group/row relative rounded-card liquid-glass-light border border-white/45 ring-1 ring-inset ring-white/75 shadow-[0_32px_64px_-12px_rgba(15,23,42,0.28),0_16px_32px_-8px_rgba(15,23,42,0.16),0_4px_12px_-2px_rgba(15,23,42,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(15,23,42,0.06)] -translate-y-1.5 hover:-translate-y-2.5 hover:shadow-[0_40px_80px_-12px_rgba(15,23,42,0.34),0_20px_40px_-8px_rgba(15,23,42,0.2),inset_0_1.5px_1px_rgba(255,255,255,0.95)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] p-4 sm:p-6"
      style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
    >
      {/* Section Header with Live Filtering & Executive Quick-Access */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-black/[0.08]">
        <div className="flex items-center justify-between sm:justify-start gap-3 flex-wrap">
          <h2 className="inline-flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-full bg-white/85 backdrop-blur-md border border-arch-border-subtle ring-1 ring-inset ring-white/80 shadow-xs text-sm sm:text-base font-semibold tracking-tight text-arch-text-primary group-hover/row:text-arch-accent-blue group-hover/row:border-arch-accent-blue/40 transition-all duration-300">
            <span className="p-1.5 rounded-full bg-arch-accent-blue/10 text-arch-accent-blue border border-arch-accent-blue/20 shadow-2xs flex items-center justify-center">
              <Boxes className="w-3.5 h-3.5" />
            </span>
            <span
              className="font-anurati uppercase tracking-[0.08em]"
              style={{
                fontFamily:
                  "'Anurati', var(--font-outfit), var(--font-sans), system-ui, sans-serif",
              }}
            >
              Core Operational Modules
            </span>
            <span className="ml-0.5 px-2.5 py-0.5 rounded-full bg-arch-surface-secondary border border-arch-border-subtle text-arch-text-secondary text-[11px] font-mono tabular-nums">
              {filteredDepartments.length} / {departments.length}
            </span>
          </h2>

          {canSeeExecutive && (
            <Link
              href="/hub/executive"
              className="inline-flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full bg-white/85 hover:bg-white text-arch-text-primary hover:text-arch-accent-blue text-xs font-semibold border border-arch-border-subtle hover:border-arch-accent-blue/40 shadow-xs hover:shadow-card transition-all group/exec"
            >
              <span className="p-1 rounded-full bg-arch-accent-blue/10 text-arch-accent-blue flex items-center justify-center">
                <BarChart3 className="w-3 h-3" />
              </span>
              <span>Executive Dashboard</span>
              <ArrowUpRight className="w-3 h-3 text-arch-accent-blue transition-transform duration-200 group-hover/exec:translate-x-0.5 group-hover/exec:-translate-y-0.5" />
            </Link>
          )}
        </div>

        {/* Search & Category Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Quick Search Input */}
          <div className="relative flex-1 sm:w-64 sm:min-w-[240px] min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-arch-text-tertiary pointer-events-none" />
            <input
              id="hub-module-search"
              type="text"
              aria-label="Search operational modules"
              aria-describedby="hub-module-search-hint"
              placeholder="Search modules... (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-9 pr-9 text-xs rounded-full bg-white/85 border border-arch-border-subtle focus:border-arch-accent-blue/50 focus:outline-none focus:ring-2 focus:ring-arch-accent-blue/25 text-arch-text-primary placeholder:text-arch-text-tertiary shadow-xs transition-all"
            />
            <span id="hub-module-search-hint" className="sr-only">
              Press slash or Command K to focus the module search
            </span>
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-arch-text-tertiary hover:text-arch-text-primary"
              >
                ✕
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-arch-text-tertiary font-mono bg-arch-surface-tertiary px-1.5 py-0.5 rounded-full border border-arch-border-subtle pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Filter Pills */}
          <div
            className="flex items-center gap-1 bg-arch-surface-secondary/85 p-1 rounded-full border border-arch-border-subtle text-xs font-medium shadow-xs"
            role="group"
            aria-label="Filter modules by category"
          >
            <button
              type="button"
              aria-pressed={activeFilter === 'all'}
              onClick={() => handleFilterSelect('all')}
              className={cn(
                'px-2.5 py-1 rounded-full transition-all text-xs tabular-nums',
                activeFilter === 'all'
                  ? 'bg-white text-arch-text-primary shadow-card font-semibold'
                  : 'text-arch-text-secondary hover:text-arch-text-primary font-medium'
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
                  'px-2.5 py-1 rounded-full transition-all text-xs flex items-center gap-1 tabular-nums',
                  activeFilter === 'pinned'
                    ? 'bg-white text-arch-accent-blue shadow-card font-semibold'
                    : 'text-arch-text-secondary hover:text-arch-text-primary font-medium'
                )}
              >
                <Star className="w-3 h-3 fill-arch-accent-blue/20" />
                Pinned ({pinnedCount})
              </button>
            )}
            <button
              type="button"
              aria-pressed={activeFilter === 'active'}
              onClick={() => handleFilterSelect('active')}
              className={cn(
                'px-2.5 py-1 rounded-full transition-all text-xs inline-flex items-center gap-1.5 tabular-nums',
                activeFilter === 'active'
                  ? 'bg-white text-accent-green shadow-card font-semibold'
                  : 'text-arch-text-secondary hover:text-arch-text-primary font-medium'
              )}
            >
              <span>Active</span>
              <span className="text-[10px] font-mono opacity-95">{activeCount}</span>
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === 'critical'}
              onClick={() => handleFilterSelect('critical')}
              className={cn(
                'px-2.5 py-1 rounded-full transition-all text-xs inline-flex items-center gap-1.5 tabular-nums',
                activeFilter === 'critical'
                  ? 'bg-white text-accent-amber shadow-card font-semibold'
                  : 'text-arch-text-secondary hover:text-arch-text-primary font-medium'
              )}
            >
              {criticalCount > 0 && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse"
                  aria-hidden="true"
                />
              )}
              <span>Alerts</span>
              {criticalCount > 0 && (
                <span className="text-[10px] font-mono text-accent-amber font-semibold">
                  {criticalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grid Display */}
      {filteredDepartments.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-card bg-arch-surface-secondary/40 border border-arch-border-subtle space-y-3">
          <p className="text-sm font-medium text-arch-text-secondary">
            No operational modules matched your search filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
            className="text-xs text-arch-accent-blue hover:underline font-medium"
          >
            Clear search and category filters
          </button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5 auto-rows-fr"
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
