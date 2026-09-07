/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from "next/server";
import { RateLimiter, RedisStore, FixedWindowStrategy } from "@repo/rate-limiter";
import { GET, PUT, DELETE } from "./route";

jest.mock("@/lib/api/rate-limit-middleware", () => ({
  withRateLimit: jest.fn((_req: Request, handler: () => Promise<NextResponse>) => handler()),
}));

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@repo/supabase/service-role", () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn(),
}));

jest.mock("@repo/rate-limiter", () => ({
  RateLimiter: jest.fn(),
  RedisStore: jest.fn(),
  FixedWindowStrategy: jest.fn(),
}));

const { withRateLimit } = require("@/lib/api/rate-limit-middleware");
const { createServerSupabaseClient } = require("@repo/supabase/server");
const { createServiceRoleClient } = require("@repo/supabase/service-role");
const { getRedisClient } = require("@repo/redis");

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function mockAuth(user: { id: string } | null, employee: { id: string; role: string } | null) {
  const authChain = {
    getUser: jest.fn().mockResolvedValue({ data: { user } }),
  };

  const employeeChain =
    employee !== null
      ? {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: employee }),
              }),
            }),
          }),
        }
      : {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        };

  createServerSupabaseClient.mockResolvedValue({
    auth: authChain,
    ...employeeChain,
  });

  return { authChain, employeeChain };
}

function mockServiceRole(overrides?: {
  from?: jest.Mock;
  select?: jest.Mock;
  eq?: jest.Mock;
  single?: jest.Mock;
  order?: jest.Mock;
  range?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
  insert?: jest.Mock;
}) {
  const updateChain = {
    eq: jest.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }),
    ...(overrides?.update ? { update: overrides.update } : {}),
  };

  const deleteChain = {
    eq: jest.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }),
    ...(overrides?.delete ? { delete: overrides.delete } : {}),
  };

  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: "1" } }),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [{ id: "1" }], count: 1 }),
    update: jest.fn().mockReturnValue(updateChain),
    delete: jest.fn().mockReturnValue(deleteChain),
    insert: jest.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }),
    ...overrides,
  };

  const from = jest.fn().mockReturnValue(query);
  createServiceRoleClient.mockReturnValue({ from });

  return { from, query, updateChain, deleteChain };
}

describe("GET /api/admin/data/[table]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withRateLimit as jest.Mock).mockImplementation((_req, handler) => handler());
  });

  it("returns 401 when user is missing", async () => {
    mockAuth(null, null);

    const req = buildRequest("http://localhost:3000/api/admin/data/machines");
    const res = await GET(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when employee role is not admin", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "operator" });

    const req = buildRequest("http://localhost:3000/api/admin/data/machines");
    const res = await GET(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Forbidden");
  });

  it("returns 404 for unknown table", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });

    const req = buildRequest("http://localhost:3000/api/admin/data/secret_table");
    const res = await GET(req, { params: Promise.resolve({ table: "secret_table" }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Unknown table");
  });

  it("returns paginated data for allowed table", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });
    mockServiceRole();

    const req = buildRequest(
      "http://localhost:3000/api/admin/data/machines?limit=10&offset=20&order_by=created_at&order_dir=asc",
    );
    const res = await GET(req, { params: Promise.resolve({ table: "Machines" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([{ id: "1" }]);
    expect(json.count).toBe(1);
    expect(json.limit).toBe(10);
    expect(json.offset).toBe(20);
  });

  it("returns 500 when database query fails", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });
    mockServiceRole({
      range: jest.fn().mockResolvedValue({ data: null, count: null, error: new Error("boom") }),
    });

    const req = buildRequest("http://localhost:3000/api/admin/data/machines");
    const res = await GET(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Database query failed");
  });
});

describe("PUT /api/admin/data/[table]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withRateLimit as jest.Mock).mockImplementation((_req, handler) => handler());
  });

  it("returns 401 when user is missing", async () => {
    mockAuth(null, null);

    const req = buildRequest("http://localhost:3000/api/admin/data/machines", {
      method: "PUT",
      body: JSON.stringify({ id: "1", active: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });

    const req = buildRequest("http://localhost:3000/api/admin/data/machines", {
      method: "PUT",
      body: JSON.stringify({ active: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing record id");
  });

  it("returns 404 for unknown table", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });

    const req = buildRequest("http://localhost:3000/api/admin/data/unknown", {
      method: "PUT",
      body: JSON.stringify({ id: "1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: "unknown" }) });

    expect(res.status).toBe(404);
  });

  it("returns 500 when update fails", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });
    mockServiceRole({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: new Error("db") }),
      }),
    });

    const req = buildRequest("http://localhost:3000/api/admin/data/machines", {
      method: "PUT",
      body: JSON.stringify({ id: "1", active: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Update failed");
  });

  it("returns success and writes audit log on successful update", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });
    const service = mockServiceRole();

    const req = buildRequest("http://localhost:3000/api/admin/data/machines", {
      method: "PUT",
      body: JSON.stringify({ id: "1", active: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(service.from).toHaveBeenCalledWith("audit_logs");
    expect(service.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        table_name: "machines",
        record_id: "1",
        performed_by: "emp-1",
      }),
    );
  });

  it("returns 429 when machine status rate limiter rejects the request", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });
    mockServiceRole();

    (getRedisClient as jest.Mock).mockResolvedValue({ isOpen: true });
    const rateLimiter = {
      check: jest.fn().mockResolvedValue({ allowed: false, retryAfter: 42 }),
    };
    (RateLimiter as unknown as jest.Mock).mockImplementation(
      () => rateLimiter as unknown as RateLimiter,
    ); // Jest mock needs unchecked cast for constructor replacement
    (RedisStore as unknown as jest.Mock).mockImplementation(() => ({}) as RedisStore); // Jest mock needs unchecked cast for constructor replacement
    (FixedWindowStrategy as unknown as jest.Mock).mockImplementation(
      () => ({}) as FixedWindowStrategy,
    ); // Jest mock needs unchecked cast for constructor replacement

    const req = buildRequest("http://localhost:3000/api/admin/data/machines", {
      method: "PUT",
      body: JSON.stringify({ id: "1", active: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many status updates");
    expect(json.retryAfter).toBe(42);
  });
});

describe("DELETE /api/admin/data/[table]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withRateLimit as jest.Mock).mockImplementation((_req, handler) => handler());
  });

  it("returns 401 when user is missing", async () => {
    mockAuth(null, null);

    const req = buildRequest("http://localhost:3000/api/admin/data/machines?id=1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(401);
  });

  it("returns 400 when id query parameter is missing", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });

    const req = buildRequest("http://localhost:3000/api/admin/data/machines", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing id query parameter");
  });

  it("returns 404 for unknown table", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });

    const req = buildRequest("http://localhost:3000/api/admin/data/unknown?id=1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: "unknown" }) });

    expect(res.status).toBe(404);
  });

  it("returns 500 when delete fails", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });
    mockServiceRole({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: new Error("db") }),
      }),
    });

    const req = buildRequest("http://localhost:3000/api/admin/data/machines?id=1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Delete failed");
  });

  it("returns success and writes audit log on successful delete", async () => {
    mockAuth({ id: "user-1" }, { id: "emp-1", role: "admin" });
    const service = mockServiceRole();

    const req = buildRequest("http://localhost:3000/api/admin/data/machines?id=1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: "machines" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(service.from).toHaveBeenCalledWith("audit_logs");
    expect(service.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delete",
        table_name: "machines",
        record_id: "1",
        performed_by: "emp-1",
      }),
    );
  });
});
