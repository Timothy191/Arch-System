/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

const mockQuery = () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  single: jest.fn(),
  eq: jest.fn().mockReturnThis(),
});

describe("GET /api/printers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 if user lacks required role", async () => {
    const query = mockQuery();
    query.single.mockResolvedValue({ data: { role: "operator" }, error: null });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      ...query,
    });

    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns printers on successful query", async () => {
    const query = mockQuery();
    query.single.mockResolvedValueOnce({ data: { role: "admin" }, error: null });
    query.order.mockResolvedValueOnce({ data: [{ id: "p1", name: "Printer 1" }], error: null });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      ...query,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ printers: [{ id: "p1", name: "Printer 1" }] });
  });

  it("returns 500 on database error", async () => {
    const query = mockQuery();
    query.single.mockResolvedValueOnce({ data: { role: "admin" }, error: null });
    query.order.mockResolvedValueOnce({ data: null, error: { message: "db error" } });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      ...query,
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to list printers");
    expect(body.printers).toEqual([]);
  });
});

describe("POST /api/printers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const req = new NextRequest("http://localhost/api/printers", {
      method: "POST",
      body: JSON.stringify({ cups_name: "cups-1", name: "Printer 1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 if user lacks required role", async () => {
    const query = mockQuery();
    query.single.mockResolvedValue({ data: { role: "operator" }, error: null });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      ...query,
    });

    const req = new NextRequest("http://localhost/api/printers", {
      method: "POST",
      body: JSON.stringify({ cups_name: "cups-1", name: "Printer 1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const query = mockQuery();
    query.single.mockResolvedValue({ data: { role: "admin" }, error: null });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      ...query,
    });

    const req = new NextRequest("http://localhost/api/printers", {
      method: "POST",
      body: JSON.stringify({ name: "Printer 1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "cups_name and name are required" });
  });

  it("returns 409 on unique constraint violation", async () => {
    const query = mockQuery();
    query.single.mockResolvedValueOnce({ data: { role: "admin" }, error: null });
    query.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      ...query,
    });

    const req = new NextRequest("http://localhost/api/printers", {
      method: "POST",
      body: JSON.stringify({ cups_name: "cups-1", name: "Printer 1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "A printer with this CUPS name is already registered",
    });
  });

  it("returns 201 with created printer", async () => {
    const query = mockQuery();
    query.single.mockResolvedValueOnce({ data: { role: "admin" }, error: null });
    query.single.mockResolvedValueOnce({
      data: { id: "p1", cups_name: "cups-1", name: "Printer 1" },
      error: null,
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      ...query,
    });

    const req = new NextRequest("http://localhost/api/printers", {
      method: "POST",
      body: JSON.stringify({ cups_name: "cups-1", name: "Printer 1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      printer: { id: "p1", cups_name: "cups-1", name: "Printer 1" },
    });
  });

  it("returns 500 on unexpected insert error", async () => {
    const query = mockQuery();
    query.single.mockResolvedValueOnce({ data: { role: "admin" }, error: null });
    query.single.mockResolvedValueOnce({
      data: null,
      error: { code: "99999", message: "unexpected" },
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      ...query,
    });

    const req = new NextRequest("http://localhost/api/printers", {
      method: "POST",
      body: JSON.stringify({ cups_name: "cups-1", name: "Printer 1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to register printer" });
  });
});
