'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import { Activity, Clock, Pause, Play, Plus, Settings, TrendingUp, Workflow } from 'lucide-react';
import { useState } from 'react';

interface WorkflowItem {
  id: string;
  name: string;
  status: 'active' | 'running' | 'paused' | 'completed' | 'scheduled' | 'draft';
  lastRun: string;
  duration: string;
  triggers: number;
  successRate: number;
}

const workflowData: WorkflowItem[] = [
  {
    id: 'wf-001',
    name: 'Data Pipeline Monitor',
    status: 'active',
    lastRun: '2 minutes ago',
    duration: '45s',
    triggers: 127,
    successRate: 98.5,
  },
  {
    id: 'wf-002',
    name: 'Mining Operations Tracker',
    status: 'running',
    lastRun: '5 minutes ago',
    duration: '2m 15s',
    triggers: 89,
    successRate: 95.2,
  },
  {
    id: 'wf-003',
    name: 'Real-time Telemetry Processor',
    status: 'paused',
    lastRun: '2 hours ago',
    duration: '15m',
    triggers: 45,
    successRate: 89.7,
  },
  {
    id: 'wf-004',
    name: 'Quality Assurance Checker',
    status: 'completed',
    lastRun: '30 minutes ago',
    duration: '1m 30s',
    triggers: 203,
    successRate: 99.8,
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

export default function WorkflowsPage() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem>(() => {
    const first = workflowData[0];
    if (!first) throw new Error('workflowData should not be empty');
    return first;
  });

  const getStatusColor = (status: WorkflowItem['status']) => {
    const colors: Record<WorkflowItem['status'], string> = {
      active: 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30',
      running: 'bg-blue-500/15 text-blue-700 border border-blue-500/30',
      paused: 'bg-amber-500/15 text-amber-700 border border-amber-500/30',
      completed: 'bg-indigo-500/15 text-indigo-700 border border-indigo-500/30',
      scheduled: 'bg-purple-500/15 text-purple-700 border border-purple-500/30',
      draft: 'bg-zinc-500/15 text-zinc-700 border border-zinc-500/30',
    };
    return colors[status];
  };

  const getStatusIcon = (status: WorkflowItem['status']) => {
    switch (status) {
      case 'active':
        return <Play className="h-3 w-3" />;
      case 'running':
        return <Activity className="h-3 w-3" />;
      case 'paused':
        return <Pause className="h-3 w-3" />;
      case 'completed':
        return <TrendingUp className="h-3 w-3" />;
      case 'draft':
        return <Settings className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col gap-6 bg-zinc-50 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <PageHeader title="n8n Workflow Manager" />
          <p className="mt-0.5 font-mono text-xs text-zinc-500">
            Manage and monitor automated workflows and data pipelines
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 font-medium text-sm shadow-sm transition-colors hover:bg-zinc-100">
          <Plus className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      <KPIGrid cols={3}>
        <KPICard
          label="Total Workflows"
          value={workflowData.length.toString()}
          sub="Active workflows"
          color="green"
          icon={<Workflow className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Running Now"
          value={workflowData.filter((w) => w.status === 'running').length}
          sub="Currently executing"
          color="blue"
          icon={<Activity className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Success Rate"
          value="{(workflowData.reduce((sum, w) => sum + w.successRate, 0) / workflowData.length).toFixed(1)}%"
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
                {workflowData.map((workflow) => (
                  <div
                    key={workflow.id}
                    onClick={() => setSelectedWorkflow(workflow)}
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
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${getStatusColor(workflow.status)}`}
                        >
                          {getStatusIcon(workflow.status)}
                          {workflow.status}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
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
                  onClick={() => alert(`Executing ${selectedWorkflow.name}`)}
                  className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
                  disabled={selectedWorkflow.status === 'scheduled'}
                >
                  Execute
                </button>
                <button
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
                      {(selectedWorkflow.triggers / 24).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="mb-2 font-semibold text-xs text-zinc-700">Recent Logs</h4>
                <div className="max-h-32 space-y-1 overflow-auto rounded border border-zinc-200 bg-zinc-50/50 p-2 font-mono text-xs">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center gap-2 text-zinc-600">
                      <span className="text-zinc-400">
                        [{new Date(Date.now() - i * 60000).toLocaleTimeString()}]
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
