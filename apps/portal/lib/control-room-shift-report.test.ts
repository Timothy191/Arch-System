/**
 * @jest-environment node
 */
import { submitShiftReport, getShiftReport } from "./control-room-shift-report";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@repo/supabase/service-role", () => ({
  createServiceRoleClient: jest.fn(),
}));

const mockLogAuditEvent = jest.fn();
jest.mock("./audit", () => ({ logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args) }));

jest.mock("@/lib/errors/error-logger", () => ({ logError: jest.fn() }));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");
const { createServiceRoleClient } = jest.requireMock("@repo/supabase/service-role");

const DEPT_ID = "12345678-1234-4234-8234-1234567890ab";
const DATE = "2026-08-18";
const SHIFT = "day" as const;

const validInput = {
  departmentId: DEPT_ID,
  date: DATE,
  shift: SHIFT,
  alarmResponseAvgSeconds: 42,
  incidentAckAvgSeconds: 18,
  systemUptimePercent: 99.98,
  missedIncidentsCount: 0,
  summaryNotes: "Quiet shift",
  operatorName: "Jane Operator",
  completedChecklistCount: 8,
  totalChecklistCount: 8,
  checklistItems: [],
  supervisorSignature: null,
};

// Server client resolves a single terminal result per table (auth + reads).
const serverResults: Record<string, { data: unknown; error: unknown }> = {};
// Service client resolves from a per-table FIFO queue: the existing-lookup
// (maybeSingle) consumes the first entry, the write (single) the second.
const serviceQueues: Record<string, { data: unknown; error: unknown }[]> = {};
const insertCalls: { table: string; args: unknown }[] = [];
const updateCalls: { table: string; args: unknown }[] = [];

function makeBuilder(table: string, resolve: () => { data: unknown; error: unknown }) {
  const chain: Record<string, any> = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    update: jest.fn((args: unknown) => {
      updateCalls.push({ table, args });
      return chain;
    }),
    insert: jest.fn((args: unknown) => {
      insertCalls.push({ table, args });
      return chain;
    }),
    maybeSingle: jest.fn(() => Promise.resolve(resolve())),
    single: jest.fn(() => Promise.resolve(resolve())),
  };
  return chain;
}

function mockServerClient(
  overrides: { user?: unknown; employee?: unknown; report?: unknown } = {},
) {
  const { user = { id: "user-1" }, employee = { id: "emp-1" }, report = null } = overrides;
  const builders: Record<string, ReturnType<typeof makeBuilder>> = {};
  const from = jest.fn((table: string) => {
    if (!builders[table]) {
      builders[table] = makeBuilder(
        table,
        () => serverResults[table] ?? { data: null, error: null },
      );
    }
    return builders[table];
  });
  createServerSupabaseClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
  });
  // Wire per-table results for the server client.
  serverResults.employees = { data: employee, error: null };
  serverResults.control_room_shift_reports = { data: report, error: null };
  return { from, builders };
}

function mockServiceClient(existing: unknown = null, writeResult: unknown = null) {
  const builders: Record<string, ReturnType<typeof makeBuilder>> = {};
  const from = jest.fn((table: string) => {
    if (!builders[table]) {
      builders[table] = makeBuilder(
        table,
        () => serviceQueues[table]?.shift() ?? { data: null, error: null },
      );
    }
    return builders[table];
  });
  createServiceRoleClient.mockReturnValue({ from });
  serviceQueues.control_room_shift_reports = [
    { data: existing, error: null },
    { data: writeResult, error: null },
  ];
  return { from, builders };
}

describe("submitShiftReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete serverResults.control_room_shift_reports;
    delete serverResults.employees;
    delete serviceQueues.control_room_shift_reports;
    insertCalls.length = 0;
    updateCalls.length = 0;
  });

  it("throws AuthError when user is not logged in", async () => {
    mockServerClient({ user: null });
    await expect(submitShiftReport(validInput)).rejects.toThrow("Unauthorized");
  });

  it("throws AuthError when employee record is missing", async () => {
    mockServerClient({ employee: null });
    await expect(submitShiftReport(validInput)).rejects.toThrow("Unauthorized");
  });

  it("inserts a new report when none exists for (dept, date, shift)", async () => {
    mockServerClient();
    mockServiceClient(null, { id: "report-1" });

    const result = await submitShiftReport(validInput);

    expect(result).toEqual({ success: true, reportId: "report-1" });
    const insert = insertCalls.find((c) => c.table === "control_room_shift_reports");
    expect(insert).toBeDefined();
    expect(insert!.args).toMatchObject({
      department_id: DEPT_ID,
      report_date: DATE,
      shift_type: SHIFT,
      operator_name: "Jane Operator",
      created_by: "emp-1",
    });
    expect(updateCalls).toHaveLength(0);
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: "insert",
      tableName: "control_room_shift_reports",
      recordId: "report-1",
      departmentId: DEPT_ID,
    });
  });

  it("updates the existing report in place, preserving created_by", async () => {
    mockServerClient();
    mockServiceClient({ id: "report-1" }, { id: "report-1" });

    const result = await submitShiftReport(validInput);

    expect(result).toEqual({ success: true, reportId: "report-1" });
    const update = updateCalls.find((c) => c.table === "control_room_shift_reports");
    expect(update).toBeDefined();
    // created_by must NOT be in the update payload — original author preserved.
    expect(update!.args).not.toHaveProperty("created_by");
    expect(insertCalls).toHaveLength(0);
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: "update",
      tableName: "control_room_shift_reports",
      recordId: "report-1",
      departmentId: DEPT_ID,
    });
  });

  it("rejects invalid input at the boundary", async () => {
    mockServerClient();
    await expect(submitShiftReport({ ...validInput, systemUptimePercent: 150 })).rejects.toThrow();
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });
});

describe("getShiftReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete serverResults.control_room_shift_reports;
    delete serverResults.employees;
    delete serviceQueues.control_room_shift_reports;
  });

  it("returns null when no report exists", async () => {
    mockServerClient({ report: null });
    await expect(getShiftReport(DEPT_ID, DATE, SHIFT)).resolves.toBeNull();
  });

  it("maps a stored report to the camelCase record shape", async () => {
    mockServerClient({
      report: {
        id: "report-1",
        department_id: DEPT_ID,
        report_date: DATE,
        shift_type: SHIFT,
        operator_name: "Jane Operator",
        alarm_response_avg_seconds: 42,
        incident_ack_avg_seconds: 18,
        system_uptime_percent: 99.98,
        missed_incidents_count: 0,
        summary_notes: "Quiet shift",
        checklist_items: [],
        completed_checklist_count: 8,
        total_checklist_count: 8,
        supervisor_signature: null,
        created_at: "2026-08-18T06:00:00Z",
        updated_at: "2026-08-18T06:00:00Z",
      },
    });

    const result = await getShiftReport(DEPT_ID, DATE, SHIFT);

    expect(result).toMatchObject({
      id: "report-1",
      departmentId: DEPT_ID,
      date: DATE,
      shift: SHIFT,
      operatorName: "Jane Operator",
      alarmResponseAvgSeconds: 42,
      systemUptimePercent: 99.98,
      checklistItems: [],
    });
  });
});
