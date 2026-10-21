/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('@/lib/redis-engine', () => ({
  redisEngine: {
    listExecutions: jest.fn().mockReturnValue([{ id: 'exec-1' }]),
  },
}));

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/redis-proxy/v1/executions', {
    headers,
  });
}

describe('GET /api/redis-proxy/v1/executions', () => {
  const originalRedisSecret = process.env.REDIS_AUTH_SECRET;
  const originalN8nKey = process.env.N8N_API_KEY;

  beforeEach(() => {
    delete process.env.REDIS_AUTH_SECRET;
    delete process.env.N8N_API_KEY;
  });

  afterAll(() => {
    if (originalRedisSecret === undefined) {
      delete process.env.REDIS_AUTH_SECRET;
    } else {
      process.env.REDIS_AUTH_SECRET = originalRedisSecret;
    }
    if (originalN8nKey === undefined) {
      delete process.env.N8N_API_KEY;
    } else {
      process.env.N8N_API_KEY = originalN8nKey;
    }
  });

  it('fails closed when no secret is configured', async () => {
    const res = await GET(createRequest({ authorization: 'Bearer anything' }));

    expect(res.status).toBe(401);
  });

  it('rejects a mismatched secret', async () => {
    process.env.REDIS_AUTH_SECRET = 'correct-secret';

    const res = await GET(createRequest({ authorization: 'Bearer wrong-secret' }));

    expect(res.status).toBe(401);
  });

  it('accepts a matching bearer token', async () => {
    process.env.REDIS_AUTH_SECRET = 'correct-secret';

    const res = await GET(createRequest({ authorization: 'Bearer correct-secret' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(1);
  });

  it('accepts a matching X-N8N-API-KEY header', async () => {
    process.env.REDIS_AUTH_SECRET = 'correct-secret';

    const res = await GET(createRequest({ 'x-n8n-api-key': 'correct-secret' }));

    expect(res.status).toBe(200);
  });
});
