import { Search, SlidersHorizontal, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Input } from './input';

export interface FilterToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  actions?: React.ReactNode;
  filterControls?: React.ReactNode;
}

export const FilterToolbar = React.forwardRef<HTMLDivElement, FilterToolbarProps>(
  (
    {
      className,
      searchQuery = '',
      onSearchChange,
      searchPlaceholder = 'Search records...',
      onClearFilters,
      hasActiveFilters = false,
      actions,
      filterControls,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label="Filter and Search Controls"
        className={cn(
          'gold-steel-border gold-steel-border-slim flex flex-col items-stretch justify-between gap-3 rounded-xl border border-black/[0.08] bg-white/70 p-3 shadow-2xs backdrop-blur-md sm:flex-row sm:items-center',
          className
        )}
        {...props}
      >
        <div className="flex flex-1 items-center gap-2.5">
          {/* Integrated Search Input */}
          {onSearchChange && (
            <div className="relative max-w-sm flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]"
                aria-hidden="true"
              />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 border-black/10 bg-white/90 pr-8 pl-9 text-xs focus-visible:ring-1"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search query"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Filter dropdowns / controls */}
          {filterControls}

          {/* Clear Filters Button */}
          {hasActiveFilters && onClearFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 gap-1 px-2.5 text-[var(--text-secondary)] text-xs hover:text-[var(--accent-red)]"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          )}

          {children}
        </div>

        {/* Action buttons (e.g. Export, Add Record) */}
        {actions && (
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">{actions}</div>
        )}
      </div>
    );
  }
);
FilterToolbar.displayName = 'FilterToolbar';
