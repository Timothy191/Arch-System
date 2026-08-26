/**
 * @jest-environment node
 */

import { POST } from "./route";
import { NextRequest } from "next/server";

const mockSignInWithPassword = jest.fn();

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn(async () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  })),
}));

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 415 when Content-Type is not application/json", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "plain text",
    });

    const res = await POST(req);
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.error).toBe("Content-Type must be application/json");
  });

  it("returns 400 when email or password is missing", async () => {
    const req = createRequest({ email: "admin@plantcor.os" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Email and password are required");
  });

  it("returns 200 on successful credentials", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "admin@plantcor.os" } },
      error: null,
    });

    const req = createRequest({
      email: "admin@plantcor.os",
      password: "Yugioh@123#",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirectTo).toBe("/");
  });

  it("returns 401 on invalid login credentials", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: "Invalid login credentials",
        status: 400,
      },
    });

    const req = createRequest({
      email: "admin@plantcor.os",
      password: "WrongPassword",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid credentials");
  });

  it("returns 429 when Supabase reports rate limit", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: "Email rate limit exceeded",
        status: 429,
      },
    });

    const req = createRequest({
      email: "admin@plantcor.os",
      password: "Yugioh@123#",
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many attempts");
  });

  it("returns 503 when Supabase returns upstream 500 error or fetch failed", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: "fetch failed",
        status: 503,
      },
    });

    const req = createRequest({
      email: "admin@plantcor.os",
      password: "Yugioh@123#",
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain("Authentication service is temporarily unavailable");
  });

  it("returns 503 when network connection throws an unhandled error", async () => {
    mockSignInWithPassword.mockRejectedValueOnce(
      new Error("fetch failed: ECONNREFUSED 127.0.0.1:54321"),
    );

    const req = createRequest({
      email: "admin@plantcor.os",
      password: "Yugioh@123#",
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain("Authentication service is temporarily unavailable");
  });
});
