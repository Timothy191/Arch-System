/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@/app/(departments)/access-card-actions/lib/printer-detection", () => ({
  detectAllPrinters: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");
const { detectAllPrinters } = jest.requireMock(
  "@/app/(departments)/access-card-actions/lib/printer-detection"
);

describe("GET /api/printers/scan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 if user lacks required role", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: { role: "operator" }, error: null }),
          })),
        })),
      })),
    });

    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns detected printers with registration status", async () => {
    detectAllPrinters.mockResolvedValue([
      { cupsName: "cups-1", name: "Printer 1", isNew: true },
      { cupsName: "cups-2", name: "Printer 2", isNew: false },
    ]);

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn((table) => {
        if (table === "employees") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({ data: { role: "access_control" }, error: null }),
              })),
            })),
          };
        }

        return {
          select: jest.fn(() => ({
            is: jest.fn(() => ({
              data: [{ cups_name: "cups-2", id: "p2" }],
              error: null,
            })),
          })),
        };
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      printers: [
        { cupsName: "cups-1", name: "Printer 1", isNew: true, isRegistered: false, dbId: null },
        { cupsName: "cups-2", name: "Printer 2", isNew: false, isRegistered: true, dbId: "p2" },
      ],
      count: 2,
    });
  });

  it("returns 500 on scan failure", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn((table) => {
        if (table === "employees") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
              })),
            })),
          };
        }

        return {
          select: jest.fn(() => ({
            is: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      }),
    });

    detectAllPrinters.mockRejectedValue(new Error("scan failed"));

    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Failed to scan printers",
      printers: [],
      count: 0,
    });
  });
});
