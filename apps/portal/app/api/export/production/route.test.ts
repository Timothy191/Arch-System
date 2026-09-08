/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number;
};

function isQueryResult(value: unknown): value is QueryResult {
  return typeof value === "object" && value !== null && "data" in value && "error" in value;
}

class QueryBuilder {
  select = jest.fn(() => this);
  order = jest.fn(() => this);
  eq = jest.fn(() => this);
  gte = jest.fn(() => this);
  lte = jest.fn(() => this);
  range = jest.fn(() => this);
  single = jest.fn();

  constructor(private readonly _result: unknown) {}

  then(onFulfilled: (_value: unknown) => unknown) {
    return Promise.resolve(this._result).then(onFulfilled);
  }
}

function createQueryBuilder(result: unknown) {
  const builder = new QueryBuilder(result);
  if (isQueryResult(result)) {
    builder.single.mockResolvedValue(result);
  }
  return builder;
}

function createSupabase(overrides: {
  authUser?: { user: { id: string } | null };
  dailyLogsQuery?: unknown;
  departmentsQuery?: unknown;
}) {
  const dailyLogsBuilder = createQueryBuilder(
    overrides.dailyLogsQuery ?? { data: [], count: 0, error: null }
  );
  const departmentsBuilder = createQueryBuilder(
    overrides.departmentsQuery ?? { data: null, error: null }
  );

  const from = jest.fn((table: string) => {
    if (table === "daily_logs") return dailyLogsBuilder;
    if (table === "departments") return departmentsBuilder;
    return createQueryBuilder({ data: null, error: null });
  });

  return {
    from,
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: overrides.authUser?.user ?? null },
      }),
    },
  };
}

describe("GET /api/export/production", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    createServerSupabaseClient.mockResolvedValue(createSupabase({ authUser: { user: null } }));

    const req = new NextRequest("http://localhost/api/export/production");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid query parameters", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({ authUser: { user: { id: "1" } } })
    );

    const req = new NextRequest("http://localhost/api/export/production?limit=bad");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns JSON production export with department filter", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        dailyLogsQuery: {
          data: [
            {
              id: "dl1",
              log_date: "2026-01-01",
              shift: "day",
              department_id: "dept-1",
              production_logs: { coal_tonnes: 10, waste_tonnes: 2 },
            },
          ],
          count: 1,
          error: null,
        },
        departmentsQuery: { data: { id: "dept-1" }, error: null },
      })
    );

    const req = new NextRequest(
      "http://localhost/api/export/production?from=2026-01-01&to=2026-01-02&dept=Mining",
      { headers: { accept: "application/json" } }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].coal_tonnes).toBe("10.00");
    expect(body.data[0].waste_tonnes).toBe("2.00");
    expect(body.data[0].total_tonnes).toBe("12.00");
  });

  it("returns CSV when Accept header requests text/csv", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        dailyLogsQuery: {
          data: [
            {
              id: "dl1",
              log_date: "2026-01-01",
              shift: "day",
              department_id: "dept-1",
              production_logs: { coal_tonnes: 5, waste_tonnes: 1 },
            },
          ],
          count: 1,
          error: null,
        },
      })
    );

    const req = new NextRequest("http://localhost/api/export/production", {
      headers: { accept: "text/csv" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("log_date");
    expect(text).toContain("2026-01-01");
  });

  it("returns 500 when database query fails", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        dailyLogsQuery: { data: null, error: { message: "db error" }, count: 0 },
      })
    );

    const req = new NextRequest("http://localhost/api/export/production");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
