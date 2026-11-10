'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import { Activity, Clock, Pause, Play, Plus, Settings, TrendingUp, Workflow } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

const KPI_GRID_COLUMNS = 3;
const HOURS_PER_DAY = 24;
const RECENT_LOG_COUNT = 5;
const MS_PER_MINUTE = 60000;
const PERCENT_MULTIPLIER = 100;
const DEFAULT_SLA_PCT = 99.95;
const WF1_TRIGGERS = 127;
const WF1_SUCCESS_RATE = 98.5;
const WF2_TRIGGERS = 89;
const WF2_SUCCESS_RATE = 95.2;
const WF3_TRIGGERS = 45;
const WF3_SUCCESS_RATE = 89.7;
const WF4_TRIGGERS = 203;
const WF4_SUCCESS_RATE = 99.8;

type WorkflowStatus = 'active' | 'running' | 'paused' | 'completed' | 'scheduled' | 'draft';

interface WorkflowEntry {
  readonly id: string;
  readonly name: string;
  readonly status: WorkflowStatus;
  readonly lastRun: string;
  readonly duration: string;
  readonly triggers: number;
  readonly successRate: number;
}

interface ObservabilityWorkflowMetric {
  readonly jobId: string;
  readonly count?: number;
  readonly errors?: number;
  readonly lastDurationMs?: number;
  readonly status?: WorkflowStatus;
}

interface ObservabilityWorkflowPayload {
  readonly workflows?:
    | readonly ObservabilityWorkflowMetric[]
    | {
        readonly jobs?: readonly ObservabilityWorkflowMetric[];
      };
  readonly uptime?: {
    readonly sla24h?: number;
  };
}

const INITIAL_WORKFLOWS: readonly WorkflowEntry[] = [
  {
    id: 'wf-001',
    name: 'Data Pipeline Monitor',
    status: 'active',
    lastRun: '2 minutes ago',
    duration: '45s',
    triggers: WF1_TRIGGERS,
    successRate: WF1_SUCCESS_RATE,
  },
  {
    id: 'wf-002',
    name: 'Mining Operations Tracker',
    status: 'running',
    lastRun: '5 minutes ago',
    duration: '2m 15s',
    triggers: WF2_TRIGGERS,
    successRate: WF2_SUCCESS_RATE,
  },
  {
    id: 'wf-003',
    name: 'Real-time Telemetry Processor',
    status: 'paused',
    lastRun: '2 hours ago',
    duration: '15m',
    triggers: WF3_TRIGGERS,
    successRate: WF3_SUCCESS_RATE,
  },
  {
    id: 'wf-004',
    name: 'Quality Assurance Checker',
    status: 'completed',
    lastRun: '30 minutes ago',
    duration: '1m 30s',
    triggers: WF4_TRIGGERS,
    successRate: WF4_SUCCESS_RATE,
  },
  {
    id: 'wf-005',
    name: 'Equipment Maintenance Scheduler',
    status: 'scheduled',
    lastRun: 'Tomorrow, 08:00',
    duration: 'N/A',
    triggers: 0,
    successRate: 0,
  },
  {
    id: 'wf-006',
    name: 'Report Generator',
    status: 'draft',
    lastRun: 'Never',
    duration: 'N/A',
    triggers: 0,
    successRate: 0,
  },
];

const STATUS_BADGE_CLASSES: Record<WorkflowStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30',
  running: 'bg-blue-500/15 text-blue-700 border border-blue-500/30',
  paused: 'bg-amber-500/15 text-amber-700 border border-amber-500/30',
  completed: 'bg-indigo-500/15 text-indigo-700 border border-indigo-500/30',
  scheduled: 'bg-purple-500/15 text-purple-700 border border-purple-500/30',
  draft: 'bg-zinc-500/15 text-zinc-700 border border-zinc-500/30',
};

