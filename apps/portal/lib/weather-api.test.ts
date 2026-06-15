import {
  getWeatherDescription,
  getWeatherAlert,
  getWindDirection,
  fetchWeather,
  searchLocation,
  type WeatherData,
} from "./weather-api";

const BASE_WEATHER: WeatherData = {
  temperature: 22,
  feelsLike: 20,
  humidity: 55,
  windSpeed: 15,
  windDirection: 180,
  weatherCode: 0,
  description: "Clear sky",
  icon: "☀️",
  timestamp: "2026-05-17T08:00",
  location: { lat: -26.2, lon: 28.0, name: "Mining Site" },
};

describe("getWeatherDescription", () => {
  it("returns correct description for known WMO codes", () => {
    expect(getWeatherDescription(0)).toEqual({
      description: "Clear sky",
      icon: "☀️",
    });
    expect(getWeatherDescription(3)).toEqual({
      description: "Overcast",
      icon: "☁️",
    });
    expect(getWeatherDescription(63)).toEqual({
      description: "Moderate rain",
      icon: "🌧️",
    });
    expect(getWeatherDescription(95)).toEqual({
      description: "Thunderstorm",
      icon: "⛈️",
    });
  });

  it("returns Unknown/❓ for unrecognised codes", () => {
    expect(getWeatherDescription(999)).toEqual({
      description: "Unknown",
      icon: "❓",
    });
    expect(getWeatherDescription(-1)).toEqual({
      description: "Unknown",
      icon: "❓",
    });
  });

  it("handles all snow codes", () => {
    expect(getWeatherDescription(71).description).toBe("Slight snow");
    expect(getWeatherDescription(73).description).toBe("Moderate snow");
    expect(getWeatherDescription(75).description).toBe("Heavy snow");
  });

  it("handles fog codes", () => {
    expect(getWeatherDescription(45).description).toBe("Foggy");
    expect(getWeatherDescription(48).description).toBe("Depositing rime fog");
  });
});

describe("getWeatherAlert", () => {
  it("returns none for clear conditions with calm winds", () => {
    const result = getWeatherAlert({
      ...BASE_WEATHER,
      weatherCode: 0,
      windSpeed: 10,
    });
    expect(result.level).toBe("none");
    expect(result.message).toBe("");
  });

  it("returns critical for thunderstorm (code ≥ 95)", () => {
    expect(getWeatherAlert({ ...BASE_WEATHER, weatherCode: 95 }).level).toBe(
      "critical",
    );
    expect(getWeatherAlert({ ...BASE_WEATHER, weatherCode: 99 }).level).toBe(
      "critical",
    );
    expect(getWeatherAlert({ ...BASE_WEATHER, weatherCode: 96 }).level).toBe(
      "critical",
    );
  });

  it("returns warning for snow conditions (codes 71–75)", () => {
    expect(getWeatherAlert({ ...BASE_WEATHER, weatherCode: 71 }).level).toBe(
      "warning",
    );
    expect(getWeatherAlert({ ...BASE_WEATHER, weatherCode: 73 }).level).toBe(
      "warning",
    );
    expect(getWeatherAlert({ ...BASE_WEATHER, weatherCode: 75 }).level).toBe(
      "warning",
    );
  });

  it("returns warning for heavy rain (code 65)", () => {
    const result = getWeatherAlert({ ...BASE_WEATHER, weatherCode: 65 });
    expect(result.level).toBe("warning");
    expect(result.message).toContain("Heavy rain");
  });

  it("returns warning for high wind speed > 50 km/h regardless of code", () => {
    const result = getWeatherAlert({
      ...BASE_WEATHER,
      weatherCode: 0,
      windSpeed: 55,
    });
    expect(result.level).toBe("warning");
  });

  it("returns advisory for fog (codes 45–48)", () => {
    expect(getWeatherAlert({ ...BASE_WEATHER, weatherCode: 45 }).level).toBe(
      "advisory",
    );
    expect(getWeatherAlert({ ...BASE_WEATHER, weatherCode: 48 }).level).toBe(
      "advisory",
    );
    expect(
      getWeatherAlert({ ...BASE_WEATHER, weatherCode: 45 }).message,
    ).toContain("Fog");
  });

  it("returns advisory for moderate winds (> 30 km/h)", () => {
    const result = getWeatherAlert({
      ...BASE_WEATHER,
      weatherCode: 0,
      windSpeed: 35,
    });
    expect(result.level).toBe("advisory");
    expect(result.message).toContain("winds");
  });

  it("advisory threshold is strictly > 30, not at 30", () => {
    const at30 = getWeatherAlert({
      ...BASE_WEATHER,
      weatherCode: 0,
      windSpeed: 30,
    });
    const at31 = getWeatherAlert({
      ...BASE_WEATHER,
      weatherCode: 0,
      windSpeed: 31,
    });
    expect(at30.level).toBe("none");
    expect(at31.level).toBe("advisory");
  });

  it("critical takes priority over other conditions", () => {
    const result = getWeatherAlert({
      ...BASE_WEATHER,
      weatherCode: 95,
      windSpeed: 60,
    });
    expect(result.level).toBe("critical");
  });
});

