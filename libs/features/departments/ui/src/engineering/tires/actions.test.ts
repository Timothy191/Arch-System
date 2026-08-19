/**
 * @jest-environment node
 */
import { logTireInspection, installTire, replaceTire, getTireWearHistory } from "./actions";
import { AuthError, DatabaseError, ValidationError } from "@repo/errors";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@repo/shared/data-access", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@repo/redis", () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@repo/logger", () => ({
  serverLogger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSupabaseMock(
  overrides: {
    getUser?: unknown;
    insertError?: unknown;
    updateError?: unknown;
    selectData?: unknown;
    selectError?: unknown;
  } = {},
) {
  const user = overrides.getUser !== undefined ? overrides.getUser : { id: "user-123" };

  const mock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: overrides.selectData ?? { id: "inserted-id" },
            error: overrides.insertError ?? null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: overrides.updateError ?? null }),
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: overrides.selectData ?? [],
            error: overrides.selectError ?? null,
          }),
        }),
      }),
    }),
  };

  createServerSupabaseClient.mockResolvedValue(mock);
  return mock;
}

describe("Tire Management Server Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("logTireInspection", () => {
    const validInspection = {
      tire_id: "11111111-1111-1111-1111-111111111111",
      inspection_date: "2026-08-19",
      tread_depth_mm: 68.5,
      pressure_psi: 105,
      condition_status: "good" as const,
      notes: "Optimal wear pattern",
    };

    it("records inspection successfully for authenticated user", async () => {
      buildSupabaseMock();
      const result = await logTireInspection(validInspection);
      expect(result.success).toBe(true);
    });

    it("throws AuthError when user is not logged in", async () => {
      buildSupabaseMock({ getUser: null });
      await expect(logTireInspection(validInspection)).rejects.toThrow(AuthError);
    });

    it("throws ValidationError on invalid payload", async () => {
      buildSupabaseMock();
      // @ts-expect-error test invalid payload
      await expect(logTireInspection({ tire_id: "invalid" })).rejects.toThrow(ValidationError);
    });
  });

  describe("installTire", () => {
    const validTire = {
      serial_number: "MICH-5980-001",
      brand: "Michelin",
      size: "59/80R63",
      position: "Front Left",
      status: "installed" as const,
      installed_at: "2026-08-19",
      installed_hours: 0,
    };

    it("registers new tire successfully", async () => {
      buildSupabaseMock();
      const result = await installTire(validTire);
      expect(result.success).toBe(true);
    });
  });

  describe("replaceTire", () => {
    const validReplacement = {
      old_tire_id: "11111111-1111-1111-1111-111111111111",
      removed_at: "2026-08-19",
      removed_hours: 3200,
      scrapped_reason: "Tread Worn Below Limit (<15mm)",
      new_tire: {
        serial_number: "BS-5980-002",
        brand: "Bridgestone",
        size: "59/80R63",
        position: "Front Left",
        status: "installed" as const,
        installed_at: "2026-08-19",
        installed_hours: 0,
      },
    };

    it("decommissions old tire and installs new tire", async () => {
      buildSupabaseMock();
      const result = await replaceTire(validReplacement);
      expect(result.success).toBe(true);
    });
  });

  describe("getTireWearHistory", () => {
    it("fetches wear history for a tire", async () => {
      const mockData = [
        { id: "insp-1", inspection_date: "2026-07-01", tread_depth_mm: 80, pressure_psi: 100 },
      ];
      buildSupabaseMock({ selectData: mockData });
      const res = await getTireWearHistory("11111111-1111-1111-1111-111111111111");
      expect(res).toEqual(mockData);
    });
  });
});
