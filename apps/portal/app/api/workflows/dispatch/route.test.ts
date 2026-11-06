/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'wf_test_1' }),
  })),
}));

describe('POST /api/workflows/dispatch', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    delete process.env.DISPATCH_API_KEY;
    delete process.env.REQUIRE_API_KEY;
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true });
  });

  it('fails closed with 503 in production when DISPATCH_API_KEY is not configured', async () => {
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

  it('enqueues workflow when authorized with valid Bearer token', async () => {
    process.env.DISPATCH_API_KEY = 'dispatch-secret-token';
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
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBe('idem_shift-closeout-001');
  });
});
