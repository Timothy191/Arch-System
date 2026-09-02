const mockLogError = jest.fn();
jest.mock("@/lib/errors/error-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockRevalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockFrom = jest.fn();
jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@repo/utils/inngest", () => ({
  inngest: {
    createFunction: jest.fn((_opts: unknown, handler: unknown) => ({ handler })),
  },
  syncPlaybackEvent: "sync/playback",
}));

import { syncPlaybackFn } from "./sync-playback";

type QueryResult = { data: unknown; error: unknown };

let maybeSingleResult: QueryResult = { data: null, error: null };
let insertResult: { error: unknown } = { error: null };

function createTableMock() {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue(maybeSingleResult),
      }),
    }),
    insert: jest.fn().mockResolvedValue(insertResult),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  };
}

mockFrom.mockImplementation(() => createTableMock());

function builderFor(table: string) {
  // The insert/update builder is created on the LAST from(table) call;
  // earlier calls build the idempotency select chain.
  const calls = mockFrom.mock.calls;
  let idx = -1;
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i]![0] === table) {
      idx = i;
      break;
    }
  }
  if (idx === -1) throw new Error(`No mock builder for table ${table}`);
  return mockFrom.mock.results[idx]!.value;
}

const handler = (syncPlaybackFn as any).handler;

function makeEvent(actionType: string, overrides: Record<string, unknown> = {}) {
  return {
    event: {
      data: {
        idempotencyKey: "key-1",
        actionType,
        payload: {},
        departmentId: "dept-1",
        ...overrides,
      },
    },
  };
}

describe("syncPlaybackFn", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockLogError.mockClear();
    mockRevalidatePath.mockClear();
    maybeSingleResult = { data: null, error: null };
    insertResult = { error: null };
  });

  it("inserts a breakdown when none exists for the idempotency key", async () => {
    const result = await handler(
      makeEvent("ADD_BREAKDOWN", {
        payload: {
          fleetId: "f1",
          machineType: "Excavator",
          dateIn: "2026-08-17",
          timeIn: "07:30",
          reason: "hydraulic leak",
        },
      }),
    );

    expect(result).toEqual({ success: true });
    const insert = builderFor("breakdowns").insert;
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        department_id: "dept-1",
        fleet_id: "f1",
        machine_type: "Excavator",
        reason: "hydraulic leak",
        status: "active",
        idempotency_key: "key-1",
        sync_status: "synced",
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/[department]/breakdowns", "page");
  });

  it("bypasses the insert when the breakdown already exists", async () => {
    maybeSingleResult = { data: { id: "b1" }, error: null };

    const result = await handler(makeEvent("ADD_BREAKDOWN", { payload: {} }));
    expect(result).toEqual({ success: true, bypassed: true });
    expect(builderFor("breakdowns").insert).not.toHaveBeenCalled();
  });

  it("resolves an open breakdown", async () => {
    const result = await handler(makeEvent("RESOLVE_BREAKDOWN", { payload: { id: "b1" } }));

    expect(result).toEqual({ success: true });
    const update = builderFor("breakdowns").update;
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", sync_status: "synced" }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/[department]/breakdowns", "page");
  });


  it("inserts a daily log when none exists", async () => {
    const result = await handler(
      makeEvent("ADD_DAILY_LOG", {
        payload: { logDate: "2026-08-17", shift: "day", notes: "steady production" },
      }),
    );

    expect(result).toEqual({ success: true });
    expect(builderFor("daily_logs").insert).toHaveBeenCalledWith(
      expect.objectContaining({
        department_id: "dept-1",
        log_date: "2026-08-17",
        shift: "day",
        idempotency_key: "key-1",
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/[department]/daily-log", "page");
  });

  it("returns an error for unknown action types", async () => {
    const result = await handler(makeEvent("MOVE_MACHINE", { payload: {} }));
    expect(result).toEqual({ error: "Unknown action type: MOVE_MACHINE" });
  });

  it("logs and re-throws when an insert fails", async () => {
    insertResult = { error: new Error("insert constraint violated") };

    await expect(handler(makeEvent("ADD_BREAKDOWN", { payload: {} }))).rejects.toThrow(
      "insert constraint violated",
    );
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: "sync_playback_job" }),
    );
  });
});
