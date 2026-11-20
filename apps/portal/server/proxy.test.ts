/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { proxy as edgeProxy } from '../proxy';
import {
  clearProxyPrefetchCache,
  DEPARTMENT_ROUTES,
  isTokenExpiredError,
  normalizeRole,
  proxy,
} from './proxy';

jest.mock('@repo/supabase/middleware', () => ({
  createMiddlewareClient: jest.fn(),
}));

jest.mock('@repo/redis/cache', () => ({
  cacheGet: jest.fn().mockImplementation((key: string) => {
    if (key.startsWith('dept:uuid:')) {
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  }),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheEvictL1ByPrefix: jest.fn(),
}));

jest.mock('@repo/redis/session', () => ({
  readSession: jest.fn().mockResolvedValue(null),
  writeSession: jest.fn().mockResolvedValue(undefined),
  touchSession: jest.fn().mockResolvedValue(false),
  revokeSession: jest.fn().mockResolvedValue(undefined),
}));

const { createMiddlewareClient } = jest.requireMock('@repo/supabase/middleware');
const { cacheGet } = jest.requireMock('@repo/redis/cache');
const { readSession, revokeSession } = jest.requireMock('@repo/redis/session');

const SESSION_BUDGET_ADVANCE_MS = 150;
const PREFETCH_CACHE_TTL_MS = 10_000;
const PREFETCH_CACHE_MAX_ENTRIES = 256;

function buildProxyMock(
  overrides: { user?: unknown; employee?: unknown; deptData?: unknown } = {}
) {
  const user = overrides.user !== undefined ? overrides.user : { id: 'auth-1' };
  const employee =
    overrides.employee !== undefined
      ? overrides.employee
      : {
          role: 'operator',
          department_id: 'dept-uuid-1',
          accessible_departments: [],
        };
  const deptData = overrides.deptData !== undefined ? overrides.deptData : { id: 'dept-uuid-1' };

  const mockResponse = { headers: new Headers() };

  const supabase = {
    auth: {
      getClaims: jest.fn().mockResolvedValue({
        data: user ? { claims: { sub: (user as { id: string }).id } } : null,
      }),
      signOut: jest.fn().mockResolvedValue({}),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'employees') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: employee }),
            }),
          }),
        };
      }
      if (table === 'departments') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: deptData }),
            }),
          }),
        };
      }
      return {};
    }),
  };

  createMiddlewareClient.mockResolvedValue({
    supabase,
    response: mockResponse,
  });
  return { supabase, mockResponse };
}

function makeRequest(path: string, hasCookie = true) {
  const req = new NextRequest(`http://localhost${path}`);
  if (hasCookie) {
    req.cookies.set('sb-access-token', 'mock-token');
  }
  return req;
}

describe('normalizeRole', () => {
  it('returns the role as-is for valid non-empty strings', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('control_room_operator')).toBe('control_room_operator');
    expect(normalizeRole('supervisor')).toBe('supervisor');
  });

  it("returns 'operator' for empty string", () => {
    expect(normalizeRole('')).toBe('operator');
  });

  it("returns 'operator' for undefined", () => {
    expect(normalizeRole(undefined)).toBe('operator');
  });

  it("returns 'operator' for null", () => {
    expect(normalizeRole(null)).toBe('operator');
  });

  it("returns 'operator' for non-string values", () => {
    expect(normalizeRole(42)).toBe('operator');
    expect(normalizeRole({})).toBe('operator');
    expect(normalizeRole([])).toBe('operator');
    expect(normalizeRole(true)).toBe('operator');
  });
});

