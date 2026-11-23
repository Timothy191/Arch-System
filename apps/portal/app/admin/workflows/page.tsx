'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Settings,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { CriticalWorkflowsCanvas } from './CriticalWorkflowsCanvas';

const KPI_GRID_COLUMNS = 3;
const PERCENT_MULTIPLIER = 100;
const RATE_PRECISION_DIGITS = 1;
const FULL_RATE_PCT = 100;

type WorkflowJobHealth = 'healthy' | 'degraded' | 'idle';
type TelemetryLoadState = 'loading' | 'ready' | 'error';

interface WorkflowJobEntry {
  readonly jobId: string;
  readonly count: number;
  readonly errors: number;
  readonly lastDurationMs: number;
  readonly successRatePct: number;
  readonly status: WorkflowJobHealth;
}

interface ObservabilityWorkflowMetric {
  readonly jobId: string;
  readonly count?: number;
  readonly errors?: number;
  readonly lastDurationMs?: number;
}

interface ObservabilityWorkflowPayload {
  readonly timestamp?: string;
  readonly overallSla24hPct?: number;
  readonly workflows?:
    | readonly ObservabilityWorkflowMetric[]
    | {
        readonly jobs?: readonly ObservabilityWorkflowMetric[];
      };
  readonly uptime?:
    | {
        readonly sla24h?: number;
      }
    | ReadonlyArray<{
        readonly sla24hPct?: number;
      }>;
}

interface NoticeBannerState {
  readonly tone: 'info' | 'warning';
  readonly message: string;
}

const STATUS_BADGE_CLASSES: Readonly<Record<WorkflowJobHealth, string>> = {
  healthy: 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700',
  degraded: 'border border-amber-500/30 bg-amber-500/15 text-amber-800',
  idle: 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-700',
};

const STATUS_ICONS: Readonly<Record<WorkflowJobHealth, ReactNode>> = {
  healthy: <CheckCircle2 className="h-3 w-3" />,
  degraded: <AlertTriangle className="h-3 w-3" />,
  idle: <Clock className="h-3 w-3" />,
};

function extractJobMetrics(
  payload: ObservabilityWorkflowPayload
): readonly ObservabilityWorkflowMetric[] {
  if (!payload.workflows) return [];
  if (Array.isArray(payload.workflows)) return payload.workflows;
  if ('jobs' in payload.workflows && Array.isArray(payload.workflows.jobs)) {
    return payload.workflows.jobs;
  }
  return [];
}

function resolveOverallSlaPct(payload: ObservabilityWorkflowPayload): number | null {
  if (typeof payload.overallSla24hPct === 'number') {
    return payload.overallSla24hPct;
  }
  if (
    payload.uptime &&
    !Array.isArray(payload.uptime) &&
    'sla24h' in payload.uptime &&
    typeof payload.uptime.sla24h === 'number'
  ) {
    return payload.uptime.sla24h;
  }
  return null;
}

function formatObservedTimestamp(isoTimestamp?: string): string | null {
  if (!isoTimestamp) return null;
  const parsedMs = Date.parse(isoTimestamp);
  if (Number.isNaN(parsedMs)) return null;
  return new Date(parsedMs).toLocaleString('en-ZA');
}

function mapJobMetricsToEntries(
  jobMetrics: readonly ObservabilityWorkflowMetric[]
): readonly WorkflowJobEntry[] {
  return jobMetrics.map((metric) => {
    const executionCount = Math.max(0, metric.count ?? 0);
    const errorCount = Math.max(0, metric.errors ?? 0);
    const successfulCount = Math.max(0, executionCount - errorCount);
    const successRatePct =
      executionCount > 0
        ? Number(
            ((successfulCount / executionCount) * PERCENT_MULTIPLIER).toFixed(RATE_PRECISION_DIGITS)
          )
        : 0;
    const status: WorkflowJobHealth =
      executionCount === 0 ? 'idle' : errorCount > 0 ? 'degraded' : 'healthy';

    return {
      jobId: metric.jobId,
      count: executionCount,
      errors: errorCount,
      lastDurationMs: Math.max(0, metric.lastDurationMs ?? 0),
      successRatePct,
      status,
    };
  });
}

