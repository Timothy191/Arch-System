import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WeatherWidget } from "./WeatherWidget";
import { type WeatherData } from "@/lib/weather-api";

// Mock Radix Popover
jest.mock("@radix-ui/react-popover", () => {
  const React = require("react");
  return {
    Root: ({ children, open, onOpenChange }: any) => {
      const [isOpen, setIsOpen] = React.useState(open || false);
      return (
        <div data-testid="popover-root">
          {React.Children.map(children, (child: any) => {
            if (!child) return null;
            return React.cloneElement(child, {
              isOpen,
              setIsOpen: (val: boolean) => {
                setIsOpen(val);
                onOpenChange?.(val);
              },
            });
          })}
        </div>
      );
    },
    Trigger: ({ children, asChild, isOpen, setIsOpen }: any) => {
      const handleClick = () => setIsOpen(!isOpen);
      if (asChild) {
        return React.cloneElement(children, {
          onClick: handleClick,
          "aria-expanded": isOpen ? "true" : "false",
        });
      }
      return <button onClick={handleClick}>{children}</button>;
    },
    Portal: ({ children, isOpen, setIsOpen }: any) => {
      return React.Children.map(children, (child: any) => {
        if (!child) return null;
        return React.cloneElement(child, { isOpen, setIsOpen });
      });
    },
    Content: ({ children, className, isOpen }: any) => {
      if (!isOpen) return null;
      return (
        <div className={className} data-testid="popover-content">
          {children}
        </div>
      );
    },
  };
});

// Mock weather API functions
const mockWeatherData: WeatherData = {
  temperature: 20,
  feelsLike: 18,
  humidity: 60,
  windSpeed: 15,
  windDirection: 120,
  weatherCode: 0,
  description: "Clear sky",
  icon: "☀️",
  timestamp: "2026-05-29T16:00:00Z",
  location: { lat: -26.35914, lon: 28.79267, name: "Delmas, Mpumalanga" },
  daily: [],
};

const mockWeatherDataCritical: WeatherData = {
  ...mockWeatherData,
  weatherCode: 95,
  description: "Thunderstorm",
  icon: "⛈️",
};

jest.mock("@/lib/weather-api", () => {
  const actual = jest.requireActual("@/lib/weather-api");
  return {
    ...actual,
    fetchWeather: jest.fn().mockImplementation((lat) => {
      if (lat === 99.99) {
        throw new Error("Failed to load weather");
      }
      return Promise.resolve(mockWeatherData);
    }),
  };
});

const { fetchWeather } = jest.requireMock("@/lib/weather-api");

describe("WeatherWidget - Header Variant Popover", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders trigger button with weather icon emoji in header variant", async () => {
    fetchWeather.mockResolvedValueOnce(mockWeatherData);
    render(<WeatherWidget variant="header" />);

    // Wait for weather data to load
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Weather details" })).toBeInTheDocument();
    });

    const trigger = screen.getByRole("button", { name: "Weather details" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("☀️");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles the weather popover when trigger is clicked", async () => {
    fetchWeather.mockResolvedValueOnce(mockWeatherData);
    render(<WeatherWidget variant="header" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Weather details" })).toBeInTheDocument();
    });

    const trigger = screen.getByRole("button", { name: "Weather details" });

    // Initially popover content should not be in the document
    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();

    // Click trigger to open popover
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();

    // Assert weather details
    expect(screen.getByText("Delmas, Mpumalanga")).toBeInTheDocument();
    expect(screen.getByText("20°C")).toBeInTheDocument();
    expect(screen.getByText("Clear sky (Feels: 18°C)")).toBeInTheDocument();
    expect(screen.getByText("💨 15 km/h ESE")).toBeInTheDocument();
    expect(screen.getByText("💧 60%")).toBeInTheDocument();

    // Click trigger to close popover
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
  });

  it("displays alert status overlay dot on trigger when critical weather is active", async () => {
    fetchWeather.mockResolvedValueOnce(mockWeatherDataCritical);
    render(<WeatherWidget variant="header" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Weather details" })).toBeInTheDocument();
    });

    const trigger = screen.getByRole("button", { name: "Weather details" });
    const alertDot = trigger.querySelector(".bg-accent-red");
    expect(alertDot).toBeInTheDocument();

    // Open popover to see alert message
    fireEvent.click(trigger);
    expect(
      screen.getByText("⚠️ Thunderstorm - Cease outdoor operations immediately"),
    ).toBeInTheDocument();
  });
});
