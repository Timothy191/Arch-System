/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@/lib/weather-api", () => ({
  fetchWeather: jest.fn(),
}));

jest.mock("@/lib/errors/error-logger", () => ({
  logError: jest.fn().mockResolvedValue("error-id-123"),
}));

jest.mock("@/lib/observability/tracing", () => ({
  withAsyncSpan: jest.fn((_name, _attrs, fn) => fn()),
  addEvent: jest.fn(),
  setAttributes: jest.fn(),
}));

const { fetchWeather } = jest.requireMock("@/lib/weather-api") as {
  fetchWeather: jest.Mock;
};

describe("GET /api/weather", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns weather JSON with cache headers on success", async () => {
    fetchWeather.mockResolvedValue({
      temperature: 24,
      conditions: "Sunny",
      humidity: 40,
      windSpeed: 12,
      windDirection: "NE",
      visibility: 10,
      timestamp: new Date().toISOString(),
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.temperature).toBe(24);
    expect(json.conditions).toBe("Sunny");

    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=300"
    );
    expect(res.headers.get("x-weather-cache")).toBe("hit");
    expect(res.headers.get("x-response-time")).toMatch(/^\d+ms$/);
  });

  it("returns null payload with error headers when fetchWeather fails", async () => {
    fetchWeather.mockRejectedValue(new Error("Upstream weather service unavailable"));

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toBeNull();

    expect(res.headers.get("cache-control")).toBe("public, s-maxage=60");
    expect(res.headers.get("x-weather-cache")).toBe("error");
    expect(res.headers.get("x-error-id")).toBe("error-id-123");
  });
});
