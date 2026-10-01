'use client';

import React from 'react';
import { WorkflowBuilder } from '@repo/ui/WorkflowBuilder';
import { GlassCard } from '@repo/ui/GlassCard';
import { PageHeader } from '@repo/ui/PageHeader';
import { type Node, type Edge } from '@xyflow/react';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'trigger',
    position: { x: 250, y: 150 },
    data: { label: 'Webhook Trigger', status: 'idle' },
  },
  {
    id: '2',
    type: 'plugin',
    position: { x: 500, y: 150 },
    data: { label: 'Redis Execute', pluginId: 'redis-cmd', status: 'idle' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'flow', animated: true },
];

export default function WorkflowsPage() {
  const [isDeploying, setIsDeploying] = React.useState(false);

  return (
    <div className="flex h-screen flex-col gap-4 p-4 lg:p-8">
      <div className="flex justify-between items-center">
        <PageHeader title="n8n Visual Workflow Engine" />
        <button
          onClick={async () => {
            setIsDeploying(true);
            // Simulate GitHub GitOps Commit
            await new Promise((r) => setTimeout(r, 1500));
            alert('Workflow successfully committed to GitHub (.workflows/main.json)');
            setIsDeploying(false);
          }}
          disabled={isDeploying}
          className="bg-[#24292e] text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 hover:bg-[#1b1f23] transition-colors"
        >
          {isDeploying ? 'Committing...' : 'Deploy to GitHub (GitOps)'}
        </button>
      </div>

      <GlassCard variant="spotlight" className="flex-1 overflow-hidden p-0 relative">
        <WorkflowBuilder
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onSave={(nodes, edges) => {
            console.log('Saved Workflow State:', { nodes, edges });
          }}
          onExecute={async (nodes, edges) => {
            console.log('Executing Workflow...', { nodes, edges });
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }}
        />
      </GlassCard>
    </div>
  );
}
