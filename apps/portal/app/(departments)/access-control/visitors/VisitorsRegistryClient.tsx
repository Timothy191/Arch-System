'use client';

import { Avatar, Badge } from '@repo/ui';
import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/ui/alert';
import { Button } from '@repo/ui/components/ui/button';
import { Pagination } from '@repo/ui/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { EmptyState } from '@repo/ui/EmptyState';
import { GlassCard } from '@repo/ui/GlassCard';
import { Clock, Inbox, LogOut, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type AutoExitedVisitorRecord,
  autoExitOverdueVisitors,
  manualCheckOutVisitor,
} from './actions';
import {
  AUTO_EXITED_VISITOR_STATUS,
  formatRemainingOrElapsed,
  isVisitorOverdueForAutoExit,
  MANUAL_CHECKED_OUT_STATUS,
} from './visitor-auto-exit';
import { VisitorForm } from './visitor-form';

const AUTO_EXIT_TIMER_INTERVAL_MS = 60_000;

export interface VisitorRegistryRow {
  readonly id: string;
  readonly first_name: string | null;
  readonly surname: string | null;
  readonly id_number?: string | null;
  readonly company: string | null;
  readonly visiting?: string | null;
  readonly reason_for_entry: string | null;
  readonly check_in_time: string | null;
  readonly check_out_time: string | null;
  readonly status: string | null;
}

export interface VisitorsRegistryClientProps {
  readonly visitors: readonly VisitorRegistryRow[];
  readonly initialAutoExited: readonly AutoExitedVisitorRecord[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly pageSize: number;
  readonly deptId: string;
}

function formatTime24h(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '—';
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatAutoExitToastDescription(records: readonly AutoExitedVisitorRecord[]): string {
  const names = records.map((record) => record.name).join(', ');
  return `${records.length} visitor(s) exceeded the 12-hour limit and were auto-exited: ${names}`;
}

function mergeAutoExitedRecords(
  existing: readonly AutoExitedVisitorRecord[],
  incoming: readonly AutoExitedVisitorRecord[]
): AutoExitedVisitorRecord[] {
  const seenIds = new Set(existing.map((record) => record.id));
  const merged = [...existing];
  for (const record of incoming) {
    if (!seenIds.has(record.id)) {
      seenIds.add(record.id);
      merged.push(record);
    }
  }
  return merged;
}

function renderStatusBadge(status: string | null) {
  if (status === 'Checked In') {
    return (
      <Badge variant="green" contrast="low" size="sm">
        Checked In
      </Badge>
    );
  }
  if (status === AUTO_EXITED_VISITOR_STATUS) {
    return (
      <Badge variant="amber" contrast="low" size="sm">
        {AUTO_EXITED_VISITOR_STATUS}
      </Badge>
    );
  }
  return (
    <Badge variant="gray" contrast="low" size="sm">
      {status || 'Pre-Registered'}
    </Badge>
  );
}

export function VisitorsRegistryClient({
  visitors,
  initialAutoExited,
  page,
  totalPages,
  totalCount,
  pageSize,
  deptId,
}: VisitorsRegistryClientProps) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [autoExitedNotices, setAutoExitedNotices] =
    useState<readonly AutoExitedVisitorRecord[]>(initialAutoExited);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [isCheckingOut, startCheckOutTransition] = useTransition();

  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const isAutoExitPollingRef = useRef(false);
  const visitorsRef = useRef(visitors);
  visitorsRef.current = visitors;

  useEffect(() => {
    if (initialAutoExited.length === 0) return;

    setAutoExitedNotices((prev) => mergeAutoExitedRecords(prev, initialAutoExited));

    const freshRecords = initialAutoExited.filter(
      (record) => !notifiedIdsRef.current.has(record.id)
    );
    if (freshRecords.length === 0) return;

    for (const record of freshRecords) {
      notifiedIdsRef.current.add(record.id);
    }

    toast.warning('12-Hour Auto-Exit Triggered', {
      description: formatAutoExitToastDescription(freshRecords),
    });
  }, [initialAutoExited]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentNowMs = Date.now();
      setNowMs(currentNowMs);

      const hasOverdueVisitor = visitorsRef.current.some((visitor) =>
        isVisitorOverdueForAutoExit(visitor, currentNowMs)
      );
      if (!hasOverdueVisitor || isAutoExitPollingRef.current) return;

      isAutoExitPollingRef.current = true;
      void autoExitOverdueVisitors(deptId)
        .then((result) => {
          if (result.autoExited.length === 0) return;

          setAutoExitedNotices((prev) => mergeAutoExitedRecords(prev, result.autoExited));

          const freshRecords = result.autoExited.filter(
            (record) => !notifiedIdsRef.current.has(record.id)
          );
          for (const record of freshRecords) {
            notifiedIdsRef.current.add(record.id);
          }

          if (freshRecords.length > 0) {
            toast.warning('12-Hour Auto-Exit Triggered', {
              description: formatAutoExitToastDescription(freshRecords),
            });
          }
          router.refresh();
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Auto-exit check failed';
          toast.error('Auto-exit check failed', { description: message });
        })
        .finally(() => {
          isAutoExitPollingRef.current = false;
        });
    }, AUTO_EXIT_TIMER_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [deptId, router]);

