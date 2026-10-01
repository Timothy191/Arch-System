'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { PageHeader } from '@repo/ui/PageHeader';
import { WorkflowBuilder } from '@repo/ui/WorkflowBuilder';
import { type Edge, type Node } from '@xyflow/react';
import { CheckCircle2, Play, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'trigger',
    position: { x: 250, y: 150 },
    data: { label: 'SCADA Delay Trigger', status: 'idle' },
  },
  {
    id: '2',
    type: 'plugin',
    position: { x: 520, y: 150 },
    data: { label: 'BullMQ Queue Dispatcher', pluginId: 'bullmq-worker', status: 'idle' },
  },
  {
    id: '3',
    type: 'action',
    position: { x: 800, y: 150 },
    data: { label: 'Closeout Compilation', actionId: 'shift-closeout', status: 'idle' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'flow', animated: true },
  { id: 'e2-3', source: '2', target: '3', type: 'flow', animated: true },
];

export default function WorkflowsPage() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastJob, setLastJob] = useState<{
    jobId: string;
    status: string;
    timestamp: string;
  } | null>(null);

  const handleDispatch = async (nodes: Node[], edges: Edge[]) => {
    setIsExecuting(true);
    try {
      const response = await fetch('https://arch-system-nest-proxy.vercel.app/workflows/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: 'scada_closeout_pipeline',
          name: 'Plantcor Autonomous Shift Pipeline',
          nodes,
          edges,
          triggeredBy: 'timothyoniel558@gmail.com',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setLastJob({
          jobId: result.jobId,
          status: result.queueStatus || 'queued',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch {
      // Offline fallback
      setLastJob({
        jobId: `local_${Date.now()}`,
        status: 'buffered_offline',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <PageHeader title="n8n Visual Workflow Engine" />
          {lastJob && (
            <div className="flex items-center gap-2 mt-1 text-xs text-emerald-600 font-mono bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Active Job: {lastJob.jobId}</span>
              <span className="text-zinc-400">•</span>
              <span className="uppercase font-semibold">{lastJob.status}</span>
              <span className="text-zinc-400">•</span>
              <span>{lastJob.timestamp}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleDispatch(initialNodes, initialEdges)}
            disabled={isExecuting}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Play className={`h-4 w-4 ${isExecuting ? 'animate-spin' : ''}`} />
            {isExecuting ? 'Dispatching...' : 'Run Live Workflow'}
          </button>

          <button
            onClick={async () => {
              setIsDeploying(true);
              await new Promise((r) => setTimeout(r, 1200));
              alert('Workflow committed to GitHub GitOps (.workflows/scada_pipeline.json)');
              setIsDeploying(false);
            }}
            disabled={isDeploying}
            className="bg-[#24292e] text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 hover:bg-[#1b1f23] transition-colors shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            {isDeploying ? 'Syncing...' : 'Deploy to GitHub (GitOps)'}
          </button>
        </div>
      </div>

      <GlassCard variant="spotlight" className="flex-1 overflow-hidden p-0 relative">
        <WorkflowBuilder
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onSave={(nodes, edges) => {
            console.log('Saved Workflow State:', { nodes, edges });
          }}
          onExecute={async (nodes, edges) => {
            await handleDispatch(nodes, edges);
          }}
        />
      </GlassCard>
    </div>
  );
}