describe('isTokenExpiredError', () => {
  it("returns true for 'Invalid Refresh Token' message", () => {
    expect(isTokenExpiredError({ message: 'Invalid Refresh Token' })).toBe(true);
  });

  it("returns true for 'Refresh Token Not Found' message", () => {
    expect(isTokenExpiredError({ message: 'Refresh Token Not Found' })).toBe(true);
  });

  it('returns false for other error messages', () => {
    expect(isTokenExpiredError({ message: 'Some other error' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTokenExpiredError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isTokenExpiredError(undefined)).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isTokenExpiredError('string')).toBe(false);
    expect(isTokenExpiredError(42)).toBe(false);
  });

  it('returns false for objects without message property', () => {
    expect(isTokenExpiredError({ code: 500 })).toBe(false);
  });
});

describe('proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearProxyPrefetchCache();
    (readSession as jest.Mock).mockResolvedValue(null);
  });

  it('passes through static file requests', async () => {
    buildProxyMock();
    const req = makeRequest('/logo.svg');
    const res = await proxy(req);
    expect(res).toBeDefined();
    // Should return the raw response (not a redirect)
    expect(res.status).not.toBe(307);

    const webpReq = makeRequest('/background/global-background-poster.webp', false);
    const webpRes = await proxy(webpReq);
    expect(webpRes).toBeDefined();
    expect(webpRes.status).not.toBe(307);

    const vaFallbackReq = makeRequest('/c137cbcc62ce02d8/script.js', false);
    const vaFallbackRes = await proxy(vaFallbackReq);
    expect(vaFallbackRes.status).toBe(200);
    expect(vaFallbackRes.headers.get('content-type')).toContain('application/javascript');
  });

  it('redirects authenticated user away from /login to /', async () => {
    buildProxyMock({ user: { id: 'auth-1' } });
    const req = makeRequest('/login');
    req.cookies.set('sb-access-token', 'mock-token');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/');
  });

  it('passes /login through for unauthenticated users', async () => {
    buildProxyMock({ user: null });
    const req = makeRequest('/login', false);
    const res = await proxy(req);
    // Returns the raw middleware response (not a redirect)
    expect(res.status).not.toBe(307);
  });

  it('redirects unauthenticated users to /login with redirect param', async () => {
    buildProxyMock({ user: null });
    const req = makeRequest('/drilling', false);
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects non-admin users accessing /admin to error page', async () => {
    buildProxyMock({
      employee: {
        role: 'operator',
        department_id: 'dept-1',
        accessible_departments: [],
      },
    });
    const req = makeRequest('/admin');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unauthorized_department');
  });

  it('does NOT allow hardcoded email bypass to access /admin if employee role is not admin', async () => {
    buildProxyMock({
      user: { id: 'auth-1', email: 'timothyoniel558@gmail.com' },
      employee: {
        role: 'operator',
        department_id: 'dept-1',
        accessible_departments: [],
      },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest('/admin');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unauthorized_department');
  });

  it('allows admin to access /admin', async () => {
    buildProxyMock({
      employee: {
        role: 'admin',
        department_id: 'dept-1',
        accessible_departments: [],
      },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest('/admin');
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it('redirects non-admin/supervisor to /control-room', async () => {
    buildProxyMock({
      employee: {
        role: 'operator',
        department_id: 'dept-1',
        accessible_departments: [],
      },
    });
    const req = makeRequest('/control-room');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unauthorized_department');
  });

  it('allows control_room_operator to access /control-room with matching dept', async () => {
    buildProxyMock({
      employee: {
        role: 'control_room_operator',
        department_id: 'dept-uuid-cr',
        accessible_departments: [],
      },
      deptData: { id: 'dept-uuid-cr' },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest('/control-room');
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it('redirects user to unknown_department when dept UUID not found', async () => {
    buildProxyMock({
      employee: {
        role: 'operator',
        department_id: 'dept-1',
        accessible_departments: [],
      },
      deptData: null,
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest('/drilling');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unknown_department');
  });

  it('redirects user without dept access to unauthorized_department', async () => {
    buildProxyMock({
      employee: {
        role: 'operator',
        department_id: 'dept-other',
        accessible_departments: [],
      },
      deptData: { id: 'dept-uuid-1' },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest('/drilling');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unauthorized_department');
  });

  it('uses cached dept UUID when available', async () => {
    buildProxyMock({
      employee: {
        role: 'operator',
        department_id: 'cached-uuid',
        accessible_departments: [],
      },
    });
    (cacheGet as jest.Mock).mockImplementation((key: string) => {
      if (key.startsWith('dept:uuid:')) return Promise.resolve('cached-uuid');
      if (key.startsWith('arch:auth:employee:'))
        return Promise.resolve({
          role: 'operator',
          department_id: 'cached-uuid',
          accessible_departments: [],
        });
      return Promise.resolve(null);
    });
    const req = makeRequest('/drilling');
    const res = await proxy(req);
    // operator with matching dept should pass through
    expect(res.status).not.toBe(307);
  });

  it('allows user with accessible_departments to access dept routes', async () => {
    buildProxyMock({
      employee: {
        role: 'operator',
        department_id: 'dept-other',
        accessible_departments: ['dept-uuid-1'],
      },
      deptData: { id: 'dept-uuid-1' },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest('/drilling');
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it('redirects non-supervisor to dept tools', async () => {
    buildProxyMock({
      employee: {
        role: 'operator',
        department_id: 'dept-uuid-1',
        accessible_departments: [],
      },
      deptData: { id: 'dept-uuid-1' },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest('/drilling/tools');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unauthorized_department');
  });

  it('signs out and redirects to /login on expired/invalid refresh token on protected route', async () => {
    const { supabase } = buildProxyMock();
    supabase.auth.getClaims.mockResolvedValue({
      error: { message: 'Invalid Refresh Token' },
      data: null,
    });
    supabase.auth.signOut = jest.fn().mockResolvedValue({});

    const req = makeRequest('/drilling');
    req.cookies.set('sb-access-token', 'expired-token');
    const res = await proxy(req);

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('signs out and returns base response when /login is accessed with expired session cookie', async () => {
    const { supabase, mockResponse } = buildProxyMock();
    supabase.auth.getClaims.mockResolvedValue({
      error: { message: 'Refresh Token Not Found' },
      data: null,
    });
    supabase.auth.signOut = jest.fn().mockResolvedValue({});

    const req = makeRequest('/login');
    req.cookies.set('sb-access-token', 'expired-token');
    const res = await proxy(req);

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(res).toBe(mockResponse);
  });

  it('short-circuits requests without session cookies instantly without calling Supabase auth', async () => {
    const { supabase } = buildProxyMock();
    const req = makeRequest('/drilling', false);
    const res = await proxy(req);

    expect(supabase.auth.getClaims).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login?redirect=%2Fdrilling');
  });

  it('exempts /_vercel/speed-insights endpoints from authentication to support reverse proxy routing', async () => {
    buildProxyMock();
    const req = makeRequest('/_vercel/speed-insights/vitals', false);
    const res = await proxy(req);

    // Must not be redirected to /login
    expect(res.status).not.toBe(307);
  });

  it('exempts /_vercel/insights endpoints from authentication', async () => {
    buildProxyMock();
    const req = makeRequest('/_vercel/insights/script.js', false);
    const res = await proxy(req);

    // Must not be redirected to /login
    expect(res.status).not.toBe(307);
  });

  it('does NOT exempt arbitrary non-observability /_vercel paths and redirects unauthenticated to /login', async () => {
    buildProxyMock();
    const req = makeRequest('/_vercel_malicious/data', false);
    const res = await proxy(req);

    // Unauthenticated non-observability route must be redirected to /login
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('exempts /offline and /privacy routes from authentication while gating prefix lookalikes', async () => {
    const { supabase } = buildProxyMock();

    const offlineRes = await proxy(makeRequest('/offline', false));
    expect(offlineRes.status).not.toBe(307);

    const privacyRes = await proxy(makeRequest('/privacy', false));
    expect(privacyRes.status).not.toBe(307);

    expect(supabase.auth.getClaims).not.toHaveBeenCalled();

    const offlineLookalikeRes = await proxy(makeRequest('/offline-admin', false));
    expect(offlineLookalikeRes.status).toBe(307);
    expect(offlineLookalikeRes.headers.get('location')).toContain('/login');

    const privacyLookalikeRes = await proxy(makeRequest('/privacy_admin', false));
    expect(privacyLookalikeRes.status).toBe(307);
    expect(privacyLookalikeRes.headers.get('location')).toContain('/login');
  });

  it('redirects unauthenticated requests on unknown application routes to /login', async () => {
    buildProxyMock();
    const req = makeRequest('/unknown-feature-path', false);
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('emits CSP header containing https://api.open-meteo.com in connect-src without wildcards', async () => {
    buildProxyMock();
    const req = makeRequest('/hub', false);
    const res = await edgeProxy(req);

    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp).toContain('https://api.open-meteo.com');
    expect(csp).toContain('https://us.cloud.langfuse.com');
    expect(csp).toContain('https://*.r2.cloudflarestorage.com');
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain('connect-src *');
    expect(csp).not.toContain('scada.example.com');
  });

  it('omits unsafe-eval, localhost, and tunnel origins from CSP in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    try {
      buildProxyMock();
      const req = makeRequest('/login', false);
      const res = await edgeProxy(req);

      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeDefined();
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).not.toContain('http://localhost:*');
      expect(csp).not.toContain('http://127.0.0.1:*');
      expect(csp).not.toContain('ngrok-free.app');
      expect(csp).not.toContain('scada.example.com');
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(res.headers.get('x-nonce')).toBeTruthy();
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true });
    }
  });

  it('aligns next.config.mjs CSP directives and excludes localhost/tunnel origins in production', () => {
    const nextConfigPath = path.resolve(__dirname, '../next.config.mjs');
    const nextConfigSource = fs.readFileSync(nextConfigPath, 'utf8');

    const prodMatch = nextConfigSource.match(
      /key:\s*'Content-Security-Policy',\s*value:\s*"([^"]+)"/
    );
    expect(prodMatch).not.toBeNull();
    const prodCsp = prodMatch?.[1] ?? '';
    expect(prodCsp).not.toContain('localhost');
    expect(prodCsp).not.toContain('127.0.0.1');
    expect(prodCsp).not.toContain('ngrok-free.app');
    expect(prodCsp).not.toContain('scada.example.com');
    expect(prodCsp).toContain("object-src 'none'");
    expect(prodCsp).toContain("base-uri 'self'");
    expect(prodCsp).toContain("form-action 'self'");
    expect(prodCsp).toContain('https://us.cloud.langfuse.com');
    expect(prodCsp).toContain('https://*.r2.cloudflarestorage.com');

    const devMatch = nextConfigSource.match(
      /key:\s*'Content-Security-Policy-Report-Only',\s*value:\s*"([^"]+)"/
    );
    expect(devMatch).not.toBeNull();
    const devCsp = devMatch?.[1] ?? '';
    expect(devCsp).not.toContain('scada.example.com');
    expect(devCsp).toContain("object-src 'none'");
    expect(devCsp).toContain("base-uri 'self'");
    expect(devCsp).toContain("form-action 'self'");
  });

  describe('plant-processing and plant-inventory RBAC isolation', () => {
    it('includes plant-processing and plant-inventory in DEPARTMENT_ROUTES', () => {
      expect(DEPARTMENT_ROUTES).toContain('plant-processing');
      expect(DEPARTMENT_ROUTES).toContain('plant-inventory');
    });

    it('redirects unauthorized operator away from /plant-processing and /plant-inventory', async () => {
      buildProxyMock({
        employee: {
          role: 'operator',
          department_id: 'dept-drilling',
          accessible_departments: [],
        },
        deptData: { id: 'dept-production' },
      });
      (cacheGet as jest.Mock).mockResolvedValue(null);

      const procRes = await proxy(makeRequest('/plant-processing'));
      expect(procRes.status).toBe(307);
      expect(procRes.headers.get('location')).toContain('unauthorized_department');

      const invRes = await proxy(makeRequest('/plant-inventory'));
      expect(invRes.status).toBe(307);
      expect(invRes.headers.get('location')).toContain('unauthorized_department');
    });

    it('enforces RBAC for /presentation (allows admin & manager, redirects unassigned operator)', async () => {
      expect(DEPARTMENT_ROUTES).toContain('presentation');

      buildProxyMock({
        employee: {
          role: 'manager',
          department_id: 'dept-drilling',
          accessible_departments: [],
        },
      });
      const managerRes = await proxy(makeRequest('/presentation'));
      expect(managerRes.status).not.toBe(307);

      buildProxyMock({
        employee: {
          role: 'operator',
          department_id: 'dept-drilling',
          accessible_departments: [],
        },
        deptData: { id: 'dept-production' },
      });
      (cacheGet as jest.Mock).mockResolvedValue(null);
      const operatorRes = await proxy(makeRequest('/presentation'));
      expect(operatorRes.status).toBe(307);
      expect(operatorRes.headers.get('location')).toContain('unauthorized_department');
    });

    it('falls back to production department UUID when plant-processing or plant-inventory row is not yet seeded', async () => {
      const { supabase } = buildProxyMock({
        employee: {
          role: 'operator',
          department_id: 'dept-production-uuid',
          accessible_departments: [],
        },
      });
      (cacheGet as jest.Mock).mockResolvedValue(null);

      supabase.from.mockImplementation((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    role: 'operator',
                    department_id: 'dept-production-uuid',
                    accessible_departments: [],
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'departments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockImplementation((_col: string, val: string) => {
                const resolved =
                  val === 'production' ? { data: { id: 'dept-production-uuid' } } : { data: null };
                return {
                  single: jest.fn().mockResolvedValue(resolved),
                  maybeSingle: jest.fn().mockResolvedValue(resolved),
                };
              }),
            }),
          };
        }
        return {};
      });

      const procRes = await proxy(makeRequest('/plant-processing'));
      expect(procRes.status).not.toBe(307);

      const invRes = await proxy(makeRequest('/plant-inventory'));
      expect(invRes.status).not.toBe(307);
    });

    it('re-emits sb-*-auth-token cookies with httpOnly: false on authenticated requests', async () => {
      const { mockResponse } = buildProxyMock({
        employee: {
          role: 'admin',
          department_id: 'dept-uuid-1',
          accessible_departments: [],
        },
      });
      const setCookieMock = jest.fn();
      (mockResponse as Record<string, unknown>).cookies = {
        getAll: () => [],
        set: setCookieMock,
      };

      const req = new NextRequest('http://localhost/admin');
      req.cookies.set('__tb99_sb-mrwhtxbhrzyttlsyuofc-auth-token', 'base64-jwt');
      await proxy(req);

      expect(setCookieMock).toHaveBeenCalledWith(
        'sb-mrwhtxbhrzyttlsyuofc-auth-token',
        'base64-jwt',
        expect.objectContaining({
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
        })
      );
    });
  });

  describe('session read budget cleanup and prefetch L1 cache', () => {
    it('clears the session read budget timer on fast Redis hits without leaking handles', async () => {
      jest.useFakeTimers();
      const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
      const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
      try {
        (readSession as jest.Mock).mockResolvedValueOnce({
          id: 'emp-1',
          role: 'admin',
          department_id: 'dept-uuid-1',
          accessible_departments: [],
        });
        buildProxyMock();

        const res = await proxy(makeRequest('/admin'));
        expect(res.status).not.toBe(307);
        expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(clearTimeoutSpy).toHaveBeenCalledWith(setTimeoutSpy.mock.results[0]?.value);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
        jest.useRealTimers();
      }
    });

    it('clears the session read budget timer when Redis exceeds the 150ms budget', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
      try {
        (readSession as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));
        buildProxyMock({
          employee: {
            id: 'emp-fallback',
            role: 'admin',
            department_id: 'dept-uuid-1',
            accessible_departments: [],
          },
        });

        const proxyPromise = proxy(makeRequest('/admin'));
        await jest.advanceTimersByTimeAsync(SESSION_BUDGET_ADVANCE_MS);
        const res = await proxyPromise;

        expect(res.status).not.toBe(307);
        expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        clearTimeoutSpy.mockRestore();
        jest.useRealTimers();
      }
    });

    it('skips redundant readSession calls on next-router-prefetch and purpose=prefetch after navigation', async () => {
      const adminEmployee = {
        id: 'emp-1',
        role: 'admin',
        department_id: 'dept-uuid-1',
        accessible_departments: [],
      };
      (readSession as jest.Mock).mockResolvedValue(adminEmployee);
      buildProxyMock({ employee: adminEmployee });

      const navigationRes = await proxy(makeRequest('/admin'));
      expect(navigationRes.status).not.toBe(307);
      expect(readSession).toHaveBeenCalledTimes(1);

      const nextPrefetchReq = makeRequest('/overview');
      nextPrefetchReq.headers.set('next-router-prefetch', '1');
      const nextPrefetchRes = await proxy(nextPrefetchReq);
      expect(nextPrefetchRes.status).not.toBe(307);
      expect(readSession).toHaveBeenCalledTimes(1);

      const purposePrefetchReq = makeRequest('/hub');
      purposePrefetchReq.headers.set('purpose', 'prefetch');
      const purposePrefetchRes = await proxy(purposePrefetchReq);
      expect(purposePrefetchRes.status).not.toBe(307);
      expect(readSession).toHaveBeenCalledTimes(1);
    });

    it('calls readSession directly on full non-prefetch navigation even when cached in prefetch L1', async () => {
      const initialAdmin = {
        id: 'emp-1',
        role: 'admin',
        department_id: 'dept-uuid-1',
        accessible_departments: [],
      };
      const downgradedOperator = {
        id: 'emp-1',
        role: 'operator',
        department_id: 'dept-uuid-1',
        accessible_departments: [],
      };
      (readSession as jest.Mock)
        .mockResolvedValueOnce(initialAdmin)
        .mockResolvedValueOnce(downgradedOperator);
      buildProxyMock({ employee: downgradedOperator });

      const firstRes = await proxy(makeRequest('/admin'));
      expect(firstRes.status).not.toBe(307);
      expect(readSession).toHaveBeenCalledTimes(1);

      const secondRes = await proxy(makeRequest('/admin'));
      expect(readSession).toHaveBeenCalledTimes(2);
      expect(secondRes.status).toBe(307);
      expect(secondRes.headers.get('location')).toContain('unauthorized_department');
    });

    it('evicts stale prefetch L1 entries after TTL expires and re-queries readSession', async () => {
      jest.useFakeTimers();
      try {
        const adminEmployee = {
          id: 'emp-1',
          role: 'admin',
          department_id: 'dept-uuid-1',
          accessible_departments: [],
        };
        (readSession as jest.Mock).mockResolvedValue(adminEmployee);
        buildProxyMock({ employee: adminEmployee });

        await proxy(makeRequest('/admin'));
        expect(readSession).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(PREFETCH_CACHE_TTL_MS);

        const expiredPrefetchReq = makeRequest('/overview');
        expiredPrefetchReq.headers.set('next-router-prefetch', '1');
        await proxy(expiredPrefetchReq);
        expect(readSession).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('evicts prefetch L1 cache entry on signOut and revokeSession', async () => {
      const adminEmployee = {
        id: 'emp-1',
        role: 'admin',
        department_id: 'dept-uuid-1',
        accessible_departments: [],
      };
      (readSession as jest.Mock).mockResolvedValue(adminEmployee);
      const { supabase } = buildProxyMock({ employee: adminEmployee });

      await proxy(makeRequest('/admin'));
      expect(readSession).toHaveBeenCalledTimes(1);

      supabase.auth.getClaims.mockResolvedValueOnce({
        data: { claims: { sub: 'auth-1' } },
        error: { message: 'Invalid Refresh Token' },
      });
      const signOutRes = await proxy(makeRequest('/admin'));
      expect(signOutRes.status).toBe(307);
      expect(revokeSession).toHaveBeenCalledWith('auth-1', { reason: 'logout' });

      const postSignOutPrefetch = makeRequest('/overview');
      postSignOutPrefetch.headers.set('next-router-prefetch', '1');
      await proxy(postSignOutPrefetch);
      expect(readSession).toHaveBeenCalledTimes(2);
    });

    it('bounds prefetch L1 cache to 256 entries by evicting the oldest user key', async () => {
      const adminEmployee = {
        id: 'emp-bounded',
        role: 'admin',
        department_id: 'dept-uuid-1',
        accessible_departments: [],
      };
      (readSession as jest.Mock).mockResolvedValue(adminEmployee);
      const { supabase } = buildProxyMock({ employee: adminEmployee });

      for (let index = 0; index <= PREFETCH_CACHE_MAX_ENTRIES; index += 1) {
        supabase.auth.getClaims.mockResolvedValueOnce({
          data: { claims: { sub: `auth-${index}` } },
        });
        await proxy(makeRequest('/overview'));
      }
      expect(readSession).toHaveBeenCalledTimes(PREFETCH_CACHE_MAX_ENTRIES + 1);

      supabase.auth.getClaims.mockResolvedValueOnce({
        data: { claims: { sub: `auth-${PREFETCH_CACHE_MAX_ENTRIES}` } },
      });
      const newestPrefetch = makeRequest('/overview');
      newestPrefetch.headers.set('next-router-prefetch', '1');
      await proxy(newestPrefetch);
      expect(readSession).toHaveBeenCalledTimes(PREFETCH_CACHE_MAX_ENTRIES + 1);

      supabase.auth.getClaims.mockResolvedValueOnce({
        data: { claims: { sub: 'auth-0' } },
      });
      const evictedPrefetch = makeRequest('/overview');
      evictedPrefetch.headers.set('next-router-prefetch', '1');
      await proxy(evictedPrefetch);
      expect(readSession).toHaveBeenCalledTimes(PREFETCH_CACHE_MAX_ENTRIES + 2);
    });
  });
});
