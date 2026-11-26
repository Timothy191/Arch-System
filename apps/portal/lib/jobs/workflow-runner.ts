import { serverlessRedis } from '@repo/redis';
import { type TriggerN8nOptions, triggerN8nWorkflow } from '@repo/utils/n8n';
import { logError } from '@/lib/errors/error-logger';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

const WORKFLOW_JOB_TTL_SECONDS = 3600;
const RUNNING_PROGRESS_PCT = 10;
const COMPLETED_PROGRESS_PCT = 100;

export interface WorkflowJobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
  updatedAt: string;
}

export interface TrackedWorkflowOptions<TResponse> extends TriggerN8nOptions<TResponse> {
  /**
   * When true, awaits n8n workflow execution before resolving so serverless
   * route handlers never freeze mid-flight and receive the real outcome.
   */
  readonly awaitCompletion?: boolean;
}

/**
 * Reads the persisted execution status of a tracked workflow job from Redis (`workflow_job_<jobId>`).
 * Note: BullMQ queue jobs are inspected separately via `/api/workflows/jobs/[jobId]`.
 */
export async function getTrackedWorkflowStatus(jobId: string): Promise<WorkflowJobStatus | null> {
  const cached: unknown = await serverlessRedis.get(`workflow_job_${jobId}`);
  if (!cached) return null;
  if (typeof cached === 'string') {
    try {
      return JSON.parse(cached) as WorkflowJobStatus;
    } catch {
      return null;
    }
  }
  if (typeof cached === 'object') {
    return cached as WorkflowJobStatus;
  }
  return null;
}

/**
 * Triggers an n8n workflow and tracks its lifecycle (`pending` -> `running` -> `completed` | `failed`)
 * in Redis under `workflow_job_<jobId>` (1-hour TTL).
 *
 * Pass `{ awaitCompletion: true }` in serverless API routes to await execution and surface
 * the final status directly; omit it for fire-and-forget Server Action triggers.
 */
export async function triggerTrackedWorkflow<TPayload, TResponse = unknown>(
  jobId: string,
  endpointOrWebhookPath: string,
  payload: TPayload,
  options?: TrackedWorkflowOptions<TResponse>
): Promise<{
  jobId: string;
  status: WorkflowJobStatus['status'];
  result?: unknown;
  error?: string;
}> {
  const cacheKey = `workflow_job_${jobId}`;
  const { awaitCompletion, ...n8nOptions } = options ?? {};
  const hasN8nOptions = Object.keys(n8nOptions).length > 0;

  const initialState: WorkflowJobStatus = {
    status: 'pending',
    progress: 0,
    updatedAt: new Date().toISOString(),
  };

  await serverlessRedis.set(cacheKey, initialState, WORKFLOW_JOB_TTL_SECONDS);

  const runAsync = async (): Promise<WorkflowJobStatus> => {
    const startedAtMs = Date.now();
    try {
      await serverlessRedis.set(
        cacheKey,
        {
          ...initialState,
          status: 'running',
          progress: RUNNING_PROGRESS_PCT,
          updatedAt: new Date().toISOString(),
        },
        WORKFLOW_JOB_TTL_SECONDS
      );

      const result = hasN8nOptions
        ? await triggerN8nWorkflow(
            endpointOrWebhookPath,
            payload,
            n8nOptions as TriggerN8nOptions<TResponse>
          )
        : await triggerN8nWorkflow(endpointOrWebhookPath, payload, undefined);

      const durationMs = Math.max(0, Date.now() - startedAtMs);
      recordJobExecution(endpointOrWebhookPath, durationMs, result.success);

      if (result.success) {
        const completedState: WorkflowJobStatus = {
          status: 'completed',
          progress: COMPLETED_PROGRESS_PCT,
          result: result.data,
          updatedAt: new Date().toISOString(),
        };
        await serverlessRedis.set(cacheKey, completedState, WORKFLOW_JOB_TTL_SECONDS);
        return completedState;
      }

      const failedState: WorkflowJobStatus = {
        status: 'failed',
        progress: COMPLETED_PROGRESS_PCT,
        error: result.error || 'Workflow execution failed',
        updatedAt: new Date().toISOString(),
      };
      await serverlessRedis.set(cacheKey, failedState, WORKFLOW_JOB_TTL_SECONDS);
      return failedState;
    } catch (err: unknown) {
      recordJobExecution(endpointOrWebhookPath, Math.max(0, Date.now() - startedAtMs), false);
      const exceptionState: WorkflowJobStatus = {
        status: 'failed',
        progress: COMPLETED_PROGRESS_PCT,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
        updatedAt: new Date().toISOString(),
      };
      await serverlessRedis.set(cacheKey, exceptionState, WORKFLOW_JOB_TTL_SECONDS);
      return exceptionState;
    }
  };

  if (awaitCompletion) {
    const finalState = await runAsync();
    return {
      jobId,
      status: finalState.status,
      ...(finalState.result !== undefined ? { result: finalState.result } : {}),
      ...(finalState.error ? { error: finalState.error } : {}),
    };
  }

  runAsync().catch((error) => {
    void logError(error, { context: 'tracked_workflow_runner', jobId });
  });

  return { jobId, status: 'pending' };
}
