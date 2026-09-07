/**
 * @jest-environment node
 */
import { DELETE } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

const createMockQuery = () => {
  const chain = {
    from: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
  };

  chain.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);

  return chain;
};

describe("DELETE /api/printers/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const res = await DELETE(new Request("http://localhost/api/printers/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 if user lacks required role", async () => {
    const employeeQuery = createMockQuery();
    employeeQuery.single.mockResolvedValue({ data: { role: "operator" }, error: null });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn((table) => (table === "employees" ? employeeQuery : createMockQuery())),
    });

    const res = await DELETE(new Request("http://localhost/api/printers/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns 200 on successful soft delete", async () => {
    const employeeQuery = createMockQuery();
    employeeQuery.single.mockResolvedValue({ data: { role: "admin" }, error: null });

    const deleteQuery = createMockQuery();
    deleteQuery.eq.mockResolvedValue({ data: null, error: null });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn((table) => (table === "employees" ? employeeQuery : deleteQuery)),
    });

    const res = await DELETE(new Request("http://localhost/api/printers/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("returns 500 on delete failure", async () => {
    const employeeQuery = createMockQuery();
    employeeQuery.single.mockResolvedValue({ data: { role: "admin" }, error: null });

    const deleteQuery = createMockQuery();
    deleteQuery.eq.mockResolvedValue({ data: null, error: { message: "delete failed" } });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn((table) => (table === "employees" ? employeeQuery : deleteQuery)),
    });

    const res = await DELETE(new Request("http://localhost/api/printers/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to delete printer" });
  });
});
