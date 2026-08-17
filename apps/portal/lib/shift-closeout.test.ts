/**
 * @jest-environment node
 */
import bcrypt from "bcryptjs";

const mockGetUser = jest.fn();
const mockFrom = jest.fn();
jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => ({ from: mockFrom, auth: { getUser: mockGetUser } })),
}));

jest.mock("@/lib/observability/tracing", () => ({
  withAsyncSpan: jest.fn((_name: string, _attrs: unknown, fn: () => unknown) => fn()),
  addEvent: jest.fn(),
  setAttributes: jest.fn(),
}));

const mockLogAuditEvent = jest.fn();
const mockRevalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

jest.mock("./audit", () => ({ logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args) }));

const mockGetShiftCompleteness = jest.fn();
jest.mock("./shift-completeness", () => {
  const actual = jest.requireActual("./shift-completeness") as Record<string, unknown>;
  return {
    ...actual,
    getShiftCompleteness: (...args: unknown[]) => mockGetShiftCompleteness(...args),
  };
});

// Redis disabled by default (rate limiter + lockout bypassed); enabled per test.
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn(() =>
    Promise.resolve(
      redisEnabled.value
        ? { isOpen: true, get: mockRedisGet, set: mockRedisSet, del: mockRedisDel }
        : null,
    ),
  ),
}));
const redisEnabled: { value: boolean } = { value: false };

import { setPin, verifyPin, closeShift } from "./shift-closeout";

// Single-result chain — single() resolves from a per-table FIFO queue so the
// same table can serve both the "existing record" and "inserted record" checks.
const singleQueues: Record<string, { data: unknown; error: unknown }[]> = {};
const insertCalls: { table: string; args: unknown }[] = [];
const updateCalls: { table: string; args: unknown }[] = [];

interface BuilderChain {
  select: jest.Mock;
  eq: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
  single: jest.Mock;
  then: (..._args: unknown[]) => Promise<{ data: unknown; error: unknown }>;
}

function makeBuilder(table: string) {
  const terminal = Promise.resolve({ data: null, error: null });
  const chain: BuilderChain = {
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
    single: jest.fn(() => {
      const queue = singleQueues[table] ?? [];
      return Promise.resolve(queue.shift() ?? { data: null, error: null });
    }),
    // Non-single terminals (e.g. `.select(...).eq(...)` without `.single()`)
    // are awaited directly — make the chain awaitable to `{data: null}`.
    then: terminal.then.bind(terminal) as BuilderChain["then"],
  };
  return chain;
}

mockFrom.mockImplementation((table: string) => makeBuilder(table));

describe("setPin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    singleQueues.employees = [{ data: { id: "e1", role: "supervisor" }, error: null }];
  });

  it("throws AuthError when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(setPin("EMP-1", "1234")).rejects.toThrow("Not authenticated");
  });

  it("throws NotFoundError when the employee is missing", async () => {
    singleQueues.employees = [{ data: null, error: { message: "not found" } }];
    await expect(setPin("EMP-1", "1234")).rejects.toThrow("Employee not found");
  });

  it("throws ForbiddenError for non-supervisor roles", async () => {
    singleQueues.employees = [{ data: { id: "e1", role: "operator" }, error: null }];
    await expect(setPin("EMP-1", "1234")).rejects.toThrow("Only supervisors and admins");
  });

  it("hashes the PIN and updates the employee", async () => {
    const result = await setPin("EMP-1", "4321");
    expect(result).toEqual({ success: true });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.table).toBe("employees");
    expect(updateCalls[0]!.args).toEqual(
      expect.objectContaining({ employee_code: "EMP-1", pin_hash: expect.any(String) }),
    );
    const hash = (updateCalls[0]!.args as { pin_hash: string }).pin_hash;
    await expect(bcrypt.compare("4321", hash)).resolves.toBe(true);
  });
});

