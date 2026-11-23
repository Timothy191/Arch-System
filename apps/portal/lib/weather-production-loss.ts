import type { WeatherData } from '@/lib/weather-api';

type DailyForecast = NonNullable<WeatherData['daily']>[number];
type HourlyForecast = NonNullable<WeatherData['hourly']>[number];

const SHIFT_DURATION_HOURS = 12;
const DEFAULT_BASELINE_TONS_PER_SHIFT = 2400;
const HIGH_WIND_THRESHOLD_KMH = 35;
const WIND_COMPOUND_PENALTY = 0.1;
const MAX_LOSS_FACTOR = 1;

export type RainRiskLevel = 'nominal' | 'moderate' | 'high' | 'critical';

export interface DailyRainProductionLoss {
  readonly date: string;
  readonly precipitationMm: number;
  readonly lossPercent: number;
  readonly lostTons: number;
}

export interface WeatherProductionLossEstimate {
  readonly riskLevel: RainRiskLevel;
  readonly shiftLossPercent: number;
  readonly estimatedLostTonsToday: number;
  readonly estimatedLostHoursToday: number;
  readonly weeklyLostTons: number;
  readonly recommendation: string;
  readonly dailyBreakdown: readonly DailyRainProductionLoss[];
}

const WMO_LOSS_FACTOR_MAP: Readonly<Record<number, number>> = {
  0: 0,
  1: 0,
  2: 0.02,
  3: 0.03,
  45: 0.08,
  48: 0.1,
  51: 0.12,
  53: 0.18,
  55: 0.25,
  61: 0.25,
  63: 0.42,
  65: 0.68,
  71: 0.3,
  73: 0.5,
  75: 0.75,
  95: 0.85,
  96: 0.95,
  99: 1,
};

function getPrecipitationVolumeFactor(precipitationMm: number): number {
  if (!Number.isFinite(precipitationMm) || precipitationMm <= 0) return 0;
  if (precipitationMm < 1) return 0.05;
  if (precipitationMm < 5) return 0.18;
  if (precipitationMm < 15) return 0.38;
  if (precipitationMm < 30) return 0.65;
  return 0.88;
}

function getHourlyRainRiskFactor(hourly: readonly HourlyForecast[] | undefined): number {
  if (!hourly?.length) return 0;
  let totalWeight = 0;
  for (const slot of hourly) {
    const codeFactor = WMO_LOSS_FACTOR_MAP[slot.weatherCode] ?? 0;
    const probFactor = Math.max(0, Math.min(1, slot.precipitationProbability / 100));
    totalWeight += Math.max(codeFactor * 0.7, codeFactor * probFactor);
  }
  return Math.min(MAX_LOSS_FACTOR, totalWeight / hourly.length);
}

function resolveRiskLevel(shiftLossPercent: number): RainRiskLevel {
  if (shiftLossPercent >= 60) return 'critical';
  if (shiftLossPercent >= 30) return 'high';
  if (shiftLossPercent >= 12) return 'moderate';
  return 'nominal';
}

function resolveRecommendation(riskLevel: RainRiskLevel): string {
  const recommendations: Record<RainRiskLevel, string> = {
    nominal: 'Nominal pit & haulage conditions — full production target active.',
    moderate: 'Wet-road speed limits & sump pump standby recommended.',
    high: 'Heavy rain slowdown — prioritize dewatering and high-wall inspections.',
    critical: 'Lightning / flood stand-down — suspend open-pit haulage immediately.',
  };
  return recommendations[riskLevel];
}

function calculateDailyLoss(
  day: DailyForecast,
  baselineTonsPerDay: number
): DailyRainProductionLoss {
  const codeFactor = WMO_LOSS_FACTOR_MAP[day.weatherCode] ?? 0;
  const volumeFactor = getPrecipitationVolumeFactor(day.precipitation);
  const combinedFactor = Math.min(MAX_LOSS_FACTOR, Math.max(codeFactor, volumeFactor));
  const lossPercent = Math.round(combinedFactor * 100);
  const lostTons = Math.round(baselineTonsPerDay * combinedFactor);
  return {
    date: day.date,
    precipitationMm: day.precipitation,
    lossPercent,
    lostTons,
  };
}

/**
 * Intelligent Rain Production Loss Engine.
 * Estimates tonnage and productive hours lost due to precipitation, storm severity,
 * hourly rain probability, and high-wind compounding across the current shift and 7-day forecast.
 */
export function calculateRainProductionLoss(options: {
  readonly weather: WeatherData;
  readonly hoursRemaining: number;
  readonly baselineTonsPerShift?: number;
}): WeatherProductionLossEstimate {
  const baselineTonsPerShift = options.baselineTonsPerShift ?? DEFAULT_BASELINE_TONS_PER_SHIFT;
  const clampedHoursRemaining = Math.max(0, Math.min(SHIFT_DURATION_HOURS, options.hoursRemaining));

  const currentCodeFactor = WMO_LOSS_FACTOR_MAP[options.weather.weatherCode] ?? 0;
  const todayForecast = options.weather.daily?.[0];
  const todayPrecipitationFactor = todayForecast
    ? getPrecipitationVolumeFactor(todayForecast.precipitation)
    : 0;
  const hourlyFactor = getHourlyRainRiskFactor(options.weather.hourly);
  const windPenalty =
    options.weather.windSpeed >= HIGH_WIND_THRESHOLD_KMH && currentCodeFactor > 0.1
      ? WIND_COMPOUND_PENALTY
      : 0;

  const combinedShiftFactor = Math.min(
    MAX_LOSS_FACTOR,
    Math.max(currentCodeFactor, todayPrecipitationFactor * 0.85, hourlyFactor) + windPenalty
  );

  const shiftLossPercent = Math.round(combinedShiftFactor * 100);
  const remainingShiftRatio = clampedHoursRemaining / SHIFT_DURATION_HOURS;
  const estimatedLostTonsToday = Math.round(
    baselineTonsPerShift * combinedShiftFactor * Math.max(0.25, remainingShiftRatio)
  );
  const estimatedLostHoursToday = Math.round(clampedHoursRemaining * combinedShiftFactor * 10) / 10;

  const dailyBreakdown = (options.weather.daily ?? []).map((day) =>
    calculateDailyLoss(day, baselineTonsPerShift * 2)
  );
  const weeklyLostTons = dailyBreakdown.reduce((sum, item) => sum + item.lostTons, 0);

  const riskLevel = resolveRiskLevel(shiftLossPercent);
  const recommendation = resolveRecommendation(riskLevel);

  return {
    riskLevel,
    shiftLossPercent,
    estimatedLostTonsToday,
    estimatedLostHoursToday,
    weeklyLostTons,
    recommendation,
    dailyBreakdown,
  };
}
