import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { WORKFLOW_REGISTRY } from '@/workflows';

export async function GET() {
  const workflows = Object.values(WORKFLOW_REGISTRY).map((wf) => ({
    id: wf.id,
    name: wf.name,
    description: wf.description,
    file: wf.file,
    entryFunction: wf.entryFunction,
  }));

  return NextResponse.json({
    count: workflows.length,
    workflows,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workflow: workflowId, args = [] } = body;

    if (!workflowId) {
      return NextResponse.json({ error: 'Missing workflow ID in request body' }, { status: 400 });
    }

    const targetWorkflow = WORKFLOW_REGISTRY[workflowId];
    if (!targetWorkflow) {
      return NextResponse.json(
        {
          error: `Unknown workflow: ${workflowId}`,
          availableWorkflows: Object.keys(WORKFLOW_REGISTRY),
        },
        { status: 404 }
      );
    }

    // Launch durable workflow run via Vercel Workflow SDK
    const run = await start(targetWorkflow.handler, Array.isArray(args) ? args : [args]);

    return NextResponse.json({
      success: true,
      runId: run.runId,
      workflow: workflowId,
      dispatchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error starting workflow:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch workflow' },
      { status: 500 }
    );
  }
}
