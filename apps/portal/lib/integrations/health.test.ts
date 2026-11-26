/**
 * @jest-environment node
 */

import { checkInstallationHealth } from './health';

jest.mock('./service', () => ({
  getInstallation: jest.fn(),
  toManagedInstallation: jest.fn(),
  updateInstallation: jest.fn(),
}));

jest.mock('./mcp-client-manager', () => ({
  mcpClientManager: {
    listTools: jest.fn(),
  },
}));

const { getInstallation, toManagedInstallation, updateInstallation } =
  jest.requireMock('./service');
const { mcpClientManager } = jest.requireMock('./mcp-client-manager');

describe('checkInstallationHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unhealthy when installation is disabled', async () => {
    getInstallation.mockResolvedValue({ id: 'inst-1', status: 'disabled' });
    const res = await checkInstallationHealth('inst-1');
    expect(res.status).toBe('unhealthy');
    expect(res.error).toContain('disabled');
  });

  it('returns healthy and updates status on successful listTools', async () => {
    getInstallation.mockResolvedValue({
      id: 'inst-1',
      status: 'active',
      tools_synced_at: new Date().toISOString(),
    });
    toManagedInstallation.mockResolvedValue({
      id: 'inst-1',
      serverUrl: 'https://mcp.sentry.dev/mcp',
    });
    mcpClientManager.listTools.mockResolvedValue([{ name: 'issues' }]);

    const res = await checkInstallationHealth('inst-1');
    expect(res.status).toBe('healthy');
    expect(updateInstallation).toHaveBeenCalledWith('inst-1', {
      status: 'active',
      last_error: null,
    });
  });

  it('marks installation error when listTools fails', async () => {
    getInstallation.mockResolvedValue({ id: 'inst-1', status: 'active', tools_synced_at: null });
    toManagedInstallation.mockResolvedValue({
      id: 'inst-1',
      serverUrl: 'https://mcp.sentry.dev/mcp',
    });
    mcpClientManager.listTools.mockRejectedValue(new Error('Upstream unreachable'));

    const res = await checkInstallationHealth('inst-1');
    expect(res.status).toBe('unhealthy');
    expect(res.error).toBe('Upstream unreachable');
    expect(updateInstallation).toHaveBeenCalledWith('inst-1', {
      status: 'error',
      last_error: 'Upstream unreachable',
    });
  });

  it('probes SSRF-guarded action and Prometheus adapters without calling MCP listTools', async () => {
    getInstallation.mockResolvedValue({
      id: 'inst-prom',
      catalog_id: 'prometheus',
      status: 'active',
      tools_synced_at: new Date().toISOString(),
    });
    toManagedInstallation.mockResolvedValue({
      id: 'inst-prom',
      kind: 'action',
      serverUrl: 'https://prometheus.plantcor.example',
      authType: 'none',
      credentialCiphertext: null,
      capabilities: { adapter: 'prometheus' },
      config: {},
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const res = await checkInstallationHealth('inst-prom');
    expect(res.status).toBe('healthy');
    expect(mcpClientManager.listTools).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://prometheus.plantcor.example/-/healthy',
      expect.any(Object)
    );
    fetchSpy.mockRestore();
  });
});
