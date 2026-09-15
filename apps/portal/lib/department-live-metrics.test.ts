import { fetchLiveDepartmentMetrics } from "@repo/departments/data-access";

describe("fetchLiveDepartmentMetrics", () => {
  it("fetches and aggregates live metrics across control-room, production, engineering, and access-control", async () => {
    const mockDb = {
      from: jest.fn((table: string) => {
        if (table === "hourly_loads") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({
              data: {
                hour_01: 10,
                hour_02: 15,
                hour_03: 20,
                total_loads: 45,
              },
            })),
          };
        }
        if (table === "daily_logs") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({
              data: {
                id: "log-1",
                production_logs: [{ coal_tonnes: 850, waste_tonnes: 150 }],
              },
            })),
          };
        }
        if (table === "breakdowns") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            count: 2,
          };
        }
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({
              data: [
                { id: "m1", name: "EX-201", active: true },
                { id: "m2", name: "DT-101", active: true },
                { id: "m3", name: "DR-001", active: false },
              ],
            })),
          };
        }
        if (table === "badges") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            count: 145,
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: null })),
        };
      }),
    };

    const metrics = await fetchLiveDepartmentMetrics(mockDb, "2026-09-14");

    // Control Room assertions
    expect(metrics["control-room"]).toBeDefined();
    expect(metrics["control-room"]?.stats.label).toBe("Loads");
    expect(metrics["control-room"]?.stats.value).toBe("45");
    expect(metrics["control-room"]?.status).toBe("active");

    // Production assertions
    expect(metrics.production).toBeDefined();
    expect(metrics.production?.stats.label).toBe("Yield");
    expect(metrics.production?.stats.value).toBe("850t");
    expect(metrics.production?.status).toBe("active");

    // Engineering assertions
    expect(metrics.engineering).toBeDefined();
    expect(metrics.engineering?.stats.label).toBe("Availability");
    expect(metrics.engineering?.stats.value).toBe("67%");
    expect(metrics.engineering?.status).toBe("maintenance");

    // Access Control assertions
    expect(metrics["access-control"]).toBeDefined();
    expect(metrics["access-control"]?.stats.label).toBe("On-site");
    expect(metrics["access-control"]?.stats.value).toBe("145");
    expect(metrics["access-control"]?.status).toBe("active");
  });

  it("handles database errors gracefully and returns empty map without throwing", async () => {
    const errorDb = {
      from: jest.fn(() => {
        throw new Error("DB Connection Refused");
      }),
    };

    const result = await fetchLiveDepartmentMetrics(errorDb, "2026-09-14");
    expect(result).toEqual({});
  });
});
