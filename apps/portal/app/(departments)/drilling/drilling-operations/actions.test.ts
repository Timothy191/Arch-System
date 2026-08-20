/**
 * @jest-environment node
 */
import { upsertDrillOperationAction } from "./actions";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

describe("upsertDrillOperationAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns validation error when required fields are missing", async () => {
    const res = await upsertDrillOperationAction({} as any);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Validation error");
  });

  it("returns error when user is unauthorized", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }),
      },
    });

    const validPayload = {
      machine_id: "123e4567-e89b-12d3-a456-426614174000",
      department_id: "123e4567-e89b-12d3-a456-426614174001",
      operation_date: "2026-08-20",
      shift_type: "day" as const,
    };

    const res = await upsertDrillOperationAction(validPayload);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Unauthorized access");
  });

  it("successfully upserts valid drill operation", async () => {
    const mockUpsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "op-101", machine_id: "123e4567-e89b-12d3-a456-426614174000" },
          error: null,
        }),
      }),
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn((table) => {
        if (table === "employees") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { department_id: "123e4567-e89b-12d3-a456-426614174001", is_admin: false },
                }),
              }),
            }),
          };
        }
        if (table === "drill_operations") {
          return { upsert: mockUpsert };
        }
        return {};
      }),
    });

    const validPayload = {
      machine_id: "123e4567-e89b-12d3-a456-426614174000",
      department_id: "123e4567-e89b-12d3-a456-426614174001",
      operation_date: "2026-08-20",
      shift_type: "day" as const,
      open_hours: 10,
      close_hours: 20,
      meters_drilled: 150.5,
    };

    const res = await upsertDrillOperationAction(validPayload);
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: "op-101", machine_id: "123e4567-e89b-12d3-a456-426614174000" });
  });
});
