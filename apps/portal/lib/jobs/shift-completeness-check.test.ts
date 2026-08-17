const mockLogError = jest.fn();
jest.mock("@/lib/errors/error-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockGetShiftCompleteness = jest.fn();
jest.mock("@/lib/shift-completeness", () => ({
  getShiftCompleteness: (...args: unknown[]) => mockGetShiftCompleteness(...args),
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

import { shiftCompletenessCheckFn } from "./shift-completeness-check";

function mockDepartments(data: unknown) {
  const mockFinalEq = jest.fn().mockResolvedValue({ data, error: null });
  const mockFirstEq = jest.fn().mockReturnValue({ eq: mockFinalEq });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockFirstEq });
  mockFrom.mockImplementation((table: string) =>
    table === "departments"
      ? { select: mockSelect }
      : { insert: jest.fn().mockResolvedValue({ error: null }) },
  );
}

const handler = (shiftCompletenessCheckFn as any).handler;

describe("shiftCompletenessCheckFn", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockLogError.mockClear();
    mockGetShiftCompleteness.mockClear();
    mockGetShiftCompleteness.mockResolvedValue({ statuses: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns early when no active departments exist", async () => {
    mockDepartments([]);

    const result = await handler({ step: {} });
    expect(result).toEqual({ success: true, message: "No active departments found" });
    expect(mockGetShiftCompleteness).not.toHaveBeenCalled();
  });

  it("skips non-control-room departments", async () => {
    mockDepartments([{ id: "dept-drill", name: "drilling" }]);

    const result = await handler({ step: {} });
    expect(result).toEqual({
      success: true,
      departments_checked: 1,
      alerts_generated: 0,
      alerts: [],
    });
    expect(mockGetShiftCompleteness).not.toHaveBeenCalled();
  });

  it("creates an alert for missing machines more than 30 minutes into the shift", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-17T10:00:00"));

    mockDepartments([{ id: "dept-cr", name: "control-room" }]);
    mockGetShiftCompleteness.mockResolvedValue({
      statuses: [
        { exempt: false, hasEntry: true, machineName: "D1" },
        { exempt: false, hasEntry: false, machineName: "D2" },
        { exempt: true, hasEntry: false, machineName: "D3" },
      ],
    });

    const result = await handler({ step: {} });
    expect(result.alerts_generated).toBe(1);
    expect(result.alerts[0]).toContain("D2");

    const alertBuilder = mockFrom.mock.results.find((r) => r.value.insert)!.value;
    expect(alertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        department_id: "dept-cr",
        shift_type: "day",
        missing_machine_count: 1,
        missing_machines: "D2",
        resolved: false,
      }),
    );
  });

  it("does not alert when still within the first 30 minutes of the shift", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-17T06:10:00"));

    mockDepartments([{ id: "dept-cr", name: "control-room" }]);
    mockGetShiftCompleteness.mockResolvedValue({
      statuses: [{ exempt: false, hasEntry: false, machineName: "D2" }],
    });

    const result = await handler({ step: {} });
    expect(result.alerts_generated).toBe(0);
    expect(result.alerts).toEqual([]);
  });

  it("logs and re-throws when the departments query fails", async () => {
    const mockFinalEq = jest.fn().mockResolvedValue({ data: null, error: new Error("db down") });
    const mockFirstEq = jest.fn().mockReturnValue({ eq: mockFinalEq });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockFirstEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    await expect(handler({ step: {} })).rejects.toThrow("db down");
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: "shift_completeness_check_job" }),
    );
  });
});
