/**
 * @jest-environment node
 */

import {
  evaluateIntegrationTriggerRules,
  invokeIntegrationTool,
  listEmployeeTools,
  resetIntegrationCircuitBreaker,
} from './tool-bridge';

jest.mock('@/lib/integrations/service', () => ({
  listActiveMcpIntegrations: jest.fn(),
  writeAuditLog: jest.fn(),
}));

jest.mock('@/lib/integrations/mcp-client-manager', () => ({
  mcpClientManager: {
    callTool: jest.fn(),
  },
}));

const { listActiveMcpIntegrations, writeAuditLog } = jest.requireMock('@/lib/integrations/service');
const { mcpClientManager } = jest.requireMock('@/lib/integrations/mcp-client-manager');

const INSTALLATION_ID = '22222222-2222-4222-a222-222222222222';

function activeIntegration(overrides: Record<string, unknown> = {}) {
  return {
    installation: {
      id: INSTALLATION_ID,
      catalog_id: 'sixtyfour-intelligence',
      scope: 'global',
      department_id: null,
      status: 'active',
      config: {},
      tool_allowlist: ['lookup_company', 'enrich_contact'],
      tool_cache: {
        tools: [
          { name: 'lookup_company', description: 'Look up a company', inputSchema: {} },
          { name: 'enrich_contact', description: 'Enrich a contact', inputSchema: {} },
        ],
      },
      tools_synced_at: '2026-10-01T00:00:00Z',
      last_error: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: null,
      ...overrides,
    },
    slug: 'sixtyfour-intelligence',
    catalog: { id: 'sixtyfour-intelligence', kind: 'mcp' },
    managed: { id: INSTALLATION_ID, serverUrl: 'https://mcp.example/mcp', config: {} },
  };
}

const CALLER = {
  employeeId: 'employee-1',
  departmentId: '11111111-1111-4111-a111-111111111111',
};

beforeEach(() => {
  jest.clearAllMocks();
  resetIntegrationCircuitBreaker();
  listActiveMcpIntegrations.mockResolvedValue([activeIntegration()]);
  mcpClientManager.callTool.mockResolvedValue({
    content: [{ type: 'text', text: '{"result": "ok"}' }],
  });
});

describe('invokeIntegrationTool', () => {
  it('rejects malformed tool names', async () => {
    const result = await invokeIntegrationTool({ ...CALLER, tool: 'not_namespaced', kind: 'read' });
    expect(result.ok).toBe(false);
    expect(mcpClientManager.callTool).not.toHaveBeenCalled();
  });

  it('executes a read tool through the happy path and audits success', async () => {
    const result = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      args: { domain: 'example.com' },
      kind: 'read',
    });

    expect(result.ok).toBe(true);
    expect(mcpClientManager.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: INSTALLATION_ID }),
      'lookup_company',
      { domain: 'example.com' }
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', toolName: 'lookup_company' })
    );
  });

  it('denies tools not on the installation allowlist', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({ tool_allowlist: ['lookup_company'] }),
    ]);

    const result = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__enrich_contact',
      kind: 'read',
    });

    expect(result.ok).toBe(false);
    expect(mcpClientManager.callTool).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ status: 'denied' }));
  });

  it('denies write-class tools arriving on the read path', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({ config: { risk_class: 'write' } }),
    ]);

    const result = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });

    expect(result.ok).toBe(false);
    expect(mcpClientManager.callTool).not.toHaveBeenCalled();
  });

  it('executes write-class tools on the confirmed write path', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({ config: { risk_class: 'write' } }),
    ]);

    const result = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'write',
    });

    expect(result.ok).toBe(true);
    expect(mcpClientManager.callTool).toHaveBeenCalled();
  });

  it('denies department-scoped installations serving another department', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({
        scope: 'department',
        department_id: '99999999-9999-4999-a999-999999999999',
      }),
    ]);

    const result = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });

    expect(result.ok).toBe(false);
    expect(mcpClientManager.callTool).not.toHaveBeenCalled();
  });

  it('reports tool-reported execution errors without throwing', async () => {
    mcpClientManager.callTool.mockResolvedValue({ isError: true, content: [] });

    const result = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });

    expect(result.ok).toBe(false);
  });

  it('rate-limits after the per-employee call budget is exhausted', async () => {
    const tool = 'integration__sixtyfour-intelligence__lookup_company';
    let last: { ok: boolean };
    for (let i = 0; i < 31; i++) {
      last = await invokeIntegrationTool({
        ...CALLER,
        employeeId: 'rate-limited-employee',
        tool,
        kind: 'read',
      });
    }
    expect(last!.ok).toBe(false);
    expect(last!.error).toMatch(/rate limit/i);
  });

  it('rejects tool args that fail inputSchema validation', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({
        tool_cache: {
          tools: [
            {
              name: 'lookup_company',
              description: 'Look up a company',
              inputSchema: {
                type: 'object',
                required: ['query'],
                properties: { query: { type: 'string' } },
              },
            },
            { name: 'enrich_contact', description: 'Enrich a contact', inputSchema: {} },
          ],
        },
      }),
    ]);

    const result = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      args: {},
      kind: 'read',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Missing required argument/);
    expect(mcpClientManager.callTool).not.toHaveBeenCalled();
  });
});

