import { z } from "@repo/contract";
import { AgentBffAggregator } from "../bff-aggregator";

describe("AgentBffAggregator Framework Unit Tests", () => {
  it("should aggregate data from multiple sources and transform for target client", async () => {
    const targetSchema = z.object({
      userId: z.string(),
      badgeColor: z.string(),
      scannerDpi: z.number(),
    });

    const result = await AgentBffAggregator.aggregate({
      target: "c66_scanner",
      tasks: [
        {
          sourceName: "user_service",
          isCritical: true,
          fetchFn: async () => ({ id: "usr_123", name: "John Doe" }),
        },
        {
          sourceName: "hardware_config",
          isCritical: true,
          fetchFn: async () => ({ dpi: 300, activeBadge: "green" }),
        },
      ],
      combiner: (results) => {
        const user = results.user_service as { id: string };
        const hw = results.hardware_config as { dpi: number; activeBadge: string };
        return { user, hw };
      },
      transformer: (combined, _target) => ({
        userId: combined.user.id,
        badgeColor: combined.hw.activeBadge,
        scannerDpi: combined.hw.dpi,
      }),
      schema: targetSchema,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data).toEqual({
        userId: "usr_123",
        badgeColor: "green",
        scannerDpi: 300,
      });
      expect(result.target).toBe("c66_scanner");
    }
  });

  it("should handle non-critical source failure by returning status 'partial'", async () => {
    const result = await AgentBffAggregator.aggregate({
      target: "portal_web",
      tasks: [
        {
          sourceName: "critical_auth",
          isCritical: true,
          fetchFn: async () => ({ userId: "usr_999" }),
        },
        {
          sourceName: "optional_analytics",
          isCritical: false,
          fetchFn: async () => {
            throw new Error("Analytics backend down");
          },
        },
      ],
      combiner: (results) => ({
        auth: results.critical_auth,
        analytics: results.optional_analytics,
      }),
      transformer: (combined) => ({
        userId: (combined.auth as { userId: string } | undefined)?.userId,
      }),
    });

    expect(result.status).toBe("partial");
    if (result.status === "partial") {
      expect(result.missingSources).toEqual(["optional_analytics"]);
      expect(result.data.userId).toBe("usr_999");
    }
  });
});
