'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { FilterToolbar } from './filter-toolbar';
import { Pagination } from './pagination';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string | React.ReactNode;
  cell?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  width?: string | number;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor: (item: T, index: number) => string | number;
  loading?: boolean;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  emptyState?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = 'Search table records...',
  searchFilter,
  emptyState,
  actions,
  className,
  onRowClick,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  // Filter Data
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();

    if (searchFilter) {
      return data.filter((item) => searchFilter(item, query));
    }

    // Default search across all primitive properties
    return data.filter((item) =>
      Object.values(item as Record<string, unknown>).some((val) =>
        String(val).toLowerCase().includes(query)
      )
    );
  }, [data, searchQuery, searchFilter]);

  // Sort Data
  const sortedData = React.useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comp = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Paginate Data
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <div className={cn('space-y-3.5', className)}>
      {/* Search and Action Toolbar */}
      {(searchable || actions) && (
        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={searchable ? setSearchQuery : undefined}
          searchPlaceholder={searchPlaceholder}
          hasActiveFilters={Boolean(searchQuery)}
          onClearFilters={() => setSearchQuery('')}
          actions={actions}
        />
      )}

      {/* Main Glass Table Container */}
      <div className="gold-steel-border gold-steel-border-slim overflow-hidden rounded-xl border border-black/[0.08] bg-white/70 shadow-2xs backdrop-blur-md">
        <div className="overflow-x-auto">
          <Table className="w-full text-xs">
            <TableHeader className="border-black/[0.06] border-b bg-black/[0.02]">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => {
                  const keyStr = String(col.key);
                  const isSorted = sortKey === keyStr;

                  return (
                    <TableHead
                      key={keyStr}
                      style={{ width: col.width }}
                      className={cn(
                        'h-9 px-4 font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                        col.className
                      )}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(keyStr)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded transition-colors hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-arch-accent-blue',
                            col.align === 'right' && 'ml-auto'
                          )}
                        >
                          <span>{col.header}</span>
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-[var(--accent-blue)]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[var(--accent-blue)]" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, rIdx) => (
                  <TableRow key={`skeleton-row-${rIdx}`} className="border-black/[0.04] border-b">
                    {columns.map((col, cIdx) => (
                      <TableCell key={`skeleton-col-${cIdx}`} className="p-3 px-4">
                        <Skeleton className="h-4 w-full max-w-[120px] rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-[var(--text-secondary)] text-xs"
                  >
                    {emptyState ?? 'No matching records found.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, index) => (
                  <TableRow
                    key={String(keyExtractor(item, index))}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      'border-black/[0.04] border-b transition-colors hover:bg-black/[0.015]',
                      onRowClick && 'cursor-pointer'
                    )}
                  >
                    {columns.map((col) => {
                      const cellContent = col.cell
                        ? col.cell(item, index)
                        : String((item as Record<string, unknown>)[col.key as string] ?? '');

                      return (
                        <TableCell
                          key={String(col.key)}
                          className={cn(
                            'p-3 px-4 text-[var(--text-heading)]',
                            col.align === 'center' && 'text-center',
                            col.align === 'right' && 'text-right',
                            col.className
                          )}
                        >
                          {cellContent}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination & Count footer */}
        {!loading && sortedData.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-black/[0.06] border-t bg-black/[0.01] px-4 py-3 text-[var(--text-secondary)] text-xs sm:flex-row">
            <span>
              Showing{' '}
              <strong className="font-mono font-semibold text-[var(--text-heading)]">
                {(currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="font-mono font-semibold text-[var(--text-heading)]">
                {Math.min(currentPage * pageSize, sortedData.length)}
              </strong>{' '}
              of{' '}
              <strong className="font-mono font-semibold text-[var(--text-heading)]">
                {sortedData.length}
              </strong>{' '}
              records
            </span>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalCount={sortedData.length}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
