import type { WeatherData } from '@/lib/weather-api';
import { calculateRainProductionLoss } from './weather-production-loss';

function makeWeather(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    temperature: 25,
    feelsLike: 26,
    humidity: 60,
    windSpeed: 12,
    windDirection: 90,
    weatherCode: 0,
    description: 'Clear sky',
    icon: '☀️',
    timestamp: '2026-11-23T09:00:00.000Z',
    location: { lat: -26.35914, lon: 28.79267, name: 'Delmas, Mpumalanga' },
    daily: [
      {
        date: '2026-11-23',
        maxTemp: 28,
        minTemp: 17,
        weatherCode: 0,
        description: 'Clear sky',
        icon: '☀️',
        precipitation: 0,
      },
    ],
    hourly: [],
    ...overrides,
  };
}

describe('calculateRainProductionLoss', () => {
  it('returns nominal risk and zero loss on clear dry conditions', () => {
    const result = calculateRainProductionLoss({
      weather: makeWeather(),
      hoursRemaining: 10,
    });

    expect(result.riskLevel).toBe('nominal');
    expect(result.shiftLossPercent).toBe(0);
    expect(result.estimatedLostTonsToday).toBe(0);
    expect(result.weeklyLostTons).toBe(0);
  });

  it('calculates critical loss during thunderstorm and high precipitation', () => {
    const result = calculateRainProductionLoss({
      weather: makeWeather({
        weatherCode: 95,
        windSpeed: 42,
        daily: [
          {
            date: '2026-11-23',
            maxTemp: 28,
            minTemp: 17,
            weatherCode: 95,
            description: 'Thunderstorm',
            icon: '⛈️',
            precipitation: 18,
          },
          {
            date: '2026-11-24',
            maxTemp: 25,
            minTemp: 16,
            weatherCode: 63,
            description: 'Moderate rain',
            icon: '🌧️',
            precipitation: 10,
          },
        ],
      }),
      hoursRemaining: 10,
    });

    expect(result.riskLevel).toBe('critical');
    expect(result.shiftLossPercent).toBeGreaterThanOrEqual(85);
    expect(result.estimatedLostTonsToday).toBeGreaterThan(1500);
    expect(result.weeklyLostTons).toBeGreaterThan(4000);
    expect(result.dailyBreakdown).toHaveLength(2);
  });

  it('handles zero hours remaining and missing daily/hourly arrays safely', () => {
    const result = calculateRainProductionLoss({
      weather: makeWeather({ weatherCode: 61, daily: undefined, hourly: undefined }),
      hoursRemaining: 0,
    });

    expect(result.riskLevel).toBe('moderate');
    expect(result.estimatedLostHoursToday).toBe(0);
    expect(result.estimatedLostTonsToday).toBeGreaterThan(0);
    expect(result.dailyBreakdown).toEqual([]);
  });
});
