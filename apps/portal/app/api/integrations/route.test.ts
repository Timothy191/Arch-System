/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@/lib/integrations/service', () => ({
  listCatalog: jest.fn(),
  listInstallations: jest.fn(),
  installIntegration: jest.fn(),
}));

const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase');
const { listCatalog, listInstallations, installIntegration } = jest.requireMock(
  '@/lib/integrations/service'
);

const GLOBAL_INSTALLATION = {
  id: '22222222-2222-4222-a222-222222222222',
  catalog_id: 'sixtyfour-intelligence',
  scope: 'global',
  department_id: null,
  status: 'active',
  config: {},
  tool_allowlist: [],
  tool_cache: null,
  tools_synced_at: null,
  last_error: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: null,
};

function principal(role: string, departmentId = '11111111-1111-4111-a111-111111111111') {
  return {
    user: { id: 'user-1', email: 'user@example.com' },
    employee: { id: 'emp-1', role, department_id: departmentId, accessible_departments: [] },
  };
}

function buildRequest(method: 'GET' | 'POST', body?: unknown) {
  return new NextRequest('http://localhost:3000/api/integrations', {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
      : {}),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/integrations', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedEmployee.mockResolvedValue(null);
    const response = await GET(buildRequest('GET'));
    expect(response.status).toBe(401);
  });

  it('returns catalog and all installations for admins', async () => {
    getAuthenticatedEmployee.mockResolvedValue(principal('admin'));
    listCatalog.mockResolvedValue([{ id: 'sixtyfour-intelligence', name: 'SixtyFour' }]);
    listInstallations.mockResolvedValue([GLOBAL_INSTALLATION]);

    const response = await GET(buildRequest('GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.catalog).toHaveLength(1);
    expect(data.installations).toHaveLength(1);
  });

  it('filters department-scoped installations away from other departments', async () => {
    getAuthenticatedEmployee.mockResolvedValue(principal('supervisor'));
    listCatalog.mockResolvedValue([]);
    listInstallations.mockResolvedValue([
      GLOBAL_INSTALLATION,
      {
        ...GLOBAL_INSTALLATION,
        id: '33333333-3333-4333-a333-333333333333',
        scope: 'department',
        department_id: '99999999-9999-4999-a999-999999999999',
      },
    ]);

    const response = await GET(buildRequest('GET'));
    const data = await response.json();

    expect(data.installations).toHaveLength(1);
    expect(data.installations[0].scope).toBe('global');
  });
});

describe('POST /api/integrations', () => {
  it('returns 403 for non-admins', async () => {
    getAuthenticatedEmployee.mockResolvedValue(principal('supervisor'));
    const response = await POST(buildRequest('POST', { catalog_id: 'x' }));
    expect(response.status).toBe(403);
  });

  it('returns 400 for an invalid payload', async () => {
    getAuthenticatedEmployee.mockResolvedValue(principal('admin'));
    const response = await POST(buildRequest('POST', { catalog_id: 'Bad Slug!' }));
    expect(response.status).toBe(400);
  });

  it('installs with inline catalog registration and secret', async () => {
    getAuthenticatedEmployee.mockResolvedValue(principal('admin'));
    listCatalog.mockResolvedValue([]);
    listInstallations.mockResolvedValue([]);
    installIntegration.mockResolvedValue({
      ...GLOBAL_INSTALLATION,
      status: 'pending',
      catalog_id: 'windsor-ai',
    });

    const response = await POST(
      buildRequest('POST', {
        catalog_id: 'windsor-ai',
        catalog_entry: {
          name: 'Windsor AI',
          kind: 'mcp',
          server_url: 'https://mcp.windsor.ai/mcp',
          auth_type: 'bearer',
        },
        scope: 'global',
        secret: 'sk-live-windsor-key',
        secret_kind: 'bearer',
        config: { risk_class: 'read' },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(installIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        catalog_id: 'windsor-ai',
        scope: 'global',
        secret: 'sk-live-windsor-key',
      }),
      'user-1'
    );
    expect(data.installation.catalog_id).toBe('windsor-ai');
  });

  it('rejects department scope without department_id', async () => {
    getAuthenticatedEmployee.mockResolvedValue(principal('admin'));
    const response = await POST(
      buildRequest('POST', { catalog_id: 'windsor-ai', scope: 'department' })
    );
    expect(response.status).toBe(400);
  });
});
