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
          'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white/70 backdrop-blur-md rounded-xl border border-black/[0.08] shadow-2xs',
          className
        )}
        {...props}
      >
        <div className="flex flex-1 items-center gap-2.5">
          {/* Integrated Search Input */}
          {onSearchChange && (
            <div className="relative flex-1 max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none"
                aria-hidden="true"
              />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-8 h-9 text-xs bg-white/90 border-black/10 focus-visible:ring-1"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-heading)] p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
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
              className="text-xs h-9 text-[var(--text-secondary)] hover:text-[var(--accent-red)] gap-1 px-2.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
          )}

          {children}
        </div>

        {/* Action buttons (e.g. Export, Add Record) */}
        {actions && (
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">{actions}</div>
        )}
      </div>
    );
  }
);
FilterToolbar.displayName = 'FilterToolbar';