  function handleManualCheckOut(visitor: VisitorRegistryRow) {
    const fullName = `${visitor.first_name ?? ''} ${visitor.surname ?? ''}`.trim() || 'Visitor';
    setCheckingOutId(visitor.id);
    startCheckOutTransition(async () => {
      try {
        await manualCheckOutVisitor(visitor.id);
        toast.success(`${fullName} ${MANUAL_CHECKED_OUT_STATUS.toLowerCase()}`, {
          description: 'Visitor status updated and temporary badge deactivated.',
        });
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check out visitor';
        toast.error('Check-out failed', { description: message });
      } finally {
        setCheckingOutId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {autoExitedNotices.length > 0 && (
        <Alert variant="warning" className="pr-10">
          <AlertTitle>
            12-Hour Limit Reached — {autoExitedNotices.length} Visitor(s) Auto-Exited
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-1.5">
            <p>
              The following visitors exceeded the 12-hour on-site limit and were automatically
              checked out with temporary badges deactivated:
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              {autoExitedNotices.map((notice) => (
                <li key={notice.id}>
                  <span className="font-medium text-[var(--text-heading)]">{notice.name}</span>
                  {notice.company ? ` (${notice.company})` : ''} — Checked in at{' '}
                  <span className="font-mono">{formatTime24h(notice.checkInTime)}</span>,
                  auto-exited at <span className="font-mono">{formatTime24h(notice.exitedAt)}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
          <button
            type="button"
            aria-label="Dismiss auto-exit notification"
            onClick={() => setAutoExitedNotices([])}
            className="absolute top-3 right-3 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-black/[0.06] hover:text-[var(--text-heading)]"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Registration Form (Left, 1 col) */}
        <div className="space-y-4 lg:col-span-1">
          <VisitorForm />
        </div>

        {/* Active Visitors Table (Right, 2 cols) */}
        <div className="lg:col-span-2">
          <GlassCard className="flex h-full flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
              <h3 className="flex items-center font-semibold text-[var(--text-heading)]">
                <Clock className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
                Today&apos;s Visitors
              </h3>
              <span className="text-[var(--text-muted)] text-xs">{totalCount} total visitors</span>
            </div>

            <div className="flex-1">
              {visitors.length === 0 ? (
                <div className="flex h-full items-center justify-center py-20">
                  <EmptyState
                    icon={Inbox}
                    title="No visitors registered"
                    description="There are no visitors recorded for this department today. Use the form to register a new guest."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border-default)] border-b hover:bg-transparent">
                      <TableHead className="text-[var(--text-muted)]">Visitor Name</TableHead>
                      <TableHead className="text-[var(--text-muted)]">Company</TableHead>
                      <TableHead className="text-[var(--text-muted)]">Reason</TableHead>
                      <TableHead className="text-[var(--text-muted)]">
                        Check-In &amp; 12h Limit
                      </TableHead>
                      <TableHead className="text-[var(--text-muted)]">Status</TableHead>
                      <TableHead className="text-right text-[var(--text-muted)]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitors.map((visitor) => {
                      const isCheckedIn = visitor.status === 'Checked In';
                      const durationStatus = isCheckedIn
                        ? formatRemainingOrElapsed(visitor.check_in_time, nowMs)
                        : null;
                      const isRowPending = isCheckingOut && checkingOutId === visitor.id;

                      return (
                        <TableRow
                          key={visitor.id}
                          className="border-[var(--border-default)]/50 border-b transition-colors hover:bg-[var(--bg-tertiary)]"
                        >
                          <TableCell className="font-medium text-[var(--text-heading)]">
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                size={24}
                                letter={`${visitor.first_name?.[0] ?? ''}${visitor.surname?.[0] ?? ''}`}
                                title={`${visitor.first_name ?? ''} ${visitor.surname ?? ''}`}
                              />
                              <span>
                                {visitor.first_name} {visitor.surname}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[var(--text-secondary)]">
                            {visitor.company || '—'}
                          </TableCell>
                          <TableCell className="text-[var(--text-secondary)]">
                            {visitor.reason_for_entry || '—'}
                          </TableCell>
                          <TableCell className="font-mono text-[var(--text-secondary)] text-sm">
                            <div className="flex flex-col">
                              <span>{formatTime24h(visitor.check_in_time)}</span>
                              {durationStatus && (
                                <span
                                  className={
                                    durationStatus.isOverdue
                                      ? 'font-sans text-[var(--accent-red)] text-xs'
                                      : 'font-sans text-[var(--text-muted)] text-xs'
                                  }
                                >
                                  {durationStatus.summaryLabel}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{renderStatusBadge(visitor.status)}</TableCell>
                          <TableCell className="text-right">
                            {isCheckedIn ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isRowPending}
                                onClick={() => handleManualCheckOut(visitor)}
                                className="h-7 border-[var(--border-default)] px-2.5 text-xs"
                              >
                                <LogOut className="mr-1.5 h-3 w-3" />
                                {isRowPending ? 'Checking Out...' : 'Check Out'}
                              </Button>
                            ) : (
                              <span className="font-mono text-[var(--text-muted)] text-xs">
                                {visitor.check_out_time
                                  ? `Out ${formatTime24h(visitor.check_out_time)}`
                                  : '—'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="border-[var(--border-default)] border-t p-4">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
