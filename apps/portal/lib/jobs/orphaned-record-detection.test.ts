const mockLogError = jest.fn();
jest.mock("@/lib/errors/error-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockFrom = jest.fn();
jest.mock("@repo/supabase/service-role", () => ({
  createServiceRoleClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@repo/utils/inngest", () => ({
  inngest: {
    createFunction: jest.fn((_opts: unknown, handler: unknown) => ({ handler })),
  },
}));

import { orphanedRecordDetectionFn } from "./orphaned-record-detection";

const resultsByTable: Record<string, { data: unknown; error: unknown }> = {};
const insertCalls: { table: string; args: Record<string, unknown> }[] = [];

mockFrom.mockImplementation((table: string) => {
  const result = resultsByTable[table] ?? { data: [], error: null };
  return {
    select: jest.fn().mockReturnValue({
      // .not("col", "in", subquery) — resolves the main query result
      not: jest.fn().mockResolvedValue(result),
      // subqueries like .select("id").eq("active", true) are only used as values
      eq: jest.fn().mockReturnValue({}),
    }),
    insert: jest.fn().mockImplementation((args: Record<string, unknown>) => {
      insertCalls.push({ table, args });
      return Promise.resolve({ error: null });
    }),
  };
});

const handler = (orphanedRecordDetectionFn as any).handler;

describe("orphanedRecordDetectionFn", () => {
  beforeEach(() => {
    Object.keys(resultsByTable).forEach((k) => delete resultsByTable[k]);
    insertCalls.length = 0;
    mockLogError.mockClear();
  });

  it("reports success when no orphaned records exist", async () => {
    const result = await handler({});
    expect(result).toEqual({
      success: true,
      issues_found: 0,
      issues: [],
      total_issues: 0,
    });
    expect(insertCalls).toHaveLength(0);
  });

  it("flags orphaned machine operations with high severity", async () => {
    resultsByTable.machine_operations = {
      data: [{ id: "op1", machine_id: "ghost-machine", operator_id: "emp1" }],
      error: null,
    };

    const result = await handler({});
    // The mock serves the same row to both machine_operations queries, so the
    // row is flagged twice (invalid machine_id + invalid operator_id).
    expect(result.issues).toHaveLength(2);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ type: "invalid_machine_id_in_operations", count: 1 }),
    );
    expect(insertCalls).toContainEqual(
      expect.objectContaining({
        table: "data_integrity_issues",
        args: expect.objectContaining({
          issue_type: "orphaned_record",
          table_name: "machine_operations",
          record_id: "op1",
          severity: "high",
        }),
      }),
    );
  });

  it("flags orphaned hourly loads with medium severity", async () => {
    resultsByTable.hourly_loads = {
      data: [{ id: "hl1", machine_id: "ghost-machine", load_date: "2026-08-17" }],
      error: null,
    };

    const result = await handler({});
    expect(result.issues[0]).toMatchObject({
      type: "hourly_loads_orphaned_machine",
      count: 1,
    });
    expect(insertCalls[0]!.args).toEqual(
      expect.objectContaining({ table_name: "hourly_loads", severity: "medium" }),
    );
  });

  it("reports multiple issue categories and aggregated totals", async () => {
    // NOTE: the mock serves the same row to both machine_operations queries
    // (invalid machine_id AND invalid operator_id), so one row yields two issues.
    resultsByTable.machine_operations = {
      data: [{ id: "op1", machine_id: "m1", operator_id: "emp1", operation_date: "2026-08-17" }],
      error: null,
    };
    resultsByTable.hourly_loads = {
      data: [{ id: "hl1", machine_id: "m1", load_date: "2026-08-17", shift_type: "day" }],
      error: null,
    };
    resultsByTable.shift_status = {
      data: [{ id: "ss1", department_id: "ghost-dept", shift_date: "2026-08-17" }],
      error: null,
    };

    const result = await handler({});
    expect(result.issues_found).toBe(4);
    expect(result.total_issues).toBe(4);
    expect(insertCalls).toHaveLength(4);
  });

  it("logs and re-throws when a query fails", async () => {
    resultsByTable.machine_operations = { data: null, error: new Error("query timeout") };

    await expect(handler({})).rejects.toThrow("query timeout");
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: "orphaned_record_detection_job" }),
    );
  });
});
