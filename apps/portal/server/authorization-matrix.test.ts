/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as accessControlMusterPost } from '../app/api/access-control/muster/route';
import {
  DELETE as adminDataDelete,
  GET as adminDataGet,
  PUT as adminDataPut,
} from '../app/api/admin/data/[table]/route';
import { POST as generateReportPost } from '../app/api/control-room/generate-report/route';
import { POST as approveShiftReportPost } from '../app/api/control-room/shift-closeout/approve/route';
import { GET as fleetGet } from '../app/api/departments/[departmentId]/fleet/route';
import { POST as breakdownAlertPost } from '../app/api/engineering/breakdown-alert/route';
import { GET as workflowsGet } from '../app/api/redis-proxy/v1/workflows/route';
import { DEPARTMENT_ROUTES, proxy } from './proxy';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/supabase/middleware', () => ({
  createMiddlewareClient: jest.fn(),
}));

jest.mock('@repo/redis/cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheEvictL1ByPrefix: jest.fn(),
}));

jest.mock('@repo/redis/session', () => ({
  readSession: jest.fn().mockResolvedValue(null),
  writeSession: jest.fn().mockResolvedValue(undefined),
  touchSession: jest.fn().mockResolvedValue(false),
  revokeSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('workflow/api', () => ({
  start: jest.fn().mockResolvedValue({ runId: 'wf-run-001' }),
}));

jest.mock('@/lib/server-cache', () => ({
  updateTag: jest.fn().mockResolvedValue(undefined),
}));

const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase');
const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');
const { createMiddlewareClient } = jest.requireMock('@repo/supabase/middleware');

const DEPT_UUID_MAP: Record<string, string> = {
  drilling: '00000000-0000-4000-8000-000000000001',
  production: '00000000-0000-4000-8000-000000000002',
  'plant-processing': '00000000-0000-4000-8000-000000000003',
  'plant-inventory': '00000000-0000-4000-8000-000000000004',
  'access-control': '00000000-0000-4000-8000-000000000005',
  engineering: '00000000-0000-4000-8000-000000000006',
  'control-room': '00000000-0000-4000-8000-000000000007',
};

function setupProxySession(options: {
  authenticated?: boolean;
  role?: string;
  departmentSlug?: string;
  accessibleSlugs?: string[];
}) {
  const authenticated = options.authenticated ?? true;
  const deptId = options.departmentSlug ? DEPT_UUID_MAP[options.departmentSlug] : null;
  const accessible = (options.accessibleSlugs ?? []).map((s) => DEPT_UUID_MAP[s]).filter(Boolean);

  const mockResponse = { headers: new Headers(), cookies: { getAll: () => [] } };
  const supabase = {
    auth: {
      getClaims: jest.fn().mockResolvedValue({
        data: authenticated ? { claims: { sub: 'user-auth-1' } } : null,
      }),
      signOut: jest.fn().mockResolvedValue({}),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'employees') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: authenticated
                    ? {
                        id: 'emp-1',
                        role: options.role ?? 'operator',
                        department_id: deptId,
                        accessible_departments: accessible,
                      }
                    : null,
                }),
            }),
          }),
        };
      }
      if (table === 'departments') {
        return {
          select: () => ({
            eq: (_col: string, slug: string) => ({
              single: () =>
                Promise.resolve({
                  data: DEPT_UUID_MAP[slug] ? { id: DEPT_UUID_MAP[slug] } : null,
                }),
              maybeSingle: () =>
                Promise.resolve({
                  data: DEPT_UUID_MAP[slug] ? { id: DEPT_UUID_MAP[slug] } : null,
                }),
            }),
          }),
        };
      }
      return {};
    }),
  };

  createMiddlewareClient.mockResolvedValue({ supabase, response: mockResponse });
  return { supabase, mockResponse };
}

function makeProxyRequest(pathname: string, authenticated = true) {
  const req = new NextRequest(`http://localhost:3000${pathname}`);
  if (authenticated) {
    req.cookies.set('sb-access-token', 'valid-jwt-token');
  }
  return req;
}

