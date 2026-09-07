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
  tiresQuery?: unknown;
  inspectionsQuery?: unknown;
}) {
  const tiresBuilder = createQueryBuilder(overrides.tiresQuery ?? { data: [], error: null });
  const inspectionsBuilder = createQueryBuilder(
    overrides.inspectionsQuery ?? { data: [], error: null },
  );

  const from = jest.fn((table: string) => {
    if (table === "tires") return tiresBuilder;
    if (table === "tire_inspections") return inspectionsBuilder;
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

describe("GET /api/export/tires", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    createServerSupabaseClient.mockResolvedValue(createSupabase({ authUser: { user: null } }));

    const req = new NextRequest("http://localhost/api/export/tires");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns JSON export for type=all", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        tiresQuery: {
          data: [{ id: "t1", serial_number: "S1", machines: { name: "M1" } }],
          error: null,
        },
        inspectionsQuery: {
          data: [{ id: "i1", inspection_date: "2026-01-01" }],
          error: null,
        },
      }),
    );

    const req = new NextRequest("http://localhost/api/export/tires?type=all&format=json", {
      headers: { accept: "application/json" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.exportType).toBe("all");
    expect(body.tires).toHaveLength(1);
    expect(body.tires[0].serial_number).toBe("S1");
  });

  it("returns CSV for inspections type", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        tiresQuery: { data: [], error: null },
        inspectionsQuery: {
          data: [
            {
              id: "i1",
              inspection_date: "2026-01-01",
              tread_depth_mm: 8,
              pressure_psi: 100,
              condition_status: "good",
              notes: "ok",
              tires: {
                serial_number: "S1",
                brand: "B1",
                size: "R16",
                position: "FL",
                machines: { name: "M1" },
              },
            },
          ],
          error: null,
        },
      }),
    );

    const req = new NextRequest("http://localhost/api/export/tires?type=inspections", {
      headers: { accept: "text/csv" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("Inspection ID");
    expect(text).toContain("i1");
  });

  it("returns 500 when tire query fails", async () => {
    createServerSupabaseClient.mockResolvedValue(
      createSupabase({
        authUser: { user: { id: "1" } },
        tiresQuery: { data: null, error: { message: "boom" } },
        inspectionsQuery: { data: null, error: { message: "boom" } },
      }),
    );

    const req = new NextRequest("http://localhost/api/export/tires");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
