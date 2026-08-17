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

import { addDays, shiftIntegrityReportFn, timeAtOperationalZone } from "./shift-integrity";

const resultsByTable: Record<string, { data: unknown; error: unknown }> = {};
const insertCalls: { table: string; args: unknown }[] = [];
let insertResult: { error: unknown } = { error: null };

interface QueryChain {
  select: jest.Mock;
  eq: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  order: jest.Mock;
  insert: jest.Mock;
  then: (..._args: unknown[]) => Promise<unknown>;
}

function makeChain(table: string): QueryChain {
  const result = resultsByTable[table] ?? { data: [], error: null };
  const terminal = Promise.resolve(result);
  const chain: QueryChain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    insert: jest.fn((insertArgs: unknown) => {
      insertCalls.push({ table, args: insertArgs });
      return Promise.resolve(insertResult);
    }),
    then: terminal.then.bind(terminal) as QueryChain["then"],
  };
  return chain;
}

mockFrom.mockImplementation((table: string) => makeChain(table));

const handler = (shiftIntegrityReportFn as any).handler;

describe("shiftIntegrityReportFn", () => {
  beforeEach(() => {
    Object.keys(resultsByTable).forEach((k) => delete resultsByTable[k]);
    insertCalls.length = 0;
    insertResult = { error: null };
    mockLogError.mockClear();
  });

  it("computes shift, data quality, and operational metrics from the week's data", async () => {
    // closed_at values are pinned to SAST so on-time counts are deterministic:
    //   17:30Z = 19:30 SAST (day, within 20:00 grace)        -> on time
    //   05:30Z = 07:30 SAST (night, within 08:00 grace)       -> on time
    //   19:00Z = 21:00 SAST (day, past 20:00 grace)           -> NOT on time
    resultsByTable.shift_status = {
      data: [
        {
          shift_date: "2026-08-10",
          shift_type: "day",
          status: "closed",
          closed_at: "2026-08-10T17:30:00Z",
        },
        {
          shift_date: "2026-08-10",
          shift_type: "night",
          status: "closed",
          closed_at: "2026-08-11T05:30:00Z",
        },
        {
          shift_date: "2026-08-11",
          shift_type: "day",
          status: "closed",
          closed_at: "2026-08-11T19:00:00Z",
        },
        { shift_date: "2026-08-12", shift_type: "day", status: "open", closed_at: null },
      ],
      error: null,
    };
    resultsByTable.shift_completeness_alerts = {
      data: [{ resolved: false }, { resolved: true }, { resolved: false }],
      error: null,
    };
    resultsByTable.data_integrity_issues = {
      data: [
        { resolved: false, severity: "high" },
        { resolved: false, severity: "low" },
        { resolved: true, severity: "critical" },
      ],
      error: null,
    };
    resultsByTable.machines = {
      data: [
        { id: "m1", active: true },
        { id: "m2", active: true },
      ],
      error: null,
    };
    resultsByTable.machine_operations = {
      data: [
        { id: "op1" },
        { id: "op2" },
        { id: "op3" },
        { id: "op4" },
        { id: "op5" },
        { id: "op6" },
        { id: "op7" },
      ],
      error: null,
    };

    const result = await handler({});
    expect(result.success).toBe(true);

    expect(result.report.shift_metrics).toEqual({
      total_shifts: 4,
      closed_shifts: 3,
      shifts_closed_on_time: 2,
      on_time_close_rate: 50,
    });
    expect(result.report.data_quality).toEqual({
      total_alerts: 3,
      unresolved_alerts: 2,
      data_quality_score: 90,
    });
    expect(result.report.data_integrity).toEqual({
      total_issues: 3,
      unresolved_issues: 2,
      high_severity_unresolved: 1,
    });
    expect(result.report.operational_kpis).toEqual({
      active_machines: 2,
      total_operations: 7,
      avg_operations_per_day: "1.00",
    });

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]!.table).toBe("shift_integrity_reports");
    expect(insertCalls[0]!.args).toEqual(
      expect.objectContaining({ report_date: expect.any(String) }),
    );
  });

  it("zeroes out metrics when there is no data", async () => {
    const result = await handler({});
    expect(result.report.shift_metrics.on_time_close_rate).toBe(0);
    expect(result.report.data_quality.data_quality_score).toBe(100);
    expect(result.report.operational_kpis.avg_operations_per_day).toBe(0);
  });

  it("logs and re-throws when a query fails", async () => {
    resultsByTable.shift_status = { data: null, error: new Error("shift_status query failed") };

    await expect(handler({})).rejects.toThrow("shift_status query failed");
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: "shift_integrity_report_job" }),
    );
  });
});

describe("timeAtOperationalZone", () => {
  it("maps SAST times to the correct UTC instant (SAST = UTC+2)", () => {
    // 20:00 SAST == 18:00 UTC
    expect(timeAtOperationalZone("2026-08-10", "20:00").toISOString()).toBe(
      "2026-08-10T18:00:00.000Z",
    );
    // 08:00 SAST == 06:00 UTC
    expect(timeAtOperationalZone("2026-08-10", "08:00").toISOString()).toBe(
      "2026-08-10T06:00:00.000Z",
    );
  });

  it("supports arbitrary IANA zones", () => {
    expect(timeAtOperationalZone("2026-08-10", "20:00", "UTC").toISOString()).toBe(
      "2026-08-10T20:00:00.000Z",
    );
  });
});

describe("addDays", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles negative offsets", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