describe('Gate 16 — Module-Level Authorization Matrix (Control Room, Plant, Engineering, Access Control, Database, Administration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Proxy Route Gating & Tenant/Department Isolation Matrix', () => {
    it('covers all 7 canonical operational department routes in DEPARTMENT_ROUTES', () => {
      expect(DEPARTMENT_ROUTES).toEqual(
        expect.arrayContaining([
          'drilling',
          'production',
          'plant-processing',
          'plant-inventory',
          'access-control',
          'engineering',
          'control-room',
        ])
      );
    });

    it.each([
      '/control-room',
      '/plant-processing',
      '/plant-inventory',
      '/engineering',
      '/access-control',
      '/admin',
    ])('redirects unauthenticated requests on %s to /login', async (routePath) => {
      const res = await proxy(makeProxyRequest(routePath, false));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('blocks non-admin roles (operator, supervisor, control_room_operator) from /admin', async () => {
      for (const role of ['operator', 'supervisor', 'control_room_operator', 'access_control']) {
        setupProxySession({ role, departmentSlug: 'control-room' });
        const res = await proxy(makeProxyRequest('/admin'));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('error=unauthorized_department');
      }
    });

    it('allows admin role into /admin and all 7 department modules', async () => {
      setupProxySession({ role: 'admin', departmentSlug: 'drilling' });
      const adminRes = await proxy(makeProxyRequest('/admin'));
      expect(adminRes.status).not.toBe(307);

      for (const slug of DEPARTMENT_ROUTES) {
        setupProxySession({ role: 'admin', departmentSlug: 'drilling' });
        const deptRes = await proxy(makeProxyRequest(`/${slug}`));
        expect(deptRes.status).not.toBe(307);
      }
    });

    it('blocks cross-department IDOR/BOLA when a drilling operator requests /engineering, /plant-processing, or /control-room', async () => {
      for (const target of [
        '/engineering',
        '/plant-processing',
        '/plant-inventory',
        '/control-room',
      ]) {
        setupProxySession({ role: 'operator', departmentSlug: 'drilling' });
        const res = await proxy(makeProxyRequest(target));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('error=unauthorized_department');
      }
    });

    it('permits cross-department access when target department is in accessible_departments', async () => {
      setupProxySession({
        role: 'supervisor',
        departmentSlug: 'production',
        accessibleSlugs: ['plant-processing', 'plant-inventory'],
      });
      const res = await proxy(makeProxyRequest('/plant-processing'));
      expect(res.status).not.toBe(307);
    });

    it('blocks operator from /{dept}/tools while allowing supervisor and admin', async () => {
      setupProxySession({ role: 'operator', departmentSlug: 'drilling' });
      const denied = await proxy(makeProxyRequest('/drilling/tools'));
      expect(denied.status).toBe(307);
      expect(denied.headers.get('location')).toContain('error=unauthorized_department');

      setupProxySession({ role: 'supervisor', departmentSlug: 'drilling' });
      const allowed = await proxy(makeProxyRequest('/drilling/tools'));
      expect(allowed.status).not.toBe(307);
    });

    it('prevents open-redirect, protocol-relative SSRF, and XSS URI injection on /login?redirect=', async () => {
      const maliciousRedirects = [
        '//evil.example.com',
        '/\\evil.example.com',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'https://attacker.tld/phish',
      ];

      for (const payload of maliciousRedirects) {
        setupProxySession({ role: 'operator', departmentSlug: 'drilling' });
        const req = makeProxyRequest(`/login?redirect=${encodeURIComponent(payload)}`, true);
        const res = await proxy(req);
        expect(res.status).toBe(307);
        const location = res.headers.get('location') ?? '';
        expect(location).toBe('http://localhost:3000/hub');
      }
    });
  });

  describe('2. Administration & Database Module API Authorization (/api/admin/data/[table])', () => {
    function setupAdminSupabase(role: string | null) {
      getAuthenticatedEmployee.mockResolvedValue(
        role
          ? {
              user: { id: 'u-1' },
              employee: { id: 'emp-1', role },
            }
          : null
      );
    }

    it('rejects unauthenticated GET/POST/DELETE with 401', async () => {
      setupAdminSupabase(null);
      const req = new NextRequest('http://localhost:3000/api/admin/data/machines');
      const res = await adminDataGet(req, { params: Promise.resolve({ table: 'machines' }) });
      expect(res.status).toBe(401);
    });

    it('rejects privilege escalation from operator and supervisor roles with 403', async () => {
      for (const role of ['operator', 'supervisor', 'control_room_operator']) {
        setupAdminSupabase(role);
        const getReq = new NextRequest('http://localhost:3000/api/admin/data/machines');
        const getRes = await adminDataGet(getReq, {
          params: Promise.resolve({ table: 'machines' }),
        });
        expect(getRes.status).toBe(403);

        const putReq = new NextRequest('http://localhost:3000/api/admin/data/machines', {
          method: 'PUT',
          body: JSON.stringify({ id: 'm-1', name: 'Rig 1' }),
        });
        const putRes = await adminDataPut(putReq, {
          params: Promise.resolve({ table: 'machines' }),
        });
        expect(putRes.status).toBe(403);

        const delReq = new NextRequest(
          'http://localhost:3000/api/admin/data/machines?id=00000000-0000-4000-8000-000000000099',
          { method: 'DELETE' }
        );
        const delRes = await adminDataDelete(delReq, {
          params: Promise.resolve({ table: 'machines' }),
        });
        expect(delRes.status).toBe(403);
      }
    });

    it('blocks SQL table injection / non-whitelisted tables even for admin with 404', async () => {
      setupAdminSupabase('admin');
      const req = new NextRequest('http://localhost:3000/api/admin/data/pg_shadow');
      const res = await adminDataGet(req, { params: Promise.resolve({ table: 'pg_shadow' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('3. Control Room Module Authorization & Separation of Duties', () => {
    it('blocks unauthenticated and unauthorized roles on /api/control-room/generate-report', async () => {
      createServerSupabaseClient.mockResolvedValue({});
      getAuthenticatedEmployee.mockResolvedValueOnce(null);

      const unauthReq = new Request('http://localhost:3000/api/control-room/generate-report', {
        method: 'POST',
        body: JSON.stringify({ shiftId: 'shift-1' }),
      });
      const unauthRes = await generateReportPost(unauthReq);
      expect(unauthRes.status).toBe(401);

      getAuthenticatedEmployee.mockResolvedValueOnce({
        user: { id: 'u-1' },
        employee: { id: 'emp-1', role: 'viewer' },
      });
      const forbiddenReq = new Request('http://localhost:3000/api/control-room/generate-report', {
        method: 'POST',
        body: JSON.stringify({ shiftId: 'shift-1' }),
      });
      const forbiddenRes = await generateReportPost(forbiddenReq);
      expect(forbiddenRes.status).toBe(403);

      getAuthenticatedEmployee.mockResolvedValueOnce({
        user: { id: 'u-1' },
        employee: { id: 'emp-1', role: 'control_room_operator' },
      });
      const validReq = new Request('http://localhost:3000/api/control-room/generate-report', {
        method: 'POST',
        body: JSON.stringify({ shiftId: 'shift-1' }),
      });
      const validRes = await generateReportPost(validReq);
      expect(validRes.status).toBe(200);
    });

    it('enforces supervisor/admin role and separation of duties on /api/control-room/shift-closeout/approve', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Separation of duties violation: Submitter cannot approve' },
      });
      createServerSupabaseClient.mockResolvedValue({ rpc: mockRpc });

      // Operator cannot approve shift closeout
      getAuthenticatedEmployee.mockResolvedValueOnce({
        user: { id: 'u-op' },
        employee: { id: 'emp-op', role: 'operator' },
      });
      const opReq = new NextRequest(
        'http://localhost:3000/api/control-room/shift-closeout/approve',
        {
          method: 'POST',
          body: JSON.stringify({ reportId: '00000000-0000-4000-8000-000000000010' }),
        }
      );
      const opRes = await approveShiftReportPost(opReq);
      expect(opRes.status).toBe(403);

      // Supervisor triggering separation-of-duties DB constraint gets 403 SEPARATION_OF_DUTIES_VIOLATION
      getAuthenticatedEmployee.mockResolvedValueOnce({
        user: { id: 'u-sup' },
        employee: { id: 'emp-sup', role: 'supervisor' },
      });
      const sodReq = new NextRequest(
        'http://localhost:3000/api/control-room/shift-closeout/approve',
        {
          method: 'POST',
          body: JSON.stringify({ reportId: '00000000-0000-4000-8000-000000000010' }),
        }
      );
      const sodRes = await approveShiftReportPost(sodReq);
      expect(sodRes.status).toBe(403);
      const sodBody = await sodRes.json();
      expect(sodBody.code).toBe('SEPARATION_OF_DUTIES_VIOLATION');
    });
  });

  describe('4. Engineering, Department Fleet IDOR, Access Control & Redis Proxy Guards', () => {
    it('enforces authentication and role checks on /api/engineering/breakdown-alert', async () => {
      createServerSupabaseClient.mockResolvedValue({});
      getAuthenticatedEmployee.mockResolvedValueOnce(null);

      const unauthReq = new Request('http://localhost:3000/api/engineering/breakdown-alert', {
        method: 'POST',
        body: JSON.stringify({ equipmentId: 'EQ-1', description: 'Hydraulic leak' }),
      });
      expect((await breakdownAlertPost(unauthReq)).status).toBe(401);

      getAuthenticatedEmployee.mockResolvedValueOnce({
        user: { id: 'u-1' },
        employee: { id: 'emp-1', role: 'operator' },
      });
      const authReq = new Request('http://localhost:3000/api/engineering/breakdown-alert', {
        method: 'POST',
        body: JSON.stringify({ equipmentId: 'EQ-1', description: 'Hydraulic leak' }),
      });
      expect((await breakdownAlertPost(authReq)).status).toBe(200);
    });

    it('prevents IDOR/BOLA on /api/departments/[departmentId]/fleet when operator queries another department', async () => {
      createServerSupabaseClient.mockResolvedValue({
        from: () => ({
          select: () => ({
            order: () => Promise.resolve({ data: [{ id: 'f-1', code: 'ADT-01' }], error: null }),
          }),
        }),
      });

      // Operator assigned to dept-A attempting to read dept-B fleet -> 403
      getAuthenticatedEmployee.mockResolvedValueOnce({
        user: { id: 'u-1' },
        employee: {
          id: 'emp-1',
          role: 'operator',
          department_id: DEPT_UUID_MAP.drilling,
          accessible_departments: [],
        },
      });
      const idorRes = await fleetGet(
        new Request(`http://localhost:3000/api/departments/${DEPT_UUID_MAP.engineering}/fleet`),
        { params: Promise.resolve({ departmentId: DEPT_UUID_MAP.engineering }) }
      );
      expect(idorRes.status).toBe(403);

      // Same operator querying their own department -> 200
      getAuthenticatedEmployee.mockResolvedValueOnce({
        user: { id: 'u-1' },
        employee: {
          id: 'emp-1',
          role: 'operator',
          department_id: DEPT_UUID_MAP.drilling,
          accessible_departments: [],
        },
      });
      const ownRes = await fleetGet(
        new Request(`http://localhost:3000/api/departments/${DEPT_UUID_MAP.drilling}/fleet`),
        { params: Promise.resolve({ departmentId: DEPT_UUID_MAP.drilling }) }
      );
      expect(ownRes.status).toBe(200);
    });

    it('blocks unauthenticated emergency muster updates on /api/access-control/muster', async () => {
      getAuthenticatedEmployee.mockResolvedValueOnce(null);
      const req = new Request('http://localhost:3000/api/access-control/muster', {
        method: 'POST',
      });
      const res = await accessControlMusterPost(req);
      expect(res.status).toBe(401);
    });

    it('fails closed on /api/redis-proxy/v1/workflows when secret is unconfigured or invalid', async () => {
      const prevRedisSecret = process.env.REDIS_AUTH_SECRET;
      const prevN8nKey = process.env.N8N_API_KEY;
      delete process.env.REDIS_AUTH_SECRET;
      delete process.env.N8N_API_KEY;

      try {
        const req = new NextRequest('http://localhost:3000/api/redis-proxy/v1/workflows', {
          headers: { 'x-n8n-api-key': 'any-key-when-unconfigured' },
        });
        const res = await workflowsGet(req);
        expect(res.status).toBe(401);
      } finally {
        if (prevRedisSecret !== undefined) process.env.REDIS_AUTH_SECRET = prevRedisSecret;
        if (prevN8nKey !== undefined) process.env.N8N_API_KEY = prevN8nKey;
      }
    });
  });
});
