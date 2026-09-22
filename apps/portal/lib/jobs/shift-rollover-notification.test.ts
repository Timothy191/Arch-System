const mockLogError = jest.fn();
jest.mock("@/lib/errors/error-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockRecordJobExecution = jest.fn();
jest.mock("@/lib/observability/simple-metrics", () => ({
  recordJobExecution: (...args: unknown[]) => mockRecordJobExecution(...args),
}));

const mockFrom = jest.fn();
jest.mock("@repo/supabase/service-role", () => ({
  createServiceRoleClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@repo/utils/inngest", () => ({
  inngest: {
    createFunction: jest.fn((_opts: unknown, handler: unknown) => ({ handler })),
  },
  shiftRolloverNotificationEvent: "notifications/shift-rollover",
}));

import { shiftRolloverNotificationFn } from "./shift-rollover-notification";

const handler = (shiftRolloverNotificationFn as any).handler;

describe("shiftRolloverNotificationFn", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockLogError.mockClear();
    mockRecordJobExecution.mockClear();
  });

  it("returns early when no active operational departments exist", async () => {
    const mockFinalEq = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockFirstEq = jest.fn().mockReturnValue({ eq: mockFinalEq });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockFirstEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === "departments") return { select: mockSelect };
      return {};
    });

    const result = await handler({ step: {} });
    expect(result).toEqual({ success: true, message: "No active operational departments found" });
    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      "shift-rollover-notifications",
      expect.any(Number),
      true,
    );
  });

  it("processes active departments and emits rollover reminder if shift log not closed", async () => {
    const departments = [{ id: "dept-1", name: "mining", slug: "mining" }];
    const mockDeptFinalEq = jest.fn().mockResolvedValue({ data: departments, error: null });
    const mockDeptFirstEq = jest.fn().mockReturnValue({ eq: mockDeptFinalEq });
    const mockDeptSelect = jest.fn().mockReturnValue({ eq: mockDeptFirstEq });

    const mockLogsFinalEq = jest
      .fn()
      .mockResolvedValue({ data: [{ id: "log-1", status: "open" }], error: null });
    const mockLogsSecondEq = jest.fn().mockReturnValue({ eq: mockLogsFinalEq });
    const mockLogsFirstEq = jest.fn().mockReturnValue({ eq: mockLogsSecondEq });
    const mockLogsSelect = jest.fn().mockReturnValue({ eq: mockLogsFirstEq });

    const mockInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "departments") return { select: mockDeptSelect };
      if (table === "daily_logs") return { select: mockLogsSelect };
      if (table === "audit_logs") return { insert: mockInsert };
      return {};
    });

    const result = await handler({ step: {} });
    expect(result.success).toBe(true);
    expect(result.departmentsChecked).toBe(1);
    expect(result.notifications).toEqual([{ department: "mining", status: "pending_closeout" }]);
    expect(mockInsert).toHaveBeenCalled();
  });
});
