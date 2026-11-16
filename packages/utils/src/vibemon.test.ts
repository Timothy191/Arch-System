import {
  callVibemonMcpTool,
  checkVibemonHealth,
  emitVibemonHookEvent,
  LOCAL_VIBEMON_API_KEY,
  resolveVibemonKeyMode,
} from './vibemon';

describe('@repo/utils/vibemon', () => {
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

  it('resolves key mode accurately across unconfigured, local-only, and remote keys', () => {
    delete process.env.VIBEMON_API_KEY;
    expect(resolveVibemonKeyMode()).toBe('unconfigured');
    expect(resolveVibemonKeyMode('invalid_prefix')).toBe('unconfigured');
    expect(resolveVibemonKeyMode(LOCAL_VIBEMON_API_KEY)).toBe('local-only');
    expect(resolveVibemonKeyMode('vbm_remote_test_key_1234567890')).toBe('remote');
  });

  it('returns healthy optional status in local-only mode without issuing network requests', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const health = await checkVibemonHealth({
      apiKey: LOCAL_VIBEMON_API_KEY,
      localLedgerEvents: 9,
    });

    expect(health.status).toBe('healthy');
    expect(health.optional).toBe(true);
    expect(health.keyMode).toBe('local-only');
    expect(health.localLedgerEvents).toBe(9);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('parses SSE JSON-RPC responses from VibeMon MCP and aggregates health metrics', async () => {
    global.fetch = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        readonly params?: { readonly name?: string };
      };
      const toolName = body.params?.name;
      const payloads: Record<string, unknown> = {
        team_list: {
          teams: [{ team_id: '9ac6749c-116d-410c-9bac-d2dc96bf2876', name: 'Arch' }],
        },
        todo_list: { count: 3, todos: [] },
        session_list: { sessions: [{ state: 'active' }, { state: 'active' }] },
      };
      const sseBody = `event: message\ndata: ${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: {
          structuredContent: payloads[toolName ?? ''] ?? {},
        },
      })}\n\n`;
      return {
        ok: true,
        status: 200,
        text: async () => sseBody,
      };
    }) as unknown as typeof fetch;

    const health = await checkVibemonHealth({
      apiKey: 'vbm_remote_test_key_1234567890',
      localLedgerEvents: 10,
    });

    expect(health.status).toBe('healthy');
    expect(health.keyMode).toBe('remote');
    expect(health.activeTeamId).toBe('9ac6749c-116d-410c-9bac-d2dc96bf2876');
    expect(health.openTodosCount).toBe(3);
    expect(health.activeSessionsCount).toBe(2);
    expect(health.error).toBeNull();
  });

  it('handles MCP errors gracefully without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway',
    }) as unknown as typeof fetch;

    const mcpOutcome = await callVibemonMcpTool<{ readonly ok: boolean }>({
      toolName: 'team_list',
      apiKey: 'vbm_remote_test_key_1234567890',
    });

    expect(mcpOutcome.isSuccess).toBe(false);
    expect(mcpOutcome.httpStatus).toBe(502);
    expect(mcpOutcome.error).toContain('502');
  });

  it('emits sanitized v2 hook envelopes for remote keys and skips unconfigured keys', async () => {
    delete process.env.VIBEMON_API_KEY;
    const skipped = await emitVibemonHookEvent({
      event: 'activity',
      agent: 'antigravity',
      cwd: '/workspace/Arch-System',
    });
    expect(skipped.isSkipped).toBe(true);
    expect(skipped.isSuccess).toBe(false);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    const delivered = await emitVibemonHookEvent({
      event: 'session_start',
      agent: 'antigravity',
      cwd: '/workspace/Arch-System',
      apiKey: 'vbm_remote_test_key_1234567890',
      repoIdentifier: 'timothy191/arch-system',
      branch: 'main',
    });
    expect(delivered.isSuccess).toBe(true);
    expect(delivered.isSkipped).toBe(false);
    expect(delivered.httpStatus).toBe(200);
  });
});
