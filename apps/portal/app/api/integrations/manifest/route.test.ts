/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@/lib/integrations/service', () => ({
  listActiveMcpIntegrations: jest.fn(),
}));

const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase');
const { listActiveMcpIntegrations } = jest.requireMock('@/lib/integrations/service');

describe('GET /api/integrations/manifest', () => {
  const ORIGINAL_TOKEN = process.env.INTEGRATIONS_MANIFEST_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTEGRATIONS_MANIFEST_TOKEN = 'test-manifest-secret-token';
  });

  afterAll(() => {
    process.env.INTEGRATIONS_MANIFEST_TOKEN = ORIGINAL_TOKEN;
  });

  it('rejects unauthenticated requests without token or admin session', async () => {
    getAuthenticatedEmployee.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3000/api/integrations/manifest');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('emits env_refs only (never plaintext secrets) when authorized by token', async () => {
    listActiveMcpIntegrations.mockResolvedValue([
      {
        slug: 'sentry',
        catalog: { server_url: 'https://mcp.sentry.dev/mcp', auth_type: 'bearer' },
        installation: { config: {}, tool_cache: { tools: [{ name: 'issues' }] } },
        managed: { credentialCiphertext: 'encrypted-blob' },
      },
    ]);
    const req = new NextRequest('http://localhost:3000/api/integrations/manifest', {
      headers: { authorization: 'Bearer test-manifest-secret-token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.env).toBeUndefined();
    expect(body.env_refs).toEqual(['ARCH_INTEGRATION_SENTRY']);
    expect(body.servers.sentry.headers).toEqual({
      Authorization: 'Bearer $' + '{ARCH_INTEGRATION_SENTRY}',
    });
  });
});
