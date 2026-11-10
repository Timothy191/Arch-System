const DECIMAL_PLACES_MS = 1;
const TOTAL_METRIC_NAME = 'total';

export interface ServerTimingMetric {
  readonly name: string;
  readonly durationMs: number | null;
  readonly description: string | null;
}

function parseSingleMetricSegment(segment: string): ServerTimingMetric | null {
  const parts = segment
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const metricName = parts[0];
  if (!metricName) return null;

  let durationMs: number | null = null;
  let description: string | null = null;

  for (const param of parts.slice(1)) {
    const equalsIdx = param.indexOf('=');
    if (equalsIdx === -1) continue;
    const paramKey = param.slice(0, equalsIdx).trim().toLowerCase();
    const rawParamContent = param
      .slice(equalsIdx + 1)
      .trim()
      .replace(/^"|"$/g, '');

    if (paramKey === 'dur') {
      const parsedNumber = Number(rawParamContent);
      if (Number.isFinite(parsedNumber) && parsedNumber >= 0) {
        durationMs = parsedNumber;
      }
      continue;
    }

    if (paramKey === 'desc' && rawParamContent.length > 0) {
      description = rawParamContent;
    }
  }

  return {
    name: metricName,
    durationMs,
    description,
  };
}

/**
 * Parses a W3C `Server-Timing` HTTP response header into structured metrics.
 */
export function parseServerTimingHeader(
  headerText: string | null | undefined
): readonly ServerTimingMetric[] {
  if (!headerText || headerText.trim().length === 0) {
    return [];
  }

  return headerText
    .split(',')
    .map((segment) => parseSingleMetricSegment(segment))
    .filter((metric): metric is ServerTimingMetric => metric !== null);
}

/**
 * Formats parsed W3C `Server-Timing` metrics into a concise millisecond badge label.
 */
export function formatServerTimingSummary(metrics: readonly ServerTimingMetric[]): string | null {
  if (metrics.length === 0) return null;

  const preferredMetric =
    metrics.find(
      (metric) => metric.name.toLowerCase() === TOTAL_METRIC_NAME && metric.durationMs !== null
    ) ?? metrics.find((metric) => metric.durationMs !== null);

  if (!preferredMetric || preferredMetric.durationMs === null) {
    return null;
  }

  return `${preferredMetric.durationMs.toFixed(DECIMAL_PLACES_MS)}ms`;
}
