'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Pagination } from '@repo/ui/Pagination';
import { CheckCircle2, CircleDot, Search } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { logError } from '@/lib/errors/error-logger';

interface SystemLogRow {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  source: string;
  category: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown>;
  url: string | null;
  method: string | null;
  employee_id: string | null;
  created_at: string;
  resolved: boolean;
  employees?: { full_name: string } | null;
}

interface LogsResponse {
  success: boolean;
  data?: SystemLogRow[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  error?: string;
}

const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
const SOURCES = ['client', 'server', 'api', 'cron', 'csp', 'integration', 'auth'] as const;

const LEVEL_BADGE: Record<SystemLogRow['level'], string> = {
  debug: 'border-zinc-400/20 bg-zinc-400/10 text-zinc-500',
  info: 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue',
  warn: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
  error: 'border-accent-red/20 bg-accent-red/10 text-accent-red',
  fatal: 'border-red-700/30 bg-red-700/15 text-red-700',
};

export function SystemLogsTab() {
  const [logs, setLogs] = useState<SystemLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) });
    if (levelFilter !== 'all') params.set('level', levelFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (resolvedFilter !== 'all') params.set('resolved', resolvedFilter);
    if (debouncedSearch !== '') params.set('search', debouncedSearch);

    try {
      const res = await fetch(`/api/logs?${params.toString()}`);
      const body = (await res.json()) as LogsResponse;
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setLogs(body.data ?? []);
      setTotalCount(body.pagination?.totalCount ?? 0);
      setTotalPages(body.pagination?.totalPages ?? 0);
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'SystemLogsTab.loadLogs',
      });
      setLogs([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, levelFilter, sourceFilter, resolvedFilter, debouncedSearch]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const toggleResolved = async (log: SystemLogRow) => {
    try {
      const res = await fetch('/api/logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [log.id], resolved: !log.resolved }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadLogs();
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'SystemLogsTab.toggleResolved',
        logId: log.id,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            placeholder="Search messages & categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            id="levelFilter"
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)]"
            aria-label="Filter by level"
          >
            <option value="all">All Levels</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <select
            id="sourceFilter"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)]"
            aria-label="Filter by source"
          >
            <option value="all">All Sources</option>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <select
            id="resolvedFilter"
            value={resolvedFilter}
            onChange={(e) => {
              setResolvedFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)]"
            aria-label="Filter by resolution"
          >
            <option value="all">All Entries</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
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
                  Level
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Source
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Category
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Message
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
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    Loading...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    No system logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-[var(--text-muted)] text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={LEVEL_BADGE[log.level]}>
                          {log.level}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-[var(--text-muted)] text-sm">
                        {log.source}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-heading)] text-sm">
                        {log.category}
                      </td>
                      <td className="max-w-md truncate px-6 py-4 text-[var(--text-muted)] text-sm">
                        {log.message}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                        {log.employees?.full_name ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleResolved(log);
                          }}
                        >
                          {log.resolved ? (
                            <>
                              <CircleDot className="mr-1 h-3.5 w-3.5" />
                              Reopen
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Resolve
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr className="bg-[var(--bg-tertiary)]/50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3">
                            {log.url && (
                              <div className="font-mono text-[var(--text-muted)] text-xs">
                                {log.method ? `${log.method} ` : ''}
                                {log.url}
                              </div>
                            )}
                            {log.stack && (
                              <pre className="overflow-x-auto rounded bg-[var(--bg-secondary)] p-3 text-[var(--text-muted)] text-xs">
                                {log.stack}
                              </pre>
                            )}
                            {Object.keys(log.context ?? {}).length > 0 && (
                              <pre className="overflow-x-auto rounded bg-[var(--bg-secondary)] p-3 text-[var(--text-muted)] text-xs">
                                {JSON.stringify(log.context, null, 2)}
                              </pre>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
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
