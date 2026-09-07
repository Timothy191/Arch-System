/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("next-swagger-doc", () => ({
  createSwaggerSpec: jest.fn(),
}));

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createSwaggerSpec } = require("next-swagger-doc");
const { createServerSupabaseClient } = require("@repo/supabase/server");

function buildRequest(url = "http://localhost:3000/api/doc") {
  return new Request(url, { method: "GET" });
}

describe("GET /api/doc", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 if user lacks required role", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { role: "operator" }, error: null }),
      eq: jest.fn().mockReturnThis(),
    });

    const res = await GET(buildRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns OpenAPI spec for authorized user", async () => {
    const spec = { openapi: "3.0.0", info: { title: "API", version: "1.0.0" } };
    createSwaggerSpec.mockReturnValue(spec);

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
      eq: jest.fn().mockReturnThis(),
    });

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(spec);
  });
});
