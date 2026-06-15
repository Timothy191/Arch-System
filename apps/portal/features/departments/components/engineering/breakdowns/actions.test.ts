/**
 * @jest-environment node
 */
import {
  createBreakdown,
  bookOutBreakdown,
  directCheckout,
  softDeleteBreakdown,
} from "./actions";
import { AuthError, DatabaseError } from "@/lib/errors/error-classes";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/audit", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

const { createServerSupabaseClient } = jest.requireMock(
  "@repo/supabase/server",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSupabaseMock(
  overrides: {
    getUser?: unknown;
    insertError?: unknown;
    updateError?: unknown;
    selectData?: unknown;
  } = {},
) {
  const user =
    overrides.getUser !== undefined ? overrides.getUser : { id: "user-1" };

  const mock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn().mockReturnValue({
      insert: jest
        .fn()
        .mockResolvedValue({ error: overrides.insertError ?? null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest
            .fn()
            .mockResolvedValue({ data: overrides.selectData ?? null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest
          .fn()
          .mockResolvedValue({ error: overrides.updateError ?? null }),
      }),
    }),
  };

  createServerSupabaseClient.mockResolvedValue(mock);
  return mock;
}

const validBreakdownInput = {
  fleet_id: "exc-01",
  machine_name: "CAT 320D",
  machine_type: "Excavator",
  date_in: "2026-05-17",
  time_in: "06:00",
  reason: "Hydraulic leak",
};

const validBookOutInput = {
  date_out: "2026-05-17",
  time_out: "14:00",
  repair_notes: "Replaced seals",
};

const validDirectCheckout = {
  fleet_id: "drill-01",
  machine_type: "Drill Rig",
  date_out: "2026-05-17",
  time_out: "12:00",
  reason: "Routine maintenance",
  repair_notes: "Oil change done",
};

// ---------------------------------------------------------------------------
// createBreakdown
// ---------------------------------------------------------------------------

describe("createBreakdown", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws AuthError when user is not authenticated", async () => {
    buildSupabaseMock({ getUser: null });
    await expect(
      createBreakdown("dept-1", validBreakdownInput),
    ).rejects.toThrow(AuthError);
  });

  it("throws DatabaseError when insert fails", async () => {
    buildSupabaseMock({ insertError: { message: "DB insert failed" } });
    await expect(
      createBreakdown("dept-1", validBreakdownInput),
    ).rejects.toThrow(DatabaseError);
  });

  it("returns success on valid input", async () => {
    buildSupabaseMock();
    const result = await createBreakdown("dept-1", validBreakdownInput);
    expect(result).toEqual({ success: true });
  });

  it("uppercases the fleet_id before insert", async () => {
    const mock = buildSupabaseMock();
    await createBreakdown("dept-1", {
      ...validBreakdownInput,
      fleet_id: "exc-01",
    });
    const insertCall =
      mock.from.mock.results[0]!.value.insert.mock.calls[0]![0];
    expect(insertCall.fleet_id).toBe("EXC-01");
  });
});

// ---------------------------------------------------------------------------
// bookOutBreakdown
// ---------------------------------------------------------------------------

describe("bookOutBreakdown", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws AuthError when user is not authenticated", async () => {
    buildSupabaseMock({ getUser: null });
    await expect(bookOutBreakdown("bd-1", validBookOutInput)).rejects.toThrow(
      AuthError,
    );
  });

  it("throws DatabaseError when update fails", async () => {
    buildSupabaseMock({ updateError: { message: "Update failed" } });
    await expect(bookOutBreakdown("bd-1", validBookOutInput)).rejects.toThrow(
      DatabaseError,
    );
  });

  it("returns success on valid book out", async () => {
    buildSupabaseMock();
    const result = await bookOutBreakdown("bd-1", validBookOutInput);
    expect(result).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// directCheckout
// ---------------------------------------------------------------------------

describe("directCheckout", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws AuthError when user is not authenticated", async () => {
    buildSupabaseMock({ getUser: null });
    await expect(directCheckout("dept-1", validDirectCheckout)).rejects.toThrow(
      AuthError,
    );
  });

  it("throws DatabaseError when insert fails", async () => {
    buildSupabaseMock({ insertError: { message: "DB insert failed" } });
    await expect(directCheckout("dept-1", validDirectCheckout)).rejects.toThrow(
      DatabaseError,
    );
  });

  it("returns success on valid direct checkout", async () => {
    buildSupabaseMock();
    const result = await directCheckout("dept-1", validDirectCheckout);
    expect(result).toEqual({ success: true });
  });

  it("sets missing_book_in to true", async () => {
    const mock = buildSupabaseMock();
    await directCheckout("dept-1", validDirectCheckout);
    const insertCall = (mock.from.mock.results[0] as any).value.insert.mock
      .calls[0][0];
    expect(insertCall.missing_book_in).toBe(true);
    expect(insertCall.status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// softDeleteBreakdown
// ---------------------------------------------------------------------------

describe("softDeleteBreakdown", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws AuthError when user is not authenticated", async () => {
    buildSupabaseMock({ getUser: null });
    await expect(softDeleteBreakdown("bd-1")).rejects.toThrow(AuthError);
  });

  it("throws DatabaseError when update fails", async () => {
    buildSupabaseMock({ updateError: { message: "Soft delete failed" } });
    await expect(softDeleteBreakdown("bd-1")).rejects.toThrow(DatabaseError);
  });

  it("returns success on valid soft delete", async () => {
    buildSupabaseMock();
    const result = await softDeleteBreakdown("bd-1");
    expect(result).toEqual({ success: true });
  });
});