describe("verifyPin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisEnabled.value = false;
  });

  it("returns lockedOut when the attempt lockout is active", async () => {
    redisEnabled.value = true;
    mockRedisGet.mockResolvedValue(
      JSON.stringify({ count: 3, firstAttempt: Date.now(), lockedUntil: Date.now() + 600000 }),
    );

    const result = await verifyPin("EMP-1", "1234");
    expect(result).toEqual(expect.objectContaining({ valid: false, lockedOut: true }));
  });

  it("returns invalid when no employee matches the code", async () => {
    singleQueues.employees = [{ data: null, error: { message: "missing" } }];
    const result = await verifyPin("EMP-1", "1234");
    expect(result).toEqual({ valid: false, employee: null });
  });

  it("rejects a wrong PIN and records the failed attempt", async () => {
    redisEnabled.value = true;
    mockRedisGet.mockResolvedValue(null);
    const hash = await bcrypt.hash("1111", 4);
    singleQueues.employees = [
      { data: { id: "e1", full_name: "Jane", pin_hash: hash }, error: null },
    ];

    const result = await verifyPin("EMP-1", "9999");
    expect(result.valid).toBe(false);
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringContaining("pin_attempts:"),
      expect.any(String),
      expect.objectContaining({ EX: expect.any(Number) }),
    );
  });

  it("accepts a correct PIN and returns the employee", async () => {
    const hash = await bcrypt.hash("1111", 4);
    singleQueues.employees = [
      { data: { id: "e1", full_name: "Jane", pin_hash: hash }, error: null },
    ];

    const result = await verifyPin("EMP-1", "1111");
    expect(result.valid).toBe(true);
    expect(result.employee).toEqual({ id: "e1", full_name: "Jane" });
  });
});

describe("closeShift", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisEnabled.value = false;
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    singleQueues.shift_status = [{ data: null, error: null }];
    singleQueues.employees = [
      { data: { id: "e1" }, error: null }, // closedBy
    ];
    mockGetShiftCompleteness.mockResolvedValue({
      statuses: [{ machineId: "m1", machineName: "D1", exempt: false, hasEntry: true }],
    });
    insertCalls.length = 0;
  });

  it("throws AuthError when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(closeShift("d1", "2026-08-17", "day", "appr-1", "1234")).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("returns validation errors when machines are missing", async () => {
    mockGetShiftCompleteness.mockResolvedValue({
      statuses: [{ machineId: "m1", machineName: "D1", exempt: false, hasEntry: false }],
    });

    const result = await closeShift("d1", "2026-08-17", "day", "appr-1", "1234");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Machine 'D1': not reported");
    expect(insertCalls).toHaveLength(0);
  });

  it("short-circuits on validateOnly", async () => {
    const result = await closeShift("d1", "2026-08-17", "day", "appr-1", "1234", true);
    expect(result).toEqual({ success: true });
    expect(insertCalls).toHaveLength(0);
  });

  it("rejects when the approving supervisor has no PIN set", async () => {
    singleQueues.employees = [
      { data: { id: "e1" }, error: null }, // closedBy
      { data: { id: "appr-1", pin_hash: null }, error: null }, // approver
    ];

    const result = await closeShift("d1", "2026-08-17", "day", "appr-1", "1234");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Approving supervisor not found or has no PIN set");
  });

  it("rejects an invalid supervisor PIN", async () => {
    const hash = await bcrypt.hash("1111", 4);
    singleQueues.employees = [
      { data: { id: "e1" }, error: null }, // closedBy
      { data: { id: "appr-1", pin_hash: hash }, error: null }, // approver
    ];

    const result = await closeShift("d1", "2026-08-17", "day", "appr-1", "9999");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Invalid supervisor PIN");
  });

  it("closes the shift, audits, and returns the shift status id", async () => {
    const hash = await bcrypt.hash("1111", 4);
    singleQueues.employees = [
      { data: { id: "e1" }, error: null }, // closedBy
      { data: { id: "appr-1", pin_hash: hash }, error: null }, // approver
    ];
    singleQueues.shift_status = [
      { data: null, error: null }, // existing check
      { data: { id: "ss-1" }, error: null }, // inserted
    ];

    const result = await closeShift(
      "d1",
      "2026-08-17",
      "day",
      "appr-1",
      "1111",
      false,
      "control-room",
    );
    expect(result).toEqual({ success: true, shiftStatusId: "ss-1" });

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]!.args).toEqual(
      expect.objectContaining({
        department_id: "d1",
        shift_date: "2026-08-17",
        shift_type: "day",
        status: "closed",
        closed_by: "e1",
        approved_by: "appr-1",
      }),
    );
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "insert", tableName: "shift_status", recordId: "ss-1" }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/control-room");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/control-room/shift-coverage");
  });
});
