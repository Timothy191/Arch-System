const mockRedisSet = jest.fn();
jest.mock('@repo/redis', () => ({
  serverlessRedis: {
    set: (...args: unknown[]) => mockRedisSet(...args),
  },
}));

const mockTriggerN8nWorkflow = jest.fn();
jest.mock('@repo/utils/n8n', () => ({
  triggerN8nWorkflow: (...args: unknown[]) => mockTriggerN8nWorkflow(...args),
}));

import { triggerTrackedWorkflow } from './workflow-runner';

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('triggerTrackedWorkflow', () => {
  beforeEach(() => {
    mockRedisSet.mockReset();
    mockRedisSet.mockResolvedValue('OK');
    mockTriggerN8nWorkflow.mockReset();
  });

  it('initializes job as pending and transitions through running to completed on success', async () => {
    mockTriggerN8nWorkflow.mockResolvedValue({
      success: true,
      data: { processed: 42 },
    });

    const response = await triggerTrackedWorkflow(
      'job-123',
      '/webhook/shift-handoff',
      { department: 'mining' },
      { timeoutMs: 5000 }
    );

    expect(response).toEqual({ jobId: 'job-123', status: 'pending' });

    await flushMicrotasks();

    expect(mockTriggerN8nWorkflow).toHaveBeenCalledWith(
      '/webhook/shift-handoff',
      { department: 'mining' },
      { timeoutMs: 5000 }
    );

    expect(mockRedisSet).toHaveBeenCalledTimes(3);
    expect(mockRedisSet).toHaveBeenNthCalledWith(
      1,
      'workflow_job_job-123',
      expect.objectContaining({
        status: 'pending',
        progress: 0,
        updatedAt: expect.any(String),
      }),
      3600
    );
    expect(mockRedisSet).toHaveBeenNthCalledWith(
      2,
      'workflow_job_job-123',
      expect.objectContaining({
        status: 'running',
        progress: 10,
        updatedAt: expect.any(String),
      }),
      3600
    );
    expect(mockRedisSet).toHaveBeenNthCalledWith(
      3,
      'workflow_job_job-123',
      expect.objectContaining({
        status: 'completed',
        progress: 100,
        result: { processed: 42 },
        updatedAt: expect.any(String),
      }),
      3600
    );
  });

  it('records failed status when n8n returns an unsuccessful result', async () => {
    mockTriggerN8nWorkflow.mockResolvedValue({
      success: false,
      error: 'Webhook returned 502',
    });

    await triggerTrackedWorkflow('job-fail-1', '/webhook/weather-alert', {
      alert_type: 'lightning',
    });

    await flushMicrotasks();

    expect(mockRedisSet).toHaveBeenLastCalledWith(
      'workflow_job_job-fail-1',
      expect.objectContaining({
        status: 'failed',
        progress: 100,
        error: 'Webhook returned 502',
        updatedAt: expect.any(String),
      }),
      3600
    );
  });

  it('uses fallback error message when n8n failure omits an error string', async () => {
    mockTriggerN8nWorkflow.mockResolvedValue({
      success: false,
    });

    await triggerTrackedWorkflow('job-fail-fallback', '/webhook/test', {});
    await flushMicrotasks();

    expect(mockRedisSet).toHaveBeenLastCalledWith(
      'workflow_job_job-fail-fallback',
      expect.objectContaining({
        status: 'failed',
        progress: 100,
        error: 'Workflow execution failed',
      }),
      3600
    );
  });

  it('records failed status when triggerN8nWorkflow throws an Error or unknown value', async () => {
    mockTriggerN8nWorkflow.mockRejectedValueOnce(new Error('Network timeout'));

    await triggerTrackedWorkflow('job-throw-err', '/webhook/sync', {});
    await flushMicrotasks();

    expect(mockRedisSet).toHaveBeenLastCalledWith(
      'workflow_job_job-throw-err',
      expect.objectContaining({
        status: 'failed',
        progress: 100,
        error: 'Network timeout',
      }),
      3600
    );

    mockRedisSet.mockClear();
    mockTriggerN8nWorkflow.mockRejectedValueOnce('raw-rejection');

    await triggerTrackedWorkflow('job-throw-raw', '/webhook/sync', {});
    await flushMicrotasks();

    expect(mockRedisSet).toHaveBeenLastCalledWith(
      'workflow_job_job-throw-raw',
      expect.objectContaining({
        status: 'failed',
        progress: 100,
        error: 'Unknown error occurred',
      }),
      3600
    );
  });
});
