/**
 * Simple least-squares linear regression forecast.
 * @param data - Historical numeric values (chronological order)
 * @param periods - Number of future periods to forecast
 * @returns Array of `periods` forecasted values
 */
export function linearForecast(data: number[], periods: number): number[] {
  const n = data.length;
  if (n < 2) return Array(periods).fill(data[0] ?? 0) as number[];

  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;

  const ssXX = data.reduce((acc, _, x) => acc + (x - xMean) ** 2, 0);
  const ssXY = data.reduce((acc, y, x) => acc + (x - xMean) * (y - yMean), 0);
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;

  return Array.from({ length: periods }, (_, i) => yMean + slope * (n + i - xMean));
}
