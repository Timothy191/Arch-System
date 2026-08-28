/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@repo/supabase/server", () => ({
  getUserSafely: jest.fn(),
}));

jest.mock("@/lib/api/rate-limit-middleware", () => ({
  withRateLimit: jest.fn((req, handler) => handler()),
}));

const { getUserSafely } = require("@repo/supabase/server");

describe("GET /api/metabase/embed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if user is unauthenticated", async () => {
    getUserSafely.mockResolvedValueOnce({ user: null, error: new Error("No session") });

    const req = new NextRequest("http://localhost:3000/api/metabase/embed?dashboardId=1");
    const res = await GET(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe("Unauthorized access");
  });

  it("returns 400 if dashboardId parameter is missing", async () => {
    getUserSafely.mockResolvedValueOnce({ user: { id: "usr_123" }, error: null });

    const req = new NextRequest("http://localhost:3000/api/metabase/embed");
    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Missing dashboardId parameter");
  });

  it("generates a valid signed Metabase iframe URL for authenticated user", async () => {
    getUserSafely.mockResolvedValueOnce({ user: { id: "usr_123" }, error: null });

    const req = new NextRequest(
      "http://localhost:3000/api/metabase/embed?dashboardId=42&departmentId=dept_drilling",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.iframeUrl).toContain("/embed/dashboard/");
    expect(json.expiresInSeconds).toBe(600);
  });
});
