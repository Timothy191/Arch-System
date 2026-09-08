/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

jest.mock("@/lib/shift-completeness", () => ({
  getShiftCompleteness: jest.fn(),
}));

const { getShiftCompleteness } = jest.requireMock("@/lib/shift-completeness");

function buildSupabaseAuth(user: unknown) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

describe("GET /api/control-room/shift-completeness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    createServerSupabaseClient.mockResolvedValue(buildSupabaseAuth(null));

    const req = new NextRequest("http://localhost:3000/api/control-room/shift-completeness");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when required query params are missing", async () => {
    createServerSupabaseClient.mockResolvedValue(buildSupabaseAuth({ id: "user-1" }));

    const req = new NextRequest("http://localhost:3000/api/control-room/shift-completeness");
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Missing required params: deptId, deptSlug, date, shift",
    });
  });

  it("returns 200 with completeness payload when authenticated and params are present", async () => {
    createServerSupabaseClient.mockResolvedValue(buildSupabaseAuth({ id: "user-1" }));
    getShiftCompleteness.mockResolvedValue({
      complete: true,
      missing: [],
      coverage: 1,
    });

    const req = new NextRequest(
      "http://localhost:3000/api/control-room/shift-completeness?deptId=dept-1&deptSlug=ops&date=2026-09-07&shift=day"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      complete: true,
      missing: [],
      coverage: 1,
    });
    expect(getShiftCompleteness).toHaveBeenCalledWith(
      expect.anything(),
      "dept-1",
      "ops",
      "2026-09-07",
      "day"
    );
  });
});
