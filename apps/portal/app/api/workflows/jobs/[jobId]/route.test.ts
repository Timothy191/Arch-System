/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    getJob: jest.fn().mockResolvedValue({
      attemptsMade: 1,
      timestamp: 1700000000000,
      finishedOn: 1700000005000,
      data: { workflowId: 'wf_test' },
      getState: jest.fn().mockResolvedValue('completed'),
    }),
  })),
}));

describe('GET /api/workflows/jobs/[jobId]', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    delete process.env.DISPATCH_API_KEY;
    delete process.env.REQUIRE_API_KEY;
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true });
  });

  it('fails closed with 503 in production when DISPATCH_API_KEY is not configured', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    const req = new NextRequest('http://localhost:3000/api/workflows/jobs/job_123');
    const res = await GET(req, { params: Promise.resolve({ jobId: 'job_123' }) });
    expect(res.status).toBe(503);
  });

  it('returns 401 when DISPATCH_API_KEY is configured and caller is unauthenticated', async () => {
    process.env.DISPATCH_API_KEY = 'workflow-secret-key';
    const req = new NextRequest('http://localhost:3000/api/workflows/jobs/job_123');
    const res = await GET(req, { params: Promise.resolve({ jobId: 'job_123' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 when jobId contains invalid characters', async () => {
    process.env.DISPATCH_API_KEY = 'workflow-secret-key';
    const req = new NextRequest('http://localhost:3000/api/workflows/jobs/../../etc', {
      headers: { Authorization: 'Bearer workflow-secret-key' },
    });
    const res = await GET(req, { params: Promise.resolve({ jobId: '../../etc' }) });
    expect(res.status).toBe(400);
  });

  it('allows authorized caller with valid Bearer token', async () => {
    process.env.DISPATCH_API_KEY = 'workflow-secret-key';
    const req = new NextRequest('http://localhost:3000/api/workflows/jobs/job_123', {
      headers: { Authorization: 'Bearer workflow-secret-key' },
    });
    const res = await GET(req, { params: Promise.resolve({ jobId: 'job_123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe('job_123');
  });
});
