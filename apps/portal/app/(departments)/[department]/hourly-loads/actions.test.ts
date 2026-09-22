/**
 * @jest-environment node
 */
import { updateMachineSite } from "./actions";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@repo/supabase/service-role", () => ({
  createServiceRoleClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");
const { createServiceRoleClient } = jest.requireMock("@repo/supabase/service-role");

describe("updateMachineSite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws Error('Unauthorized') when user is not logged in", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    await expect(
      updateMachineSite(
        "12345678-1234-4234-8234-1234567890ab",
        "87654321-4321-4321-8321-ba0987654321",
      ),
    ).rejects.toThrow("Unauthorized");
  });

  it("throws Error('Unauthorized') when employee record is missing", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    await expect(
      updateMachineSite(
        "12345678-1234-4234-8234-1234567890ab",
        "87654321-4321-4321-8321-ba0987654321",
      ),
    ).rejects.toThrow("Unauthorized");
  });

  it("calls service role client to update machine site_id when authorized", async () => {
    // Mock standard client for auth and employee check
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: "operator", department_id: "dept-1" },
            }),
          }),
        }),
      }),
    });

    // Mock service role client for update operation
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const mockService = {
      from: jest.fn().mockReturnValue({
        update: mockUpdate,
      }),
    };
    createServiceRoleClient.mockReturnValue(mockService);

    const result = await updateMachineSite(
      "12345678-1234-4234-8234-1234567890ab",
      "87654321-4321-4321-8321-ba0987654321",
    );

    expect(result).toEqual({ success: true });
    expect(mockService.from).toHaveBeenCalledWith("machines");
    expect(mockUpdate).toHaveBeenCalledWith({ site_id: "87654321-4321-4321-8321-ba0987654321" });
  });

  it("throws error when database update fails", async () => {
    // Mock standard client
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: "operator", department_id: "dept-1" },
            }),
          }),
        }),
      }),
    });

    // Mock service role client to return database error
    const dbError = new Error("DB Error");
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: dbError }),
    });
    const mockService = {
      from: jest.fn().mockReturnValue({
        update: mockUpdate,
      }),
    };
    createServiceRoleClient.mockReturnValue(mockService);

    await expect(
      updateMachineSite(
        "12345678-1234-4234-8234-1234567890ab",
        "87654321-4321-4321-8321-ba0987654321",
      ),
    ).rejects.toThrow(dbError);
  });
});
