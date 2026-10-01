'use client';

import { useQuery } from '@tanstack/react-query';

export interface WorkflowJobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'unknown';
  progress: number;
  result?: any;
  error?: string;
  updatedAt?: string;
}

export interface UseWorkflowStatusOptions {
  enabled?: boolean;
}

const fetchWorkflowStatus = async (jobId: string): Promise<WorkflowJobStatus> => {
  const response = await fetch(`/api/workflows/${jobId}`);
  if (!response.ok) {
    if (response.status === 404) {
      return { status: 'unknown', progress: 0, error: 'Not found' };
    }
    throw new Error('Failed to fetch workflow status');
  }
  return response.json();
};

export function useWorkflowStatus(
  jobId: string | null | undefined,
  options: UseWorkflowStatusOptions = {}
) {
  const enabled = options.enabled !== false && !!jobId;

  return useQuery({
    queryKey: ['workflow', jobId],
    queryFn: () => fetchWorkflowStatus(jobId!),
    enabled,
    refetchInterval: (query: any) => {
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
