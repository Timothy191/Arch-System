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
  // AGENT-TRACE: Single-pass iteration to compute yMean, sum-of-squares (ssXX) and covariance (ssXY)
  let ySum = 0;
  for (let i = 0; i < n; i++) {
    ySum += data[i]!;
  }
  const yMean = ySum / n;

  let ssXX = 0;
  let ssXY = 0;
  for (let x = 0; x < n; x++) {
    const dx = x - xMean;
    ssXX += dx * dx;
    ssXY += dx * (data[x]! - yMean);
  }
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;

  return Array.from({ length: periods }, (_, i) => yMean + slope * (n + i - xMean));
}