describe('listEmployeeTools', () => {
  it('namespaces cached tools as integration__<slug>__<tool> with risk class', async () => {
    const tools = await listEmployeeTools(CALLER.departmentId);
    expect(tools).toHaveLength(2);
    expect(tools[0].qualifiedName).toBe('integration__sixtyfour-intelligence__lookup_company');
    expect(tools[0].riskClass).toBe('read');
  });

  it('elevates tool riskClass to write when write_tool_overrides or require_human_approval is set', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({
        config: {
          risk_class: 'read',
          rules: { write_tool_overrides: ['enrich_contact'] },
        },
      }),
    ]);
    const tools = await listEmployeeTools(CALLER.departmentId);
    expect(tools.find((t) => t.toolName === 'lookup_company')?.riskClass).toBe('read');
    expect(tools.find((t) => t.toolName === 'enrich_contact')?.riskClass).toBe('write');
  });
});

describe('4-Pillar Integration Policy & Governance Rules', () => {
  it('enforces Access & Governance rules: allowed_roles and active_shift window', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({
        config: {
          rules: {
            allowed_roles: ['admin', 'supervisor'],
            active_shift: 'day',
          },
        },
      }),
    ]);

    const deniedRole = await invokeIntegrationTool({
      ...CALLER,
      employeeRole: 'operator',
      currentHour: 10,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });
    expect(deniedRole.ok).toBe(false);
    expect(deniedRole.error).toMatch(/Role "operator" is not permitted/);

    const deniedShift = await invokeIntegrationTool({
      ...CALLER,
      employeeRole: 'supervisor',
      currentHour: 22,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });
    expect(deniedShift.ok).toBe(false);
    expect(deniedShift.error).toMatch(/day shift window/);

    const allowed = await invokeIntegrationTool({
      ...CALLER,
      employeeRole: 'supervisor',
      currentHour: 11,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });
    expect(allowed.ok).toBe(true);
  });

  it('enforces Tool & Payload Policy rules: blocked_arg_keys, redact_fields, and max_payload_bytes', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({
        config: {
          rules: {
            blocked_arg_keys: ['raw_sql'],
            redact_fields: ['api_token'],
            max_payload_bytes: 256,
          },
        },
      }),
    ]);

    const blockedKeyRes = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      args: { raw_sql: 'DROP TABLE employees;' },
      kind: 'read',
    });
    expect(blockedKeyRes.ok).toBe(false);
    expect(blockedKeyRes.error).toMatch(/Argument "raw_sql" is blocked/);

    const oversizedRes = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      args: { query: 'x'.repeat(400) },
      kind: 'read',
    });
    expect(oversizedRes.ok).toBe(false);
    expect(oversizedRes.error).toMatch(/exceeds policy limit/);

    const redactedRes = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      args: { domain: 'plantcor.app', api_token: 'secret-123' },
      kind: 'read',
    });
    expect(redactedRes.ok).toBe(true);
    expect(mcpClientManager.callTool).toHaveBeenCalledWith(expect.anything(), 'lookup_company', {
      domain: 'plantcor.app',
      api_token: '[REDACTED]',
    });
  });

  it('enforces Network & Egress rules: egress_domain_allowlist and circuit_breaker_threshold', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({
        config: {
          rules: {
            egress_domain_allowlist: ['trusted.plantcor.app'],
          },
        },
      }),
    ]);

    const egressDenied = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });
    expect(egressDenied.ok).toBe(false);
    expect(egressDenied.error).toMatch(/not permitted by the integration egress allowlist/);

    // Now test circuit breaker tripping after 2 consecutive upstream errors
    listActiveMcpIntegrations.mockResolvedValue([
      activeIntegration({
        config: {
          rules: {
            circuit_breaker_threshold: 2,
          },
        },
      }),
    ]);
    mcpClientManager.callTool.mockResolvedValue({ isError: true, content: [] });

    await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });
    await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });

    const tripped = await invokeIntegrationTool({
      ...CALLER,
      tool: 'integration__sixtyfour-intelligence__lookup_company',
      kind: 'read',
    });
    expect(tripped.ok).toBe(false);
    expect(tripped.error).toMatch(/circuit breaker is open/i);
  });

  it('evaluates Event & Threshold Trigger rules accurately', () => {
    const rules = {
      trigger_events: ['breakdown.created', 'plant.density_excursion'],
      threshold_metric: 'cycloneRd',
      threshold_operator: 'gt' as const,
      threshold_value: 1.52,
    };

    expect(
      evaluateIntegrationTriggerRules({
        rules,
        eventName: 'breakdown.created',
      })
    ).toBe(true);

    expect(
      evaluateIntegrationTriggerRules({
        rules,
        metrics: { cycloneRd: 1.55 },
      })
    ).toBe(true);

    expect(
      evaluateIntegrationTriggerRules({
        rules,
        eventName: 'shift.started',
        metrics: { cycloneRd: 1.48 },
      })
    ).toBe(false);
  });
});
