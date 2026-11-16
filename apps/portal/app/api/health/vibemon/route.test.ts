/**
 * @jest-environment node
 */

import { vibemonHealthResponseSchema } from '@repo/contract';
import { LOCAL_VIBEMON_API_KEY } from '@repo/utils/vibemon';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/health/vibemon', () => {
  const originalFetch = global.fetch;
  const originalEnvKey = process.env.VIBEMON_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnvKey === undefined) {
      delete process.env.VIBEMON_API_KEY;
    } else {
      process.env.VIBEMON_API_KEY = originalEnvKey;
    }
    jest.restoreAllMocks();
  });

  it('returns HTTP 200 validated payload in local-only mode without leaking credentials', async () => {
    process.env.VIBEMON_API_KEY = LOCAL_VIBEMON_API_KEY;
    const request = new NextRequest('http://localhost:3000/api/health/vibemon', {
      method: 'GET',
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    const parsed = vibemonHealthResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body.optional).toBe(true);
    expect(body.keyMode).toBe('local-only');
    expect(JSON.stringify(body)).not.toContain(LOCAL_VIBEMON_API_KEY);
  });

  it('returns HTTP 200 with remote team and TODO telemetry when remote key is configured', async () => {
    const mockSecretKey = 'vbm_unit_test_secret_0000000000000000';
    process.env.VIBEMON_API_KEY = mockSecretKey;

    global.fetch = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const rpcBody = JSON.parse(String(init?.body ?? '{}')) as {
        readonly params?: { readonly name?: string };
      };
      const toolName = rpcBody.params?.name ?? '';
      const structuredMap: Record<string, unknown> = {
        team_list: {
          teams: [{ team_id: '9ac6749c-116d-410c-9bac-d2dc96bf2876', name: 'Arch' }],
        },
        todo_list: { count: 4 },
        session_list: { sessions: [{ state: 'active' }] },
      };
      return {
        ok: true,
        status: 200,
        text: async () =>
          `event: message\ndata: ${JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { structuredContent: structuredMap[toolName] ?? {} },
          })}\n\n`,
      };
    }) as unknown as typeof fetch;

    const request = new NextRequest('http://localhost:3000/api/health/vibemon', {
      method: 'GET',
    });
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(vibemonHealthResponseSchema.safeParse(body).success).toBe(true);
    expect(body.status).toBe('healthy');
    expect(body.keyMode).toBe('remote');
    expect(body.details.activeTeamId).toBe('9ac6749c-116d-410c-9bac-d2dc96bf2876');
    expect(body.details.openTodosCount).toBe(4);
    expect(body.details.activeSessionsCount).toBe(1);
    expect(JSON.stringify(body)).not.toContain(mockSecretKey);
  });
});
