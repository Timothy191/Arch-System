/**
 * @jest-environment node
 */
import { normalizeRole, isTokenExpiredError, proxy } from "./proxy";
import { NextRequest } from "next/server";

jest.mock("@repo/supabase/middleware", () => ({
  createMiddlewareClient: jest.fn(),
}));

jest.mock("@repo/redis/cache", () => ({
  cacheGet: jest.fn().mockImplementation((key: string) => {
    if (key.startsWith("dept:uuid:")) {
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  }),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheEvictL1ByPrefix: jest.fn(),
}));

const { createMiddlewareClient } = jest.requireMock("@repo/supabase/middleware");
const { cacheGet } = jest.requireMock("@repo/redis/cache");

function buildProxyMock(
  overrides: {
    user?: unknown;
    employee?: unknown;
    deptData?: unknown;
  } = {},
) {
  const user = overrides.user !== undefined ? overrides.user : { id: "auth-1" };
  const employee =
    overrides.employee !== undefined
      ? overrides.employee
      : {
          role: "operator",
          department_id: "dept-uuid-1",
          accessible_departments: [],
        };
  const deptData = overrides.deptData !== undefined ? overrides.deptData : { id: "dept-uuid-1" };

  const mockResponse = { headers: new Headers() };

  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
      signOut: jest.fn().mockResolvedValue({}),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "employees") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: employee }),
            }),
          }),
        };
      }
      if (table === "departments") {
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

function makeRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("normalizeRole", () => {
  it("returns the role as-is for valid non-empty strings", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("control_room_operator")).toBe("control_room_operator");
    expect(normalizeRole("supervisor")).toBe("supervisor");
  });

  it("returns 'operator' for empty string", () => {
    expect(normalizeRole("")).toBe("operator");
  });

  it("returns 'operator' for undefined", () => {
    expect(normalizeRole(undefined)).toBe("operator");
  });

  it("returns 'operator' for null", () => {
    expect(normalizeRole(null)).toBe("operator");
  });

  it("returns 'operator' for non-string values", () => {
    expect(normalizeRole(42)).toBe("operator");
    expect(normalizeRole({})).toBe("operator");
    expect(normalizeRole([])).toBe("operator");
    expect(normalizeRole(true)).toBe("operator");
  });
});

