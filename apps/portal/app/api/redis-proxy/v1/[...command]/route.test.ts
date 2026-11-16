/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const HTTP_OK_STATUS = 200;
const HTTP_UNAUTHORIZED_STATUS = 401;
const TEST_SECRET = 'command-route-redis-secret-2026';
const BASE_URL = 'http://localhost:3000/api/redis-proxy/v1';

const mockExecuteCommand = jest.fn(
  (command: string, args: readonly string[]) => `${command}:${args.join(',')}`
);

jest.mock('@/lib/redis-engine', () => ({
  redisEngine: {
    executeCommand: (command: string, args: string[]) => mockExecuteCommand(command, args),
  },
}));

describe('Given /api/redis-proxy/v1/[...command]', () => {
  const originalRedisSecret = process.env.REDIS_AUTH_SECRET;
  const originalN8nKey = process.env.N8N_API_KEY;

  beforeEach(() => {
    process.env.REDIS_AUTH_SECRET = TEST_SECRET;
    delete process.env.N8N_API_KEY;
    mockExecuteCommand.mockClear();
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

  it('When unauthenticated or secret is unset, Then GET and POST fail closed with 401', async () => {
    delete process.env.REDIS_AUTH_SECRET;
    const unconfiguredGet = await GET(new NextRequest(`${BASE_URL}/ping`), {
      params: Promise.resolve({ command: ['ping'] }),
    });
    const unconfiguredPost = await POST(
      new NextRequest(`${BASE_URL}/set`, { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ command: ['set'] }) }
    );
    expect(unconfiguredGet.status).toBe(HTTP_UNAUTHORIZED_STATUS);
    expect(unconfiguredPost.status).toBe(HTTP_UNAUTHORIZED_STATUS);

    process.env.REDIS_AUTH_SECRET = TEST_SECRET;
    const invalidPost = await POST(
      new NextRequest(`${BASE_URL}/set`, {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-token' },
        body: JSON.stringify({ args: ['k', 'v'] }),
      }),
      { params: Promise.resolve({ command: ['set'] }) }
    );
    expect(invalidPost.status).toBe(HTTP_UNAUTHORIZED_STATUS);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('When POST /set receives single command segment with body.args, Then body.args is forwarded without being shadowed', async () => {
    const req = new NextRequest(`${BASE_URL}/set`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ args: ['sensor:1', 'online'] }),
    });

    const res = await POST(req, { params: Promise.resolve({ command: ['set'] }) });
    const body = await res.json();

    expect(res.status).toBe(HTTP_OK_STATUS);
    expect(mockExecuteCommand).toHaveBeenCalledWith('set', ['sensor:1', 'online']);
    expect(body).toEqual({ result: 'set:sensor:1,online' });
  });

  it('When POST receives URL argument segments, Then decoded URL args take precedence', async () => {
    const req = new NextRequest(`${BASE_URL}/set/sensor%3A2/standby`, {
      method: 'POST',
      headers: {
        'x-redis-token': TEST_SECRET,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ args: ['ignored'] }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ command: ['set', 'sensor%3A2', 'standby'] }),
    });
    expect(res.status).toBe(HTTP_OK_STATUS);
    expect(mockExecuteCommand).toHaveBeenCalledWith('set', ['sensor:2', 'standby']);
  });
});
