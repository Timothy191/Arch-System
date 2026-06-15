/**
 * Open-Meteo Weather API Integration
 * Free weather API with no API key required
 * https://open-meteo.com/
 */

import { APIError } from "@/lib/errors/error-classes";

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  description: string;
  icon: string;
  timestamp: string;
  location: {
    lat: number;
    lon: number;
    name?: string;
  };
  daily?: DailyForecast[];
}

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  description: string;
  icon: string;
  precipitation: number;
}

// WMO Weather interpretation codes
const weatherCodes: Record<number, { description: string; icon: string }> = {
  0: { description: "Clear sky", icon: "☀️" },
  1: { description: "Mainly clear", icon: "🌤️" },
  2: { description: "Partly cloudy", icon: "⛅" },
  3: { description: "Overcast", icon: "☁️" },
  45: { description: "Foggy", icon: "🌫️" },
  48: { description: "Depositing rime fog", icon: "🌫️" },
  51: { description: "Light drizzle", icon: "🌦️" },
  53: { description: "Moderate drizzle", icon: "🌦️" },
  55: { description: "Dense drizzle", icon: "🌧️" },
  61: { description: "Slight rain", icon: "🌦️" },
  63: { description: "Moderate rain", icon: "🌧️" },
  65: { description: "Heavy rain", icon: "⛈️" },
  71: { description: "Slight snow", icon: "🌨️" },
  73: { description: "Moderate snow", icon: "❄️" },
  75: { description: "Heavy snow", icon: "❄️" },
  95: { description: "Thunderstorm", icon: "⛈️" },
  96: { description: "Thunderstorm with hail", icon: "⛈️" },
  99: { description: "Thunderstorm with heavy hail", icon: "⛈️" },
};

export function getWeatherDescription(code: number): {
  description: string;
  icon: string;
} {
  return weatherCodes[code] || { description: "Unknown", icon: "❓" };
}

export function getWindDirection(deg: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return dirs[index] ?? "N";
}

/**
 * Fetch current weather for coordinates
 */
export async function fetchWeather(
  lat: number = -26.1436, // Delmas, Mpumalanga, South Africa default
  lon: number = 28.6811,
  locationName?: string,
): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

  const response = await fetch(url, { next: { revalidate: 300 } }); // Cache 5 minutes

  if (!response.ok) {
    throw new APIError(`Weather API error: ${response.status}`, {
      statusCode: response.status,
      context: { endpoint: "open-meteo", statusText: response.statusText },
    });
  }

  const data = await response.json();
  const current = data.current;
  const weatherInfo = getWeatherDescription(current.weather_code);

  // Parse daily forecast (next 5 days)
  const daily: DailyForecast[] = data.daily.time
    .slice(0, 5)
    .map((date: string, index: number) => {
      const code = data.daily.weather_code[index];
      const info = getWeatherDescription(code);
      return {
        date,
        maxTemp: Math.round(data.daily.temperature_2m_max[index]),
        minTemp: Math.round(data.daily.temperature_2m_min[index]),
        weatherCode: code,
        description: info.description,
        icon: info.icon,
        precipitation: data.daily.precipitation_sum[index],
      };
    });

  return {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    windSpeed: Math.round(current.wind_speed_10m),
    windDirection: current.wind_direction_10m,
    weatherCode: current.weather_code,
    description: weatherInfo.description,
    icon: weatherInfo.icon,
    timestamp: current.time,
    location: { lat, lon, name: locationName },
    daily,
  };
}

/**
 * Search for location coordinates by name (using Open-Meteo Geocoding API)
 */
export async function searchLocation(
  name: string,
): Promise<{ lat: number; lon: number; name: string }[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;

  const response = await fetch(url, { next: { revalidate: 86400 } }); // Cache 24 hours

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  if (!data.results) {
    return [];
  }

  return data.results.map((result: any) => ({
    lat: result.latitude,
    lon: result.longitude,
    name: `${result.name}, ${result.country}`,
  }));
}

/**
 * Get weather alerts/advisories for operations
 */
export function getWeatherAlert(weather: WeatherData): {
  level: "none" | "advisory" | "warning" | "critical";
  message: string;
} {
  const code = weather.weatherCode;

  // Critical conditions for outdoor operations
  if (code >= 95) {
    return {
      level: "critical",
      message: "⚠️ Thunderstorm - Cease outdoor operations immediately",
    };
  }

  if (code >= 71 && code <= 75) {
    return {
      level: "warning",
      message: "❄️ Snow conditions - Reduced visibility and traction",
    };
  }

  if (code === 65 || weather.windSpeed > 50) {
    return {
      level: "warning",
      message: "🌧️ Heavy rain/high winds - Exercise caution outdoors",
    };
  }

  if (code >= 45 && code <= 48) {
    return {
      level: "advisory",
      message: "🌫️ Fog conditions - Reduced visibility",
    };
  }

  if (weather.windSpeed > 30) {
    return {
      level: "advisory",
      message: "💨 Strong winds - Secure equipment",
    };
  }

  return { level: "none", message: "" };
}