describe("isTokenExpiredError", () => {
  it("returns true for 'Invalid Refresh Token' message", () => {
    expect(isTokenExpiredError({ message: "Invalid Refresh Token" })).toBe(true);
  });

  it("returns true for 'Refresh Token Not Found' message", () => {
    expect(isTokenExpiredError({ message: "Refresh Token Not Found" })).toBe(true);
  });

  it("returns false for other error messages", () => {
    expect(isTokenExpiredError({ message: "Some other error" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTokenExpiredError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isTokenExpiredError(undefined)).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isTokenExpiredError("string")).toBe(false);
    expect(isTokenExpiredError(42)).toBe(false);
  });

  it("returns false for objects without message property", () => {
    expect(isTokenExpiredError({ code: 500 })).toBe(false);
  });
});

describe("proxy", () => {
  beforeEach(() => jest.clearAllMocks());

  it("passes through static file requests", async () => {
    buildProxyMock();
    const req = makeRequest("/logo.svg");
    const res = await proxy(req);
    expect(res).toBeDefined();
    // Should return the raw response (not a redirect)
    expect(res.status).not.toBe(307);
  });

  it("redirects authenticated user away from /login to /", async () => {
    buildProxyMock({ user: { id: "auth-1" } });
    const req = makeRequest("/login");
    req.cookies.set("sb-access-token", "mock-token");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/");
  });

  it("passes /login through for unauthenticated users", async () => {
    buildProxyMock({ user: null });
    const req = makeRequest("/login");
    const res = await proxy(req);
    // Returns the raw middleware response (not a redirect)
    expect(res.status).not.toBe(307);
  });

  it("redirects unauthenticated users to /login with redirect param", async () => {
    buildProxyMock({ user: null });
    const req = makeRequest("/drilling");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects non-admin users accessing /admin to error page", async () => {
    buildProxyMock({
      employee: {
        role: "operator",
        department_id: "dept-1",
        accessible_departments: [],
      },
    });
    const req = makeRequest("/admin");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("unauthorized_department");
  });

  it("allows admin to access /admin", async () => {
    buildProxyMock({
      employee: {
        role: "admin",
        department_id: "dept-1",
        accessible_departments: [],
      },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest("/admin");
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it("redirects non-admin/supervisor to /control-room", async () => {
    buildProxyMock({
      employee: {
        role: "operator",
        department_id: "dept-1",
        accessible_departments: [],
      },
    });
    const req = makeRequest("/control-room");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("unauthorized_department");
  });

  it("allows control_room_operator to access /control-room with matching dept", async () => {
    buildProxyMock({
      employee: {
        role: "control_room_operator",
        department_id: "dept-uuid-cr",
        accessible_departments: [],
      },
      deptData: { id: "dept-uuid-cr" },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest("/control-room");
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it("redirects user to unknown_department when dept UUID not found", async () => {
    buildProxyMock({
      employee: {
        role: "operator",
        department_id: "dept-1",
        accessible_departments: [],
      },
      deptData: null,
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest("/drilling");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("unknown_department");
  });

  it("redirects user without dept access to unauthorized_department", async () => {
    buildProxyMock({
      employee: {
        role: "operator",
        department_id: "dept-other",
        accessible_departments: [],
      },
      deptData: { id: "dept-uuid-1" },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest("/drilling");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("unauthorized_department");
  });

  it("uses cached dept UUID when available", async () => {
    buildProxyMock({
      employee: {
        role: "operator",
        department_id: "cached-uuid",
        accessible_departments: [],
      },
    });
    (cacheGet as jest.Mock).mockImplementation((key: string) => {
      if (key.startsWith("dept:uuid:")) return Promise.resolve("cached-uuid");
      if (key.startsWith("arch:auth:employee:"))
        return Promise.resolve({
          role: "operator",
          department_id: "cached-uuid",
          accessible_departments: [],
        });
      return Promise.resolve(null);
    });
    const req = makeRequest("/drilling");
    const res = await proxy(req);
    // operator with matching dept should pass through
    expect(res.status).not.toBe(307);
  });

  it("allows user with accessible_departments to access dept routes", async () => {
    buildProxyMock({
      employee: {
        role: "operator",
        department_id: "dept-other",
        accessible_departments: ["dept-uuid-1"],
      },
      deptData: { id: "dept-uuid-1" },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest("/drilling");
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it("redirects non-supervisor to dept tools", async () => {
    buildProxyMock({
      employee: {
        role: "operator",
        department_id: "dept-uuid-1",
        accessible_departments: [],
      },
      deptData: { id: "dept-uuid-1" },
    });
    (cacheGet as jest.Mock).mockResolvedValue(null);
    const req = makeRequest("/drilling/tools");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("unauthorized_department");
  });

  it("signs out and redirects to /login on expired/invalid refresh token on protected route", async () => {
    const { supabase } = buildProxyMock();
    supabase.auth.getUser.mockResolvedValue({
      error: { message: "Invalid Refresh Token" },
      data: { user: null },
    });
    supabase.auth.signOut = jest.fn().mockResolvedValue({});

    const req = makeRequest("/drilling");
    req.cookies.set("sb-access-token", "expired-token");
    const res = await proxy(req);

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("signs out and returns base response when /login is accessed with expired session cookie", async () => {
    const { supabase, mockResponse } = buildProxyMock();
    supabase.auth.getUser.mockResolvedValue({
      error: { message: "Refresh Token Not Found" },
      data: { user: null },
    });
    supabase.auth.signOut = jest.fn().mockResolvedValue({});

    const req = makeRequest("/login");
    req.cookies.set("sb-access-token", "expired-token");
    const res = await proxy(req);

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(res).toBe(mockResponse);
  });
});
