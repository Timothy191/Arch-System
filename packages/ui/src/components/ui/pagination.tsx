import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@repo/ui/lib/utils";

export interface PaginationProps {
  className?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (_page: number) => void;
  pageSize: number;
  onPageSizeChange?: (_size: number) => void;
  pageSizeOptions?: number[];
  totalCount?: number;
}

export function Pagination({
  className,
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
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
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white/40 backdrop-blur-md border border-black/[0.08] rounded-xl",
        className,
      )}
    >
      {/* Total count status */}
      <div className="text-sm text-[var(--text-muted)] font-medium">
        {totalCount !== undefined ? (
          <>
            Showing{" "}
            <span className="font-semibold text-[var(--text-heading)]">
              {startRange}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-[var(--text-heading)]">
              {endRange}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-[var(--text-heading)]">
              {totalCount}
            </span>{" "}
            entries
          </>
        ) : (
          <>
            Page{" "}
            <span className="font-semibold text-[var(--text-heading)]">
              {currentPage}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-[var(--text-heading)]">
              {totalPages}
            </span>
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
              className="text-xs text-[var(--text-muted)] font-medium whitespace-nowrap"
            >
              Show
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white/50 border border-black/[0.08] text-[var(--text-heading)] rounded-lg text-xs font-semibold py-1 px-2.5 outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)] transition-all"
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
            className="w-8 h-8 rounded-lg bg-white/50 border-black/[0.08] text-[var(--text-heading)] hover:bg-black/[0.02]"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8 rounded-lg bg-white/50 border-black/[0.08] text-[var(--text-heading)] hover:bg-black/[0.02]"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {getPageNumbers().map((page, index) => {
            if (page === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="w-8 text-center text-sm text-[var(--text-muted)] font-medium select-none"
                >
                  ...
                </span>
              );
            }

            const isCurrent = page === currentPage;
            return (
              <Button
                key={`page-${page}`}
                variant={isCurrent ? "default" : "outline"}
                onClick={() => onPageChange(page as number)}
                className={cn(
                  "w-8 h-8 rounded-lg font-semibold text-sm",
                  isCurrent
                    ? "bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
                    : "bg-white/50 border-black/[0.08] text-[var(--text-heading)] hover:bg-black/[0.02]",
                )}
              >
                {page}
              </Button>
            );
          })}

          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8 rounded-lg bg-white/50 border-black/[0.08] text-[var(--text-heading)] hover:bg-black/[0.02]"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8 rounded-lg bg-white/50 border-black/[0.08] text-[var(--text-heading)] hover:bg-black/[0.02]"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            aria-label="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
