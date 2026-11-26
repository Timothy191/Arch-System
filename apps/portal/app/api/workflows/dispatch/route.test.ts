/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { getWorkflowQueue } from '@/lib/workflows/queue';
import { POST } from './route';

jest.mock('@/lib/workflows/queue', () => ({
  getWorkflowQueue: jest.fn(() => null),
}));

jest.mock('@/lib/jobs/workflow-runner', () => ({
  triggerTrackedWorkflow: jest.fn().mockResolvedValue({
    jobId: 'idem_shift-closeout-direct',
    status: 'completed',
  }),
}));

const mockedGetWorkflowQueue = getWorkflowQueue as jest.MockedFunction<typeof getWorkflowQueue>;

describe('POST /api/workflows/dispatch', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WORKFLOW_WORKER_ENABLED;
    mockedGetWorkflowQueue.mockReturnValue(null);
  });

  afterEach(() => {
    delete process.env.DISPATCH_API_KEY;
    delete process.env.REQUIRE_API_KEY;
    delete process.env.WORKFLOW_WORKER_ENABLED;
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true });
  });

  it('fails closed with 503 when DISPATCH_API_KEY is not configured', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    const req = new NextRequest('http://localhost:3000/api/workflows/dispatch', {
      method: 'POST',
      body: JSON.stringify({ workflowId: 'wf_1', name: 'Test Workflow' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it('returns 401 when DISPATCH_API_KEY is configured and caller provides invalid token', async () => {
    process.env.DISPATCH_API_KEY = 'dispatch-secret-token';
    const req = new NextRequest('http://localhost:3000/api/workflows/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ workflowId: 'wf_1', name: 'Test Workflow' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 503 when WORKFLOW_WORKER_ENABLED=true but workflow queue is not configured', async () => {
    process.env.DISPATCH_API_KEY = 'dispatch-secret-token';
    process.env.WORKFLOW_WORKER_ENABLED = 'true';
    const req = new NextRequest('http://localhost:3000/api/workflows/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer dispatch-secret-token' },
      body: JSON.stringify({
        workflowId: 'wf_1',
        name: 'Test Workflow',
        idempotencyKey: 'shift-closeout-001',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.queueStatus).toBe('unavailable');
    expect(body.workerDeployed).toBe(true);
    expect(body.jobId).toBe('idem_shift-closeout-001');
  });

  it('executes directly via triggerTrackedWorkflow when no BullMQ worker consumer is deployed', async () => {
    process.env.DISPATCH_API_KEY = 'dispatch-secret-token';
    const req = new NextRequest('http://localhost:3000/api/workflows/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer dispatch-secret-token' },
      body: JSON.stringify({
        workflowId: 'wf_1',
        name: 'Test Workflow',
        idempotencyKey: 'shift-closeout-002',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.queueStatus).toBe('executed_direct');
    expect(body.workerDeployed).toBe(false);
  });
});