const STATUS_ICONS: Record<WorkflowStatus, ReactNode> = {
  active: <Play className="h-3 w-3" />,
  running: <Activity className="h-3 w-3" />,
  paused: <Pause className="h-3 w-3" />,
  completed: <TrendingUp className="h-3 w-3" />,
  scheduled: <Clock className="h-3 w-3" />,
  draft: <Settings className="h-3 w-3" />,
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

function mergeWorkflowMetrics(
  baseList: readonly WorkflowEntry[],
  jobMetrics: readonly ObservabilityWorkflowMetric[]
): readonly WorkflowEntry[] {
  if (jobMetrics.length === 0) return baseList;
  return baseList.map((workflow, index) => {
    const matchedMetric =
      jobMetrics.find((metric) => metric.jobId === workflow.id || metric.jobId === workflow.name) ??
      jobMetrics[index];
    if (!matchedMetric) return workflow;
    const totalCount = matchedMetric.count ?? workflow.triggers;
    const errorCount = matchedMetric.errors ?? 0;
    const computedSuccessRate =
      totalCount > 0
        ? Number((((totalCount - errorCount) / totalCount) * PERCENT_MULTIPLIER).toFixed(1))
        : workflow.successRate;

    return {
      ...workflow,
      triggers: totalCount,
      duration:
        typeof matchedMetric.lastDurationMs === 'number'
          ? `${matchedMetric.lastDurationMs}ms`
          : workflow.duration,
      successRate: computedSuccessRate,
      status: matchedMetric.status ?? workflow.status,
    };
  });
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<readonly WorkflowEntry[]>(INITIAL_WORKFLOWS);
  const [slaPct, setSlaPct] = useState<number>(DEFAULT_SLA_PCT);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(
    INITIAL_WORKFLOWS[0]?.id ?? 'wf-001'
  );

  useEffect(() => {
    let isMounted = true;
    const loadWorkflowObservability = async () => {
      try {
        const response = await fetch('/api/admin/observability');
        if (!response.ok || !isMounted) return;
        const payload = (await response.json()) as ObservabilityWorkflowPayload;
        const merged = mergeWorkflowMetrics(INITIAL_WORKFLOWS, extractJobMetrics(payload));
        setWorkflows(merged);
        if (typeof payload.uptime?.sla24h === 'number') {
          setSlaPct(payload.uptime.sla24h);
        }
      } catch {
        // Graceful fallback to initial workflow list when offline
      }
    };
    loadWorkflowObservability();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    workflows[0] ??
    INITIAL_WORKFLOWS[0];

  const averageSuccessRate = (
    workflows.reduce((sum, workflow) => sum + workflow.successRate, 0) / workflows.length
  ).toFixed(1);

  if (!selectedWorkflow) return null;

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col gap-6 bg-zinc-50 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <PageHeader title="n8n Workflow Manager" />
          <p className="mt-0.5 font-mono text-xs text-zinc-500">
            Manage and monitor automated workflows and data pipelines • 24h SLA: {slaPct}%
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 font-medium text-sm shadow-sm transition-colors hover:bg-zinc-100"
        >
          <Plus className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      <KPIGrid cols={KPI_GRID_COLUMNS}>
        <KPICard
          label="Total Workflows"
          value={workflows.length.toString()}
          sub="Active workflows"
          color="green"
          icon={<Workflow className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Running Now"
          value={workflows.filter((workflow) => workflow.status === 'running').length}
          sub="Currently executing"
          color="blue"
          icon={<Activity className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Success Rate"
          value={`${averageSuccessRate}%`}
          sub="Average across all workflows"
          color="indigo"
          icon={<TrendingUp className="h-5 w-5 opacity-70" />}
        />
      </KPIGrid>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <GlassCard variant="spotlight" className="flex flex-1 flex-col p-4">
            <div className="mb-4 flex items-center gap-2">
              <Workflow className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-zinc-800">Workflow List</h3>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-all ${
                      selectedWorkflow.id === workflow.id
                        ? 'border-purple-200 bg-purple-50/50'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{workflow.name.split(' ')[0]}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_BADGE_CLASSES[workflow.status]}`}
                        >
                          {STATUS_ICONS[workflow.status]}
                          {workflow.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          alert(`Configure ${workflow.name}`);
                        }}
                        className="rounded p-1 hover:bg-zinc-200"
                      >
                        <Settings className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="mt-1 font-mono text-xs text-zinc-500">
                      Last: {workflow.lastRun} • {workflow.duration}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <GlassCard variant="window" className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-zinc-100 border-b bg-zinc-50/50 px-4 py-3">
              <div>
                <h3 className="font-mono font-semibold text-sm text-zinc-800">
                  {selectedWorkflow.name}
                </h3>
                <p className="text-xs text-zinc-500 uppercase">Status: {selectedWorkflow.status}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => alert(`Executing ${selectedWorkflow.name}`)}
                  className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
                  disabled={selectedWorkflow.status === 'scheduled'}
                >
                  Execute
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Configure ${selectedWorkflow.name}`)}
                  className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                >
                  Configure
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white/40 p-4 font-mono text-sm text-zinc-800">
              <div className="mb-4 grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Workflow ID:</span>
                    <span className="font-mono text-zinc-800">{selectedWorkflow.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Triggers:</span>
                    <span className="font-mono text-zinc-800">{selectedWorkflow.triggers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Success Rate:</span>
                    <span className="font-mono text-emerald-700">
                      {selectedWorkflow.successRate}%
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Last Run:</span>
                    <span className="font-mono text-zinc-800">{selectedWorkflow.lastRun}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Duration:</span>
                    <span className="font-mono text-zinc-800">{selectedWorkflow.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Avg per Hour:</span>
                    <span className="font-mono text-zinc-800">
                      {(selectedWorkflow.triggers / HOURS_PER_DAY).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="mb-2 font-semibold text-xs text-zinc-700">Recent Logs</h4>
                <div className="max-h-32 space-y-1 overflow-auto rounded border border-zinc-200 bg-zinc-50/50 p-2 font-mono text-xs">
                  {Array.from({ length: RECENT_LOG_COUNT }, (_, logIndex) => (
                    <div key={logIndex} className="flex items-center gap-2 text-zinc-600">
                      <span className="text-zinc-400">
                        [{new Date(Date.now() - logIndex * MS_PER_MINUTE).toLocaleTimeString()}]
                      </span>
                      <span className="text-indigo-600">INFO</span>
                      <span>Workflow executed successfully</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
