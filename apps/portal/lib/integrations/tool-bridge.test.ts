/**
 * @jest-environment node
 */

import { invokeIntegrationTool, listEmployeeTools } from './tool-bridge';

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
      tool_allowlist: [],
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
});

describe('listEmployeeTools', () => {
  it('namespaces cached tools as integration__<slug>__<tool> with risk class', async () => {
    const tools = await listEmployeeTools(CALLER.departmentId);
    expect(tools).toHaveLength(2);
    expect(tools[0].qualifiedName).toBe('integration__sixtyfour-intelligence__lookup_company');
    expect(tools[0].riskClass).toBe('read');
  });
});
