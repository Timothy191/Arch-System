const mockLogError = jest.fn();
jest.mock("@/lib/errors/error-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockFrom = jest.fn();
jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@repo/utils/inngest", () => ({
  inngest: {
    createFunction: jest.fn((_opts: unknown, handler: unknown) => ({ handler })),
  },
}));

import { generateReportFn } from "./report-generation";

const resultsByTable: Record<string, { data: unknown; error: unknown }> = {};
let insertResult: { error: unknown } = { error: null };
const insertCalls: { table: string; args: unknown }[] = [];

mockFrom.mockImplementation((table: string) => {
  const result = resultsByTable[table] ?? { data: [], error: null };
  const lte = jest.fn().mockResolvedValue(result);
  const gte = jest.fn().mockReturnValue({ lte });
  const eq = jest.fn().mockReturnValue({ gte });
  const select = jest.fn().mockReturnValue({ eq });
  return {
    select,
    insert: jest.fn().mockImplementation((args: unknown) => {
      insertCalls.push({ table, args });
      return Promise.resolve(insertResult);
    }),
  };
});

const handler = (generateReportFn as any).handler;

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      data: { departmentId: "dept-1", dateFrom: "2026-08-01", dateTo: "2026-08-17", ...overrides },
    },
  };
}

describe("generateReportFn", () => {
  beforeEach(() => {
    Object.keys(resultsByTable).forEach((k) => delete resultsByTable[k]);
    insertCalls.length = 0;
    insertResult = { error: null };
    mockLogError.mockClear();
  });

  it("aggregates logs and inserts a report", async () => {
    resultsByTable.daily_logs = {
      data: [{ id: "l1" }, { id: "l2" }],
      error: null,
    };
    resultsByTable.production_logs = {
      data: [
        { coal_tonnes: 100, waste_tonnes: 50 },
        { coal_tonnes: 50, waste_tonnes: null },
        { coal_tonnes: null, waste_tonnes: 25 },
      ],
      error: null,
    };

    const result = await handler(makeEvent());
    expect(result.success).toBe(true);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]!.table).toBe("generated_reports");
    expect(insertCalls[0]!.args).toEqual(
      expect.objectContaining({
        department_id: "dept-1",
        date_from: "2026-08-01",
        date_to: "2026-08-17",
        total_shifts: 2,
        total_coal_tonnes: 150,
        total_waste_tonnes: 75,
      }),
    );
  });

  it("handles empty logs with zero aggregates", async () => {
    resultsByTable.daily_logs = { data: [], error: null };
    resultsByTable.production_logs = { data: [], error: null };

    const result = await handler(makeEvent());
    expect(result.report).toEqual(
      expect.objectContaining({ total_shifts: 0, total_coal_tonnes: 0, total_waste_tonnes: 0 }),
    );
  });

  it("logs and re-throws when the report insert fails", async () => {
    insertResult = { error: new Error("insert failed") };

    await expect(handler(makeEvent())).rejects.toThrow("insert failed");
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: "generate_report_job", departmentId: "dept-1" }),
    );
  });
});
