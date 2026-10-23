import { cn } from '@repo/ui/lib/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';

export interface PaginationProps {
  className?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (_page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (_size: number) => void;
  pageSizeOptions?: number[];
  totalCount?: number;
}

export function Pagination({
  className,
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 10,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  totalCount,
}: PaginationProps) {
  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = totalCount
    ? Math.min(currentPage * pageSize, totalCount)
    : currentPage * pageSize;

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show page 1
      pages.push(1);

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-4 rounded-xl border border-black/[0.08] bg-white/40 px-4 py-3 backdrop-blur-md sm:flex-row',
        className
      )}
    >
      {/* Total count status */}
      <div className="font-medium text-[var(--text-muted)] text-sm">
        {totalCount !== undefined ? (
          <>
            Showing <span className="font-semibold text-[var(--text-heading)]">{startRange}</span>{' '}
            to <span className="font-semibold text-[var(--text-heading)]">{endRange}</span> of{' '}
            <span className="font-semibold text-[var(--text-heading)]">{totalCount}</span> entries
          </>
        ) : (
          <>
            Page <span className="font-semibold text-[var(--text-heading)]">{currentPage}</span> of{' '}
            <span className="font-semibold text-[var(--text-heading)]">{totalPages}</span>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="pageSizeSelect"
              className="whitespace-nowrap font-medium text-[var(--text-muted)] text-xs"
            >
              Show
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-black/[0.08] bg-white/50 px-2.5 py-1 font-semibold text-[var(--text-heading)] text-xs outline-none transition-all focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page navigation buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-black/[0.08] bg-white/50 text-[var(--text-heading)] hover:bg-black/[0.02]"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-black/[0.08] bg-white/50 text-[var(--text-heading)] hover:bg-black/[0.02]"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="w-8 select-none text-center font-medium text-[var(--text-muted)] text-sm"
                >
                  ...
                </span>
              );
            }

            const isCurrent = page === currentPage;
            return (
              <Button
                key={`page-${page}`}
                variant={isCurrent ? 'default' : 'outline'}
                onClick={() => onPageChange(page as number)}
                className={cn(
                  'h-8 w-8 rounded-lg font-semibold text-sm',
                  isCurrent
                    ? 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90'
                    : 'border-black/[0.08] bg-white/50 text-[var(--text-heading)] hover:bg-black/[0.02]'
                )}
              >
                {page}
              </Button>
            );
          })}

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-black/[0.08] bg-white/50 text-[var(--text-heading)] hover:bg-black/[0.02]"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-black/[0.08] bg-white/50 text-[var(--text-heading)] hover:bg-black/[0.02]"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
