/**
 * @jest-environment node
 */
import { GET } from "./route";
import { NextRequest } from "next/server";

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
  machinesQuery?: unknown;
  departmentsQuery?: unknown;
}) {
  const machinesBuilder = createQueryBuilder(
    overrides.machinesQuery ?? { data: [], count: 0, error: null },
  );
  const departmentsBuilder = createQueryBuilder(
    overrides.departmentsQuery ?? { data: null, error: null },
  );

  const from = jest.fn((table: string) => {
    if (table === "machines") return machinesBuilder;
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

describe("GET /api/export/machines", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    createServerSupabaseClient.mockResolvedValue(createSupabase({ authUser: { user: null } }));

    const req = new NextRequest("http://localhost/api/export/machines");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid query parameters", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({ authUser: { user: { id: "1" } } }),
    );

    const req = new NextRequest("http://localhost/api/export/machines?limit=bad");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns JSON machine export with department filter", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        machinesQuery: {
          data: [
            {
              id: "m1",
              name: "Excavator 01",
              machine_type: "excavator",
              serial_number: "SN1",
              bin_factor: 1.2,
              active: true,
              department_id: "dept-1",
              site_id: "site-1",
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          count: 1,
          error: null,
        },
        departmentsQuery: { data: { id: "dept-1" }, error: null },
      }),
    );

    const req = new NextRequest("http://localhost/api/export/machines?dept=Mining", {
      headers: { accept: "application/json" } as Record<string, string>,
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Excavator 01");
    expect(body.count).toBe(1);
  });

  it("returns CSV when Accept header requests text/csv", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        machinesQuery: {
          data: [
            {
              id: "m1",
              name: "Excavator 01",
              machine_type: "excavator",
              serial_number: "SN1",
              bin_factor: 1.2,
              active: true,
              department_id: "dept-1",
              site_id: "site-1",
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          count: 1,
          error: null,
        },
      }),
    );

    const req = new NextRequest("http://localhost/api/export/machines", {
      headers: { accept: "text/csv" } as Record<string, string>,
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("Excavator 01");
    expect(text).toContain("SN1");
  });

  it("returns 500 when database query fails", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        machinesQuery: { data: null, error: { message: "db error" }, count: 0 },
      }),
    );

    const req = new NextRequest("http://localhost/api/export/machines");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
