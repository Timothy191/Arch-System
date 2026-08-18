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
  dailyPdfReportEvent: "reports/daily-pdf",
}));

import { dailyPdfReportGenerationFn } from "./daily-pdf-report-generation";

const handler = (dailyPdfReportGenerationFn as any).handler;

describe("dailyPdfReportGenerationFn", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockLogError.mockClear();
    mockRecordJobExecution.mockClear();
  });

  it("aggregates daily production data and creates generated_reports record", async () => {
    const departments = [{ id: "dept-ops", name: "Operations", slug: "operations" }];
    const mockDeptFinalEq = jest.fn().mockResolvedValue({ data: departments, error: null });
    const mockDeptFirstEq = jest.fn().mockReturnValue({ eq: mockDeptFinalEq });
    const mockDeptSelect = jest.fn().mockReturnValue({ eq: mockDeptFirstEq });

    // Production logs
    const mockProdSecondEq = jest.fn().mockResolvedValue({
      data: [{ coal_tonnes: 1500, waste_tonnes: 3200 }],
      error: null,
    });
    const mockProdFirstEq = jest.fn().mockReturnValue({ eq: mockProdSecondEq });
    const mockProdSelect = jest.fn().mockReturnValue({ eq: mockProdFirstEq });

    // Machine hours
    const mockHoursSecondEq = jest.fn().mockResolvedValue({
      data: [{ hours_operated: 11.5 }],
      error: null,
    });
    const mockHoursFirstEq = jest.fn().mockReturnValue({ eq: mockHoursSecondEq });
    const mockHoursSelect = jest.fn().mockReturnValue({ eq: mockHoursFirstEq });

    // Breakdowns
    const mockBreakSecondEq = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockBreakFirstEq = jest.fn().mockReturnValue({ eq: mockBreakSecondEq });
    const mockBreakSelect = jest.fn().mockReturnValue({ eq: mockBreakFirstEq });

    // Generated reports insert
    const mockSingle = jest.fn().mockResolvedValue({ data: { id: "report-123" }, error: null });
    const mockInsertSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockReportInsert = jest.fn().mockReturnValue({ select: mockInsertSelect });

    // Audit logs insert
    const mockAuditInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "departments") return { select: mockDeptSelect };
      if (table === "production_logs") return { select: mockProdSelect };
      if (table === "machine_hours") return { select: mockHoursSelect };
      if (table === "breakdowns") return { select: mockBreakSelect };
      if (table === "generated_reports") return { insert: mockReportInsert };
      if (table === "audit_logs") return { insert: mockAuditInsert };
      return {};
    });

    const result = await handler({
      event: { data: { date: "2026-08-18", shiftType: "day" } },
      step: {},
    });

    expect(result.success).toBe(true);
    expect(result.reportsGenerated).toBe(1);
    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      "daily-pdf-report-generation",
      expect.any(Number),
      true,
    );
  });
});
