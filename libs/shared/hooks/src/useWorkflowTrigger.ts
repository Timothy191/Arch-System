'use client';

import { TriggerN8nResult, triggerN8nWorkflow } from '@repo/utils/n8n';
import { useCallback, useState } from 'react';

export interface UseWorkflowTriggerOptions<TResponse> {
  onSuccess?: (data: TResponse) => void;
  onError?: (error: Error) => void;
  fallback?: () => Promise<TResponse> | TResponse;
  timeoutMs?: number;
}

export interface UseWorkflowTriggerResult<TPayload, TResponse> {
  trigger: (webhookId: string, payload: TPayload) => Promise<TriggerN8nResult<TResponse>>;
  isTriggering: boolean;
  isSuccess: boolean;
  isError: boolean;
  lastExecutionId: string | null;
  lastResult: TriggerN8nResult<TResponse> | null;
  error: Error | null;
  reset: () => void;
}

/**
 * Industrial React 19 hook for dispatching events to n8n-compatible automation workflows.
 * Features:
 * - Robust Lie-Fi network timeout absorption
 * - Optimistic progress reporting
 * - Non-blocking fallback execution when workflow endpoint is unreachable
 */
export function useWorkflowTrigger<TPayload = Record<string, unknown>, TResponse = unknown>(
  options: UseWorkflowTriggerOptions<TResponse> = {}
): UseWorkflowTriggerResult<TPayload, TResponse> {
  const { onSuccess, onError, fallback, timeoutMs = 4000 } = options;

  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] = useState<TriggerN8nResult<TResponse> | null>(null);
  const [lastExecutionId, setLastExecutionId] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsTriggering(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setLastResult(null);
    setLastExecutionId(null);
  }, []);

  const trigger = useCallback(
    async (webhookId: string, payload: TPayload): Promise<TriggerN8nResult<TResponse>> => {
      setIsTriggering(true);
      setIsSuccess(false);
      setIsError(false);
      setError(null);

      try {
        const result = await triggerN8nWorkflow<TPayload, TResponse>(webhookId, payload, {
          timeoutMs,
          fallback,
        });

        setLastResult(result);

        if (result.success) {
          setIsSuccess(true);
          const dataObj = result.data as Record<string, unknown> | undefined;
          if (dataObj && typeof dataObj.executionId === 'string') {
            setLastExecutionId(dataObj.executionId);
          }
          if (result.data !== undefined && onSuccess) {
            onSuccess(result.data);
          }
        } else {
          setIsError(true);
          const err = new Error(result.error || 'Workflow trigger failed');
          setError(err);
          if (onError) onError(err);
        }

        return result;
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        setIsError(true);
        setError(errObj);
        if (onError) onError(errObj);

        return {
          success: false,
          executed: false,
          skipped: true,
          source: 'none',
          error: errObj.message,
        };
      } finally {
        setIsTriggering(false);
      }
    },
    [timeoutMs, fallback, onSuccess, onError]
  );

  return {
    trigger,
    isTriggering,
    isSuccess,
    isError,
    lastExecutionId,
    lastResult,
    error,
    reset,
  };
}
