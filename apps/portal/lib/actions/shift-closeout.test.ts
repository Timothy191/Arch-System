/**
 * @jest-environment node
 */
import { submitShiftCloseout } from "./shift-closeout";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn(),
}));

const { createServerSupabaseClient } = require("@repo/supabase/server");
const { getRedisClient } = require("@repo/redis");

describe("submitShiftCloseout server action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns validation error when payload fails Zod schema verification", async () => {
    const invalidPayload: any = {
      shiftId: "not-a-uuid",
      department: "control_room",
      supervisorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      supervisorPin: "12", // invalid: less than 4 digits
      totalLoads: -5,
      totalOperatingHours: 25,
      breakdownHours: 0,
    };

    const result = await submitShiftCloseout(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.code).toBe("VALIDATION_ERROR");
  });

  it("returns auth error when supervisor PIN verification fails", async () => {
    const validPayload = {
      shiftId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      department: "control_room" as const,
      supervisorId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      supervisorPin: "1234",
      totalLoads: 45,
      totalOperatingHours: 8,
      breakdownHours: 0,
      operatorNotes: "Shift completed without incident",
    };

    getRedisClient.mockResolvedValue({
      isOpen: true,
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    });

    createServerSupabaseClient.mockResolvedValue({
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    });

    const result = await submitShiftCloseout(validPayload);
    expect(result.success).toBe(false);
    expect(result.code).toBe("AUTH_ERROR");
    expect(result.error).toContain("Invalid supervisor PIN");
  });

  it("returns success when PIN is valid and shift report updates successfully", async () => {
    const validPayload = {
      shiftId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      department: "control_room" as const,
      supervisorId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      supervisorPin: "1234",
      totalLoads: 45,
      totalOperatingHours: 8,
      breakdownHours: 0,
      operatorNotes: "Shift completed cleanly",
    };

    getRedisClient.mockResolvedValue({
      isOpen: true,
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    });

    createServerSupabaseClient.mockResolvedValue({
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
      from: jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "report-123", status: "closed" },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await submitShiftCloseout(validPayload);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
