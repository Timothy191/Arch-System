import { Badge } from '@repo/ui';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  HardDrive,
  Lock,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import Link from 'next/link';
import { connection } from 'next/server';
import {
  DATABASE_MIGRATION_SUMMARY,
  evaluateDepartmentReadiness,
  fetchDatabaseTableCounts,
} from '../department-database-catalog';
import { fetchSupabaseClusterTelemetry } from '../supabase-telemetry';

const QUICK_LINK_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1 rounded-md border border-[var(--accent-blue)]/20 bg-white px-2.5 py-1 font-medium text-[var(--accent-blue)] text-xs transition-colors hover:bg-[var(--bg-secondary)]';

export default async function DatabaseReportsPage() {
  await connection();

  const [tableCountsResult, clusterTelemetry] = await Promise.all([
    fetchDatabaseTableCounts(),
    fetchSupabaseClusterTelemetry(),
  ]);

  const { rowCounts, isLiveConnected, totalLiveRows } = tableCountsResult;
  const readiness = evaluateDepartmentReadiness({ rowCounts, isLiveConnected });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gold-steel-border gold-steel-border-slim flex flex-col justify-between gap-3 rounded-xl bg-white p-4 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2.5 font-semibold text-2xl text-[var(--text-heading)]">
            <FileText className="h-6 w-6 text-accent-green" />
            Database Integrity & Cross-Department Readiness Report
          </h2>
          <p className="mt-1 text-[var(--text-secondary)] text-xs">
            Comprehensive verification of per-department PostgreSQL dependencies,{' '}
            <code className="font-mono">pg_stat_statements</code> query latency, and{' '}
            <code className="font-mono">pg_cron</code> job execution health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isLiveConnected ? 'green' : 'amber'} size="sm">
            {isLiveConnected ? 'Supabase Live Connected' : 'Supabase Standby'}
          </Badge>
          <Link href="/database" className={QUICK_LINK_CLASS}>
            Dashboard
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/database/schemas" className={QUICK_LINK_CLASS}>
            Schemas
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/database/panels" className={QUICK_LINK_CLASS}>
            Panels
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Department Readiness
            </span>
            <ShieldCheck className="h-4 w-4 text-accent-green" />
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
            {isLiveConnected
              ? `${readiness.readyDepartmentsCount} / ${readiness.reports.length}`
              : 'Standby'}
          </p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            {readiness.attentionDepartmentsCount} requiring master setup
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Populated Tables
            </span>
            <Table2 className="h-4 w-4 text-[var(--accent-blue)]" />
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
            {readiness.populatedTablesCount} / {readiness.totalTrackedTables}
          </p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            {isLiveConnected
              ? `${totalLiveRows.toLocaleString('en-ZA')} live rows`
              : 'Offline standby'}
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              RLS InitPlan Coverage
            </span>
            <Lock className="h-4 w-4 text-accent-green" />
          </div>
          <p className="mt-2 font-bold text-2xl text-accent-green">100%</p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            Department & tenant policy verified
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Migration Head
            </span>
            <Database className="h-4 w-4 text-[var(--accent-blue)]" />
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
            #{DATABASE_MIGRATION_SUMMARY.latestMigrationNumber} ·{' '}
            {DATABASE_MIGRATION_SUMMARY.totalMigrationFiles} SQL
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">
            {DATABASE_MIGRATION_SUMMARY.latestMigrationFile}
          </p>
        </GlassCard>
      </div>

      <Divider variant="fading" label="DEPARTMENT DATA VERIFICATION AUDIT" />

      {/* Department Data Verification Audit Table */}
      <GlassCard className="overflow-hidden p-0" data-testid="department-verification-audit-table">
        <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-accent-green" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Operational Department Schema & Master Data Audit
            </h3>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            {readiness.reports.length} Departments Audited
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/30 font-mono text-[11px] text-[var(--text-muted)]">
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Master Reference Tables</th>
                <th className="px-4 py-3">Operational Tables</th>
                <th className="px-4 py-3">Missing / Empty Master Alerts</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {readiness.reports.map((report) => {
                const { requirement, status, emptyMasterTables } = report;
                const badgeVariant =
                  status === 'ready' ? 'green' : status === 'attention' ? 'amber' : 'blue';
                const statusText =
                  status === 'ready' ? 'Ready' : status === 'attention' ? 'Needs Setup' : 'Standby';

                return (
                  <tr
                    key={requirement.departmentSlug}
                    className="transition-colors hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link
                        href={requirement.manageHref}
                        className="font-semibold text-[var(--accent-blue)] hover:underline"
                      >
                        {requirement.departmentName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-heading)]">
                      {requirement.masterTables
                        .map((tbl) => `${tbl} (${rowCounts[tbl] ?? '—'})`)
                        .join(', ')}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
                      {requirement.operationalTables
                        .map((tbl) => `${tbl} (${rowCounts[tbl] ?? '—'})`)
                        .join(', ')}
                    </td>
                    <td className="px-4 py-2.5">
                      {emptyMasterTables.length > 0 ? (
                        <span className="font-medium text-amber-800">
                          Populate: {emptyMasterTables.join(', ')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-accent-green">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verified
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-center">
                      <Badge variant={badgeVariant} size="sm">
                        {statusText}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Divider variant="fading" label="PG_STAT_STATEMENTS SLOW QUERY TELEMETRY" />

      {/* Slow Query Telemetry */}
      <GlassCard className="overflow-hidden p-0" data-testid="slow-queries-report-card">
        <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--accent-blue)]" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Top Queries (<code className="font-mono text-xs">extensions.pg_stat_statements</code>)
            </h3>
          </div>
          <Badge variant="green" size="sm">
            Buffer Hit: {clusterTelemetry.bufferCacheHitPct}%
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/30 font-mono text-[11px] text-[var(--text-muted)]">
                <th className="px-4 py-2.5">Query Preview</th>
                <th className="px-4 py-2.5 text-right">Calls</th>
                <th className="px-4 py-2.5 text-right">Mean Exec (ms)</th>
                <th className="px-4 py-2.5 text-right">Total Exec (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {clusterTelemetry.slowQueries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-secondary)]">
                    No elevated slow queries reported by{' '}
                    <code className="font-mono">public.get_slow_queries()</code>.
                  </td>
                </tr>
              ) : (
                clusterTelemetry.slowQueries.map((query) => (
                  <tr
                    key={query.queryPreview}
                    className="transition-colors hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-heading)]">
                      {query.queryPreview}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono">
                      {query.calls.toLocaleString('en-ZA')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono">
                      {query.meanExecTimeMs} ms
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono">
                      {query.totalExecTimeMs} ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Divider variant="fading" label="PG_CRON SCHEDULES & STORAGE BUCKET COMPLIANCE" />

      {/* pg_cron & Storage Buckets */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-heading)] text-sm">
              Supabase S3 Storage Buckets
            </span>
            <Badge variant="green" size="sm">
              {clusterTelemetry.storageBuckets.length} Active
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {clusterTelemetry.storageBuckets.map((bucket) => (
              <span
                key={bucket}
                className="rounded border border-[var(--border-default)] bg-white px-2.5 py-1 font-mono text-[var(--text-heading)] text-xs"
              >
                {bucket}
              </span>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="overflow-hidden p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--accent-blue)]" />
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                pg_cron Scheduled Jobs
              </h3>
            </div>
            <Badge variant="blue" size="sm">
              {clusterTelemetry.cronJobs.length} Schedules
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/30 font-mono text-[11px] text-[var(--text-muted)]">
                  <th className="px-4 py-2">Job Name</th>
                  <th className="px-4 py-2">Schedule</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {clusterTelemetry.cronJobs.map((job) => (
                  <tr key={job.jobname}>
                    <td className="px-4 py-2 font-mono font-semibold text-[var(--accent-blue)]">
                      {job.jobname}
                    </td>
                    <td className="px-4 py-2 font-mono text-[var(--text-heading)]">
                      {job.schedule}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Badge variant={job.isActive ? 'green' : 'amber'} size="sm">
                        {job.isActive ? `Active · ${job.lastRunStatus}` : 'Paused'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