function computeAggregateRates(entries: readonly WorkflowJobEntry[]) {
  const totalExecutions = entries.reduce((sum, entry) => sum + entry.count, 0);
  const totalErrors = entries.reduce((sum, entry) => sum + entry.errors, 0);
  const degradedCount = entries.filter((entry) => entry.status === 'degraded').length;
  const overallSuccessRate =
    totalExecutions > 0
      ? `${(((totalExecutions - totalErrors) / totalExecutions) * FULL_RATE_PCT).toFixed(RATE_PRECISION_DIGITS)}%`
      : '—';

  return {
    totalExecutions,
    totalErrors,
    degradedCount,
    overallSuccessRate,
  };
}

export default function WorkflowsPage() {
  const [jobs, setJobs] = useState<readonly WorkflowJobEntry[]>([]);
  const [loadState, setLoadState] = useState<TelemetryLoadState>('loading');
  const [slaPct, setSlaPct] = useState<number | null>(null);
  const [observedAtLabel, setObservedAtLabel] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [noticeBanner, setNoticeBanner] = useState<NoticeBannerState | null>(null);

  const loadWorkflowObservability = useCallback(async (isManualRefresh = false) => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/observability', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ObservabilityWorkflowPayload;
      const mappedJobs = mapJobMetricsToEntries(extractJobMetrics(payload));

      setJobs(mappedJobs);
      setSlaPct(resolveOverallSlaPct(payload));
      setObservedAtLabel(formatObservedTimestamp(payload.timestamp));
      setSelectedJobId((currentId) => {
        if (currentId && mappedJobs.some((entry) => entry.jobId === currentId)) {
          return currentId;
        }
        return mappedJobs[0]?.jobId ?? null;
      });
      setLoadState('ready');

      if (isManualRefresh) {
        setNoticeBanner({
          tone: 'info',
          message: `Telemetry refreshed from runtime instrumentation (${mappedJobs.length.toLocaleString('en-US')} job metric(s) reported).`,
        });
      }
    } catch {
      setLoadState('error');
      setNoticeBanner({
        tone: 'warning',
        message:
          'Unable to reach /api/admin/observability. Runtime workflow telemetry is currently unavailable.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflowObservability(false);
  }, [loadWorkflowObservability]);

  const selectedJob = jobs.find((entry) => entry.jobId === selectedJobId) ?? jobs[0] ?? null;
  const aggregates = computeAggregateRates(jobs);

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col gap-6 bg-zinc-50 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageHeader title="n8n Workflow Manager" />
          <p className="mt-0.5 font-mono text-xs text-zinc-500">
            Live runtime background job &amp; webhook telemetry • 24h SLA:{' '}
            {slaPct !== null ? `${slaPct}%` : 'Unavailable'}
            {observedAtLabel ? ` • Synced: ${observedAtLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin?tab=webhooks"
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 font-medium text-xs text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Webhook Configuration
          </Link>
          <button
            type="button"
            onClick={() => void loadWorkflowObservability(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 font-medium text-sm text-zinc-800 shadow-sm transition-colors hover:bg-zinc-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {noticeBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs ${
            noticeBanner.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-indigo-200 bg-indigo-50 text-indigo-900'
          }`}
        >
          <span>{noticeBanner.message}</span>
          <button
            type="button"
            onClick={() => setNoticeBanner(null)}
            className="rounded border border-current/20 px-2 py-0.5 font-medium text-[11px] hover:bg-white/60"
          >
            Dismiss
          </button>
        </div>
      )}

      <KPIGrid cols={KPI_GRID_COLUMNS}>
        <KPICard
          label="Tracked Background Jobs"
          value={jobs.length.toLocaleString('en-US')}
          sub={
            aggregates.degradedCount > 0
              ? `${aggregates.degradedCount.toLocaleString('en-US')} with errors`
              : 'Active runtime instrumentation'
          }
          color="green"
          icon={<Workflow className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Total Executions"
          value={aggregates.totalExecutions.toLocaleString('en-US')}
          sub={`${aggregates.totalErrors.toLocaleString('en-US')} error(s) recorded`}
          color="blue"
          icon={<Activity className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Execution Success Rate"
          value={aggregates.overallSuccessRate}
          sub={
            aggregates.totalExecutions > 0
              ? 'Weighted across recorded job runs'
              : 'Awaiting first job execution'
          }
          color="indigo"
          icon={<TrendingUp className="h-5 w-5 opacity-70" />}
        />
      </KPIGrid>

      <CriticalWorkflowsCanvas />

      {jobs.length === 0 ? (
        <GlassCard variant="window" className="flex flex-col items-start gap-3 p-6">
          <div className="flex items-center gap-2 text-zinc-800">
            <Workflow className="h-5 w-5 text-purple-600" />
            <h2 className="font-semibold text-base">
              {loadState === 'loading'
                ? 'Loading runtime workflow telemetry...'
                : 'No background jobs executed yet in this runtime process'}
            </h2>
          </div>
          <p className="max-w-2xl text-sm text-zinc-600">
            This console reports live server job counters from{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
              /api/admin/observability
            </code>
            . Scheduled jobs, shift closeout synchronizers, and webhook deliveries appear here once
            executed by the running process.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/admin?tab=webhooks"
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700 text-xs hover:bg-indigo-100"
            >
              <Settings className="h-3.5 w-3.5" />
              Configure Webhooks &amp; Workflow Triggers
            </Link>
            <button
              type="button"
              onClick={() => void loadWorkflowObservability(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-medium text-xs text-zinc-700 hover:bg-zinc-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Telemetry Again
            </button>
          </div>
        </GlassCard>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-1">
            <GlassCard variant="spotlight" className="flex flex-1 flex-col p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-purple-600" />
                  <h2 className="font-semibold text-zinc-800">Runtime Jobs</h2>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {jobs.length.toLocaleString('en-US')} total
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                <div className="space-y-2">
                  {jobs.map((jobEntry) => {
                    const isSelected = selectedJob?.jobId === jobEntry.jobId;
                    return (
                      <div
                        key={jobEntry.jobId}
                        className={`rounded-lg border p-3 transition-all ${
                          isSelected
                            ? 'border-purple-200 bg-purple-50/50'
                            : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedJobId(jobEntry.jobId)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="truncate font-medium font-mono text-sm text-zinc-900">
                              {jobEntry.jobId}
                            </span>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_BADGE_CLASSES[jobEntry.status]}`}
                            >
                              {STATUS_ICONS[jobEntry.status]}
                              {jobEntry.status}
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Inspect ${jobEntry.jobId}`}
                            onClick={() => {
                              setSelectedJobId(jobEntry.jobId);
                              setNoticeBanner({
                                tone: 'info',
                                message: `Selected job "${jobEntry.jobId}" (${jobEntry.count.toLocaleString('en-US')} run(s), ${jobEntry.errors.toLocaleString('en-US')} error(s)). Webhook endpoints are managed in Admin -> Webhooks.`,
                              });
                            }}
                            className="rounded p-1 text-zinc-600 hover:bg-zinc-200"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-1 font-mono text-xs text-zinc-500">
                          Runs: {jobEntry.count.toLocaleString('en-US')} • Errors:{' '}
                          {jobEntry.errors.toLocaleString('en-US')} • Last:{' '}
                          {jobEntry.lastDurationMs.toLocaleString('en-US')}ms
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </GlassCard>
          </div>

          {selectedJob && (
            <div className="flex flex-col gap-4 lg:col-span-2">
              <GlassCard variant="window" className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-zinc-100 border-b bg-zinc-50/50 px-4 py-3">
                  <div>
                    <h3 className="font-mono font-semibold text-sm text-zinc-800">
                      {selectedJob.jobId}
                    </h3>
                    <p className="text-xs text-zinc-500 uppercase">Status: {selectedJob.status}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNoticeBanner({
                          tone: 'info',
                          message: `Job "${selectedJob.jobId}" is executed by server workflow schedules. Use "Refresh Telemetry" to poll latest metrics or configure webhooks in Admin -> Webhooks.`,
                        })
                      }
                      className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      Job Details
                    </button>
                    <Link
                      href="/admin?tab=webhooks"
                      className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      Manage Webhooks
                    </Link>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-white/40 p-4 font-mono text-sm text-zinc-800">
                  <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Job Identifier:</span>
                        <span className="font-mono text-zinc-800">{selectedJob.jobId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Executions:</span>
                        <span className="font-mono text-zinc-800">
                          {selectedJob.count.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Success Rate:</span>
                        <span className="font-mono text-emerald-700">
                          {selectedJob.successRatePct}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Errors:</span>
                        <span className="font-mono text-zinc-800">
                          {selectedJob.errors.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Last Duration:</span>
                        <span className="font-mono text-zinc-800">
                          {selectedJob.lastDurationMs.toLocaleString('en-US')}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Last Telemetry Sync:</span>
                        <span className="font-mono text-zinc-800">
                          {observedAtLabel ?? 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
