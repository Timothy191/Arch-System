'use client';

import { type Query, useQuery } from '@tanstack/react-query';

export interface WorkflowJobStatus<TResult = unknown> {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'unknown';
  progress: number;
  result?: TResult;
  error?: string;
  updatedAt?: string;
}

export interface UseWorkflowStatusOptions {
  enabled?: boolean;
}

const fetchWorkflowStatus = async <TResult = unknown>(
  jobId: string
): Promise<WorkflowJobStatus<TResult>> => {
  const response = await fetch(`/api/workflows/${jobId}`);
  if (!response.ok) {
    if (response.status === 404) {
      return { status: 'unknown', progress: 0, error: 'Not found' };
    }
    throw new Error('Failed to fetch workflow status');
  }
  return response.json() as Promise<WorkflowJobStatus<TResult>>;
};

export function useWorkflowStatus<TResult = unknown>(
  jobId: string | null | undefined,
  options: UseWorkflowStatusOptions = {}
) {
  const enabled = options.enabled !== false && !!jobId;

  return useQuery({
    queryKey: ['workflow', jobId],
    queryFn: () => fetchWorkflowStatus<TResult>(jobId!),
    enabled,
    refetchInterval: (
      query: Query<
        WorkflowJobStatus<TResult>,
        Error,
        WorkflowJobStatus<TResult>,
        readonly unknown[]
      >
    ) => {
      // Poll every 3 seconds if pending or running
      const state = query.state.data;
      if (state && (state.status === 'pending' || state.status === 'running')) {
        return 3000;
      }
      return false;
    },
    retry: 3,
  });
}
