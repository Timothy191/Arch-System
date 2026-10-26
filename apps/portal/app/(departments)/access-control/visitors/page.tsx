import { Avatar, Badge } from '@repo/ui';
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
import { Clock, Inbox } from 'lucide-react';
import { getDepartmentContext } from '~/lib/dept-context';
import { getVisitorsForDepartment } from '../actions';
import { VisitorForm } from './visitor-form';

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const pageSize = parseInt(params.pageSize || '50', 10);

  const { deptId } = await getDepartmentContext({
    department: 'access-control',
  });

  const { visitors, totalCount } = await getVisitorsForDepartment(deptId, page, pageSize);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Visitor Management</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Register guests, assign temporary credentials, and track site hosts.
          </p>
        </div>
      </div>

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
                      <TableHead className="text-[var(--text-muted)]">Check-In</TableHead>
                      <TableHead className="text-right text-[var(--text-muted)]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitors.map((visitor) => (
                      <TableRow
                        key={visitor.id}
                        className="border-[var(--border-default)]/50 border-b transition-colors hover:bg-[var(--bg-tertiary)]"
                      >
                        <TableCell className="font-medium text-[var(--text-heading)]">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              size={24}
                              letter={`${visitor.first_name?.[0] ?? ''}${visitor.surname?.[0] ?? ''}`}
                              title={`${visitor.first_name} ${visitor.surname}`}
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
                          {visitor.check_in_time
                            ? new Date(visitor.check_in_time).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {visitor.status === 'Checked In' ? (
                            <Badge variant="green" contrast="low" size="sm">
                              Checked In
                            </Badge>
                          ) : (
                            <Badge variant="gray" contrast="low" size="sm">
                              {visitor.status || 'Pre-Registered'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
