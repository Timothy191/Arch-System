import { render, screen } from "@testing-library/react";
import { ProductionTrendChart } from "./ProductionTrendChart";

jest.mock("@tremor/react", () => ({
  AreaChart: (props: Record<string, unknown>) => (
    <div data-testid="area-chart" data-props={JSON.stringify(props)} />
  ),
  Text: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
}));

function makePoints(count: number, coal = 100, waste = 40) {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, "0")}`,
    coal: coal + i,
    waste,
  }));
}

describe("ProductionTrendChart", () => {
  it("shows an empty state when there is no data", () => {
    render(<ProductionTrendChart data={[]} />);
    expect(screen.getByText("No production data in the last 30 days")).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).toBeNull();
  });

  it("renders the legend and chart without forecast for short series", () => {
    render(<ProductionTrendChart data={makePoints(3)} />);

    expect(screen.getByText("Coal Removed")).toBeInTheDocument();
    expect(screen.getByText("Waste Removed")).toBeInTheDocument();
    expect(screen.queryByText("7-day Forecast")).toBeNull();

    const chart = screen.getByTestId("area-chart");
    const props = JSON.parse(chart.getAttribute("data-props")!) as {
      categories: string[];
      data: { date: string }[];
    };
    expect(props.categories).toEqual(["Coal (t)", "Waste (t)"]);
    expect(props.data).toHaveLength(3);
  });

  it("appends a 7-day forecast for series of 7+ points", () => {
    render(<ProductionTrendChart data={makePoints(10)} />);

    expect(screen.getByText("7-day Forecast")).toBeInTheDocument();

    const chart = screen.getByTestId("area-chart");
    const props = JSON.parse(chart.getAttribute("data-props")!) as {
      categories: string[];
      data: { date: string; "Coal Forecast"?: number }[];
    };
    expect(props.categories).toEqual(["Coal (t)", "Waste (t)", "Coal Forecast"]);
    expect(props.data).toHaveLength(17); // 10 historical + 7 forecast
    const forecastPoints = props.data.slice(10);
    expect(forecastPoints.every((p) => p["Coal Forecast"]! >= 0)).toBe(true);
  });

  it("does not forecast when showForecast is false", () => {
    render(<ProductionTrendChart data={makePoints(10)} showForecast={false} />);

    expect(screen.queryByText("7-day Forecast")).toBeNull();
    const chart = screen.getByTestId("area-chart");
    const props = JSON.parse(chart.getAttribute("data-props")!) as {
      categories: string[];
      data: unknown[];
    };
    expect(props.categories).toEqual(["Coal (t)", "Waste (t)"]);
    expect(props.data).toHaveLength(10);
  });
});
