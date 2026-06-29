import { getDepartmentContext } from "~/lib/dept-context";
import { GlassCard } from "@repo/ui/GlassCard";
import { Pagination } from "@repo/ui/components/ui/pagination";
import { EmptyState } from "@repo/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Clock, Inbox } from "lucide-react";
import { getVisitorsForDepartment } from "../actions";
import { VisitorForm } from "./visitor-form";

export const dynamic = "force-dynamic";

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = parseInt(params.pageSize || "50", 10);

  const { deptId } = await getDepartmentContext({
    department: "access-control",
  });

  const { visitors, totalCount } = await getVisitorsForDepartment(deptId, page, pageSize);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)]">Visitor Management</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Register guests, assign temporary credentials, and track site hosts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form (Left, 1 col) */}
        <div className="lg:col-span-1 space-y-4">
          <VisitorForm />
        </div>

        {/* Active Visitors Table (Right, 2 cols) */}
        <div className="lg:col-span-2">
          <GlassCard className="p-0 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50 flex justify-between items-center">
              <h3 className="font-semibold text-[var(--text-heading)] flex items-center">
                <Clock className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                Today&apos;s Visitors
              </h3>
              <span className="text-xs text-[var(--text-muted)]">{totalCount} total visitors</span>
            </div>

            <div className="flex-1">
              {visitors.length === 0 ? (
                <div className="h-full flex items-center justify-center py-20">
                  <EmptyState
                    icon={Inbox}
                    title="No visitors registered"
                    description="There are no visitors recorded for this department today. Use the form to register a new guest."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[var(--border-default)] hover:bg-transparent">
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
                        className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <TableCell className="font-medium text-[var(--text-heading)]">
                          {visitor.first_name} {visitor.surname}
                        </TableCell>
                        <TableCell className="text-[var(--text-secondary)]">
                          {visitor.company || "—"}
                        </TableCell>
                        <TableCell className="text-[var(--text-secondary)]">
                          {visitor.reason_for_entry || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-[var(--text-secondary)]">
                          {visitor.check_in_time
                            ? new Date(visitor.check_in_time).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {visitor.status === "Checked In" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50/70 border-emerald-200/50 text-emerald-700">
                              <span className="badge-pulse-dot bg-emerald-500" />
                              Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-default)]">
                              {visitor.status || "—"}
                            </span>
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
              <div className="p-4 border-t border-[var(--border-default)]">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={(newPage) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("page", newPage.toString());
                    url.searchParams.set("pageSize", pageSize.toString());
                    window.location.href = url.toString();
                  }}
                  onPageSizeChange={(newSize) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("page", "1");
                    url.searchParams.set("pageSize", newSize.toString());
                    window.location.href = url.toString();
                  }}
                />
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