describe("getWindDirection", () => {
  it("returns N for 0°", () => {
    expect(getWindDirection(0)).toBe("N");
  });
  it("returns E for 90°", () => {
    expect(getWindDirection(90)).toBe("E");
  });
  it("returns S for 180°", () => {
    expect(getWindDirection(180)).toBe("S");
  });
  it("returns W for 270°", () => {
    expect(getWindDirection(270)).toBe("W");
  });
  it("returns NE for 45°", () => {
    expect(getWindDirection(45)).toBe("NE");
  });
  it("returns NW for 315°", () => {
    expect(getWindDirection(315)).toBe("NW");
  });
  it("wraps degrees > 360", () => {
    expect(getWindDirection(450)).toBe("E");
  });
  it("handles negative degrees", () => {
    expect(getWindDirection(-90)).toBe("W");
  });
});

describe("fetchWeather", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws on non-ok response", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(fetchWeather(-26.2, 28.0)).rejects.toThrow(
      "Weather API error: 503",
    );
  });

  it("returns parsed WeatherData on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        current: {
          temperature_2m: 24.7,
          apparent_temperature: 23.1,
          relative_humidity_2m: 48,
          wind_speed_10m: 18.2,
          wind_direction_10m: 200,
          weather_code: 1,
          time: "2026-05-17T08:00",
        },
        daily: {
          time: [
            "2026-05-17",
            "2026-05-18",
            "2026-05-19",
            "2026-05-20",
            "2026-05-21",
          ],
          weather_code: [1, 2, 3, 63, 0],
          temperature_2m_max: [26, 24, 22, 18, 25],
          temperature_2m_min: [14, 12, 11, 10, 13],
          precipitation_sum: [0, 0.2, 0, 12.4, 0],
        },
      }),
    } as unknown as Response);

    const result = await fetchWeather(-26.2, 28.0, "Test Site");

    expect(result.temperature).toBe(25);
    expect(result.feelsLike).toBe(23);
    expect(result.humidity).toBe(48);
    expect(result.windSpeed).toBe(18);
    expect(result.weatherCode).toBe(1);
    expect(result.description).toBe("Mainly clear");
    expect(result.location.name).toBe("Test Site");
    expect(result.daily).toHaveLength(5);
    expect(result.daily![0]!.date).toBe("2026-05-17");
    expect(result.daily![3]!.description).toBe("Moderate rain");
  });

  it("rounds temperature values", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        current: {
          temperature_2m: 22.4,
          apparent_temperature: 20.6,
          relative_humidity_2m: 50,
          wind_speed_10m: 12.9,
          wind_direction_10m: 90,
          weather_code: 0,
          time: "2026-05-17T10:00",
        },
        daily: {
          time: ["2026-05-17"],
          weather_code: [0],
          temperature_2m_max: [25.7],
          temperature_2m_min: [13.2],
          precipitation_sum: [0],
        },
      }),
    } as unknown as Response);

    const result = await fetchWeather();
    expect(result.temperature).toBe(22);
    expect(result.feelsLike).toBe(21);
    expect(result.windSpeed).toBe(13);
    expect(result.daily![0]!.maxTemp).toBe(26);
    expect(result.daily![0]!.minTemp).toBe(13);
  });
});

describe("searchLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty array on non-ok response", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 } as Response);
    const result = await searchLocation("Johannesburg");
    expect(result).toEqual([]);
  });

  it("returns empty array when results field is missing", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response);
    const result = await searchLocation("Unknown Place");
    expect(result).toEqual([]);
  });

  it("maps results to lat/lon/name format", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        results: [
          {
            latitude: -26.2,
            longitude: 28.0,
            name: "Johannesburg",
            country: "South Africa",
          },
          {
            latitude: -29.8,
            longitude: 31.0,
            name: "Durban",
            country: "South Africa",
          },
        ],
      }),
    } as unknown as Response);

    const result = await searchLocation("South Africa");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      lat: -26.2,
      lon: 28.0,
      name: "Johannesburg, South Africa",
    });
    expect(result[1]).toEqual({
      lat: -29.8,
      lon: 31.0,
      name: "Durban, South Africa",
    });
  });

  it("URL-encodes the location name", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ results: [] }),
    } as unknown as Response);

    await searchLocation("New York City");
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("New%20York%20City");
  });
});
