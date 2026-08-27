import React from "react";
import { render, screen } from "@testing-library/react";
import { SafetyDashboard } from "./SafetyDashboard";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("./SafetyChartsWrapper", () => ({
  SafetyCharts: ({ trendData, distributionData }: any) => (
    <div data-testid="safety-charts">
      <span data-testid="trend-count">{trendData.length}</span>
      <span data-testid="dist-count">{distributionData.length}</span>
    </div>
  ),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

describe("SafetyDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dashboard metrics correctly with single-pass aggregated monthly incidents", async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { incident_date: "2025-01-01" },
        }),
      }),
    };

    // Override from calls dynamically based on query configuration
    mockSupabase.from.mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { incident_date: "2025-01-01" } }),
      };

      // Mock return values based on select/eq parameters
      chain.eq.mockImplementation((field: string, val: string) => {
        if (field === "incident_date" && val === todayStr) {
          chain.data = [
            { id: "1", incident_type: "near-miss", status: "open", injured_parties: 1 },
          ];
          return {
            ...chain,
            then: (cb: any) => cb({ data: chain.data }),
          };
        }
        if (field === "incident_type" && val === "lost-time") {
          return chain;
        }
        return chain;
      });

      chain.gte.mockImplementation(() => {
        chain.data = [
          { incident_date: todayStr, incident_type: "lost-time", severity_id: 1 },
          { incident_date: todayStr, incident_type: "near-miss", severity_id: 2 },
          { incident_date: "2025-02-01", incident_type: "equipment-damage", severity_id: 1 },
        ];
        return {
          ...chain,
          then: (cb: any) => cb({ data: chain.data }),
        };
      });

      return chain;
    });

    createServerSupabaseClient.mockResolvedValue(mockSupabase);

    const jsx = await SafetyDashboard({ deptId: "dept-1" });
    render(jsx);

    expect(screen.getByText("Safety Dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("safety-charts")).toBeInTheDocument();
    expect(screen.getByTestId("trend-count").textContent).toBe("30");
  });
});
