'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Pagination } from '@repo/ui/Pagination';
import { ChevronDown, ChevronRight, Download, Search } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { sanitizeCsvCell } from '@/lib/api/csv-utils';
import { logError } from '@/lib/errors/error-logger';
import { sanitizePostgrestFilterValue } from '@/lib/supabase-filter';

interface AuditLog {
  id: string;
  table_name: string;
  action: string;
  user_id: string | null;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  created_at: string;
  employees?: {
    full_name: string;
  };
}

export function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [tables, setTables] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    const loadFilters = async () => {
      const { data } = await supabase.from('audit_logs').select('table_name, action');
      if (data) {
        const uniqueTables = Array.from(new Set(data.map((d) => d.table_name)));
        const uniqueActions = Array.from(new Set(data.map((d) => d.action)));
        setTables(uniqueTables.sort());
        setActions(uniqueActions.sort());
      }
    };
    void loadFilters();
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadLogs = useCallback(
    async (page: number, size: number, search: string, action: string, table: string) => {
      setLoading(true);

      let query = supabase.from('audit_logs').select('*, employees(full_name)', { count: 'exact' });

      if (action !== 'all') {
        query = query.eq('action', action);
      }
      if (table !== 'all') {
        query = query.eq('table_name', table);
      }
      if (search !== '') {
        const sanitizedSearch = sanitizePostgrestFilterValue(search);
        if (sanitizedSearch !== '') {
          query = query.or(
            `action.ilike.%${sanitizedSearch}%,table_name.ilike.%${sanitizedSearch}%`
          );
        }
      }

      query = query.order('created_at', { ascending: false });

      const from = (page - 1) * size;
      const to = from + size - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        logError(new Error(error.message), { context: 'AuditLogsTab.loadLogs' });
      } else {
        if (data) setLogs(data);
        if (count !== null) setTotalCount(count);
      }
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    void loadLogs(currentPage, pageSize, debouncedSearch, actionFilter, tableFilter);
  }, [currentPage, pageSize, debouncedSearch, actionFilter, tableFilter, loadLogs]);

  const handleExportCsv = () => {
    if (logs.length === 0) return;

    const headerRow = ['Timestamp', 'User', 'Action', 'Table', 'Old Values', 'New Values']
      .map(sanitizeCsvCell)
      .join(',');

    const dataRows = logs.map((log) =>
      [
        new Date(log.created_at).toISOString(),
        log.employees?.full_name || 'System',
        log.action,
        log.table_name,
        JSON.stringify(log.old_values ?? {}),
        JSON.stringify(log.new_values ?? {}),
      ]
        .map(sanitizeCsvCell)
        .join(',')
    );

    const csvContent = [headerRow, ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logs.length} audit log row(s) to CSV.`);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            id="actionFilter"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)]"
            aria-label="Filter by action"
          >
            <option value="all">All Actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <select
            id="tableFilter"
            value={tableFilter}
            onChange={(e) => {
              setTableFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)]"
            aria-label="Filter by table"
          >
            <option value="all">All Tables</option>
            {tables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={loading || logs.length === 0}
            onClick={handleExportCsv}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b">
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Timestamp
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  User
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Action
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Table
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Changes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    Loading...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className="cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-[var(--text-muted)] text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {new Date(log.created_at).toLocaleString('en-ZA')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[var(--text-heading)] text-sm">
                          {log.employees?.full_name || 'System'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant="outline"
                            className={
                              log.action === 'INSERT'
                                ? 'border-emerald-600/30 bg-emerald-50 text-emerald-700'
                                : log.action === 'UPDATE'
                                  ? 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue'
                                  : log.action === 'DELETE'
                                    ? 'border-accent-red/20 bg-accent-red/10 text-accent-red'
                                    : ''
                            }
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 font-mono text-[var(--text-muted)] text-sm">
                          {log.table_name}
                        </td>
                        <td className="max-w-xs truncate px-6 py-4 text-[var(--text-muted)] text-sm">
                          {JSON.stringify(log.new_values || log.old_values)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr
                          className="bg-[var(--bg-tertiary)]/50"
                          data-testid={`audit-diff-${log.id}`}
                        >
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <p className="mb-1 font-medium text-[var(--text-muted)] text-xs uppercase">
                                  Old Values
                                </p>
                                <pre className="max-h-56 overflow-auto rounded bg-[var(--bg-secondary)] p-3 font-mono text-[var(--text-muted)] text-xs">
                                  {JSON.stringify(log.old_values ?? {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-1 font-medium text-[var(--text-muted)] text-xs uppercase">
                                  New Values
                                </p>
                                <pre className="max-h-56 overflow-auto rounded bg-[var(--bg-secondary)] p-3 font-mono text-[var(--text-heading)] text-xs">
                                  {JSON.stringify(log.new_values ?? {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {!loading && totalCount > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          totalCount={totalCount}
        />
      )}
    </div>
  );
}
