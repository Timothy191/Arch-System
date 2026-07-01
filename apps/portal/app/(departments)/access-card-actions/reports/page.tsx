import { PageHeader } from "@repo/ui/PageHeader";
import { GlassCard } from "@repo/ui/GlassCard";
import { KPICard, KPIGrid } from "@repo/ui/KPI";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  FileText,
  Download,
  CreditCard,
  ShieldCheck,
  ShieldOff,
  TrendingUp,
  Printer,
  XCircle,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { getPrintJobs } from "../actions";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Status badge helpers                                               */
/* ------------------------------------------------------------------ */

function ActivityPill({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-accent-green/10 border-accent-green/20 text-accent-green">
        <CheckCircle className="w-3 h-3" />
        Completed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-red-50/70 border-red-200/50 text-red-700">
        <XCircle className="w-3 h-3" />
        Failed
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50/70 border-amber-200/50 text-amber-700">
        <Trash2 className="w-3 h-3" />
        Cancelled
      </span>
    );
  }
  if (status === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-50/70 border-blue-200/50 text-blue-700">
        <Printer className="w-3 h-3" />
        Queued
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50/70 border-gray-200/50 text-gray-700">
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function ReportsPage() {
  const { jobs } = await getPrintJobs(undefined).catch(() => ({ jobs: [] }));

  // Compute summary stats
  const totalIssued = jobs.length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const cancelled = jobs.filter((j) => j.status === "cancelled").length;
  const successRate = totalIssued > 0 ? `${Math.round((completed / totalIssued) * 100)}%` : "—";

  const activeCardCount = 0; // Will be wired to dedicated endpoint
  const revokedLostCount = 0; // Will be wired to dedicated endpoint

  // Show only terminal statuses for activity log
  const terminalJobs = jobs.filter((j) => ["completed", "failed", "cancelled"].includes(j.status));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" showDate />

      {/* ────────── Summary KPIs ────────── */}
      <KPIGrid cols={4}>
        <KPICard
          label="Total Cards Issued"
          value={totalIssued}
          color="default"
          icon={<CreditCard className="w-8 h-8" />}
        />
        <KPICard
          label="Active Cards"
          value={activeCardCount}
          color="green"
          icon={<ShieldCheck className="w-8 h-8" />}
        />
        <KPICard
          label="Revoked / Lost"
          value={revokedLostCount}
          color={revokedLostCount > 0 ? "red" : "default"}
          icon={<ShieldOff className="w-8 h-8" />}
        />
        <KPICard
          label="Print Success Rate"
          value={successRate}
          color={
            successRate !== "—"
              ? Number.parseInt(successRate) >= 80
                ? "green"
                : Number.parseInt(successRate) >= 50
                  ? "default"
                  : "red"
              : "default"
          }
          sub={
            totalIssued > 0
              ? `${completed} completed · ${failed} failed · ${cancelled} cancelled`
              : "No data"
          }
          icon={<TrendingUp className="w-8 h-8" />}
        />
      </KPIGrid>

      {/* ────────── Recent Activity ────────── */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-heading)] flex items-center">
            <FileText className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
            Print Job Activity
          </h3>
          <span className="text-xs text-[var(--text-muted)]">
            {terminalJobs.length} completed jobs
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border-default)] hover:bg-transparent">
              <TableHead className="text-[var(--text-muted)]">Employee</TableHead>
              <TableHead className="text-[var(--text-muted)]">Department</TableHead>
              <TableHead className="text-[var(--text-muted)]">Status</TableHead>
              <TableHead className="text-[var(--text-muted)]">Date</TableHead>
              <TableHead className="text-[var(--text-muted)]">Printer</TableHead>
              <TableHead className="text-right text-[var(--text-muted)]">Template</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {terminalJobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-[var(--text-muted)]">
                  No completed print job activity yet.
                </TableCell>
              </TableRow>
            )}
            {terminalJobs.map((job: any) => (
              <TableRow
                key={job.id}
                className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <TableCell className="text-[var(--text-heading)]">{job.employee_name}</TableCell>
                <TableCell className="text-[var(--text-secondary)] text-sm">
                  {job.department_name ?? "—"}
                </TableCell>
                <TableCell>
                  <ActivityPill status={job.status} />
                </TableCell>
                <TableCell className="text-[var(--text-secondary)] text-sm">
                  {new Date(job.queued_at).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="text-[var(--text-secondary)] text-sm">
                  {job.printer?.name ?? "—"}
                </TableCell>
                <TableCell className="text-right text-[var(--text-secondary)] text-sm">
                  {job.template?.name ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>

      {/* ────────── Export Hint ────────── */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-blue)]/10 flex items-center justify-center border border-[var(--accent-blue)]/20 shrink-0">
              <Download className="w-5 h-5 text-[var(--accent-blue)]" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--text-heading)]">Export Reports</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Export print job history, card issuance logs, and printer activity as CSV or JSON
                for external analysis and record-keeping.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-white/50 text-[var(--text-muted)] cursor-not-allowed">
              <Download className="w-3 h-3" />
              CSV Export
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-white/50 text-[var(--text-muted)] cursor-not-allowed">
              <Download className="w-3 h-3" />
              JSON
            </span>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3 border-t border-[var(--border-default)] pt-3">
          CSV and JSON export functionality is planned for a future release. Data shown on this page
          can be copied manually.
        </p>
      </GlassCard>
    </div>
  );
}
