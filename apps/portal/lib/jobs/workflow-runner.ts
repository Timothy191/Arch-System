import { serverlessRedis } from '@repo/redis/serverless-client';
import { type TriggerN8nOptions, triggerN8nWorkflow } from '@repo/utils/n8n';

export interface WorkflowJobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  updatedAt: string;
}

/**
 * Triggers an n8n workflow and initializes its state in Vercel Redis.
 * This allows the frontend to poll `/api/workflows/[jobId]` and track progress.
 */
export async function triggerTrackedWorkflow<TPayload, TResponse = unknown>(
  jobId: string,
  endpointOrWebhookPath: string,
  payload: TPayload,
  options?: TriggerN8nOptions<TResponse>
) {
  const cacheKey = `workflow_job_${jobId}`;

  const initialState: WorkflowJobStatus = {
    status: 'pending',
    progress: 0,
    updatedAt: new Date().toISOString(),
  };

  // 1. Initialize job in Redis with 1 hour TTL
  await serverlessRedis.set(cacheKey, initialState, 3600);

  // 2. Trigger the actual n8n workflow
  // We don't await this if we want it to run entirely in the background,
  // but if we do await it, we can update the status on completion.
  // Given Next.js Server Actions, we shouldn't block the request for long.
  // We'll wrap the call so it updates Redis on completion/failure.

  const runAsync = async () => {
    try {
      // Mark as running
      await serverlessRedis.set(
        cacheKey,
        {
          ...initialState,
          status: 'running',
          progress: 10,
          updatedAt: new Date().toISOString(),
        },
        3600
      );

      const result = await triggerN8nWorkflow(endpointOrWebhookPath, payload, options);

      if (result.success) {
        await serverlessRedis.set(
          cacheKey,
          {
            status: 'completed',
            progress: 100,
            result: result.data,
            updatedAt: new Date().toISOString(),
          },
          3600
        );
      } else {
        await serverlessRedis.set(
          cacheKey,
          {
            status: 'failed',
            progress: 100,
            error: result.error || 'Workflow execution failed',
            updatedAt: new Date().toISOString(),
          },
          3600
        );
      }
    } catch (err: unknown) {
      await serverlessRedis.set(
        cacheKey,
        {
          status: 'failed',
          progress: 100,
          error: err instanceof Error ? err.message : 'Unknown error occurred',
          updatedAt: new Date().toISOString(),
        },
        3600
      );
    }
  };

  // Kick off without blocking
  runAsync().catch(console.error);

  return { jobId, status: 'pending' };
}
