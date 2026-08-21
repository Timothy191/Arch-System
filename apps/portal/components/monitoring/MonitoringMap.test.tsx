import { render, screen, fireEvent } from "@testing-library/react";
import { MonitoringMap } from "./MonitoringMap";
import type { DeformationReading } from "@/lib/monitoring-api";

// Mock css import and deck.gl/maplibre components to avoid WebGL/CSS context errors in jsdom
jest.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}), { virtual: true });

jest.mock("@deck.gl/layers", () => ({
  ScatterplotLayer: jest.fn().mockImplementation((config) => config),
}));

jest.mock("@deck.gl/react", () => {
  return function MockDeckGL({ children, layers }: any) {
    return (
      <div data-testid="deck-gl" data-layer-count={layers?.length}>
        {children}
      </div>
    );
  };
});

jest.mock("react-map-gl/maplibre", () => {
  return function MockMap({ mapStyle }: any) {
    return <div data-testid="react-map" data-style={JSON.stringify(mapStyle)} />;
  };
});

const mockReadings: DeformationReading[] = [
  {
    id: "r1",
    location: "North Pit",
    lat: -26.25,
    lon: 26.75,
    shiftMm: -15,
    velocityMmPerMonth: -1.25,
    trend: "subsiding",
    level: "critical",
    lastUpdated: "2025-01-01T00:00:00Z",
    sensor: "Sentinel-1 InSAR",
  },
  {
    id: "r2",
    location: "South Ramp",
    lat: -26.26,
    lon: 26.76,
    shiftMm: -2,
    velocityMmPerMonth: -0.15,
    trend: "stable",
    level: "stable",
    lastUpdated: "2025-01-01T00:00:00Z",
    sensor: "Sentinel-1 InSAR",
  },
];

describe("MonitoringMap", () => {
  it("renders map component with default layers and switcher", () => {
    render(<MonitoringMap deformationReadings={mockReadings} />);

    expect(screen.getByTestId("deck-gl")).toBeInTheDocument();
    expect(screen.getByTestId("react-map")).toBeInTheDocument();
    expect(screen.getByText("S2 Optical")).toBeInTheDocument();
    expect(screen.getByText("SAR")).toBeInTheDocument();
  });

  it("updates layer when layer switcher button is clicked", () => {
    render(<MonitoringMap deformationReadings={mockReadings} activeLayer="optical" />);

    const streetsButton = screen.getByRole("button", { name: "Streets" });
    fireEvent.click(streetsButton);

    const mapElement = screen.getByTestId("react-map");
    expect(mapElement.getAttribute("data-style")).toContain("openstreetmap.org");
  });

  it("hides layer switcher when showLayerSwitcher is false", () => {
    render(<MonitoringMap showLayerSwitcher={false} />);

    expect(screen.queryByText("S2 Optical")).not.toBeInTheDocument();
    expect(screen.queryByText("SAR")).not.toBeInTheDocument();
  });
});
