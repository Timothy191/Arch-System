/**
 * Speed Insights & Real Experience Score (RES) Engine
 * Implements Vercel Speed Insights specification:
 * - Core Web Vitals (FCP, LCP, INP, CLS) + Additional Metrics (FID, TBT, TTFB)
 * - Real Experience Score (RES) weighted calculation (15% FCP, 30% LCP, 30% INP, 25% CLS)
 * - 0-100 rating scale: Good (90-100), Needs Improvement (50-89), Poor (0-49)
 * - Configuration resolution (sampleRate, beforeSend, debug, route, endpoint, scriptSrc, dynamic configuration)
 */

export type SpeedInsightsMetric = 'FCP' | 'LCP' | 'INP' | 'CLS' | 'FID' | 'TBT' | 'TTFB';
export type MetricRating = 'good' | 'needs-improvement' | 'poor';

export interface MetricThreshold {
  good: number;
  needsImprovement: number;
  unit: 'ms' | 'score';
  weight?: number;
}

export const SPEED_INSIGHTS_THRESHOLDS: Record<SpeedInsightsMetric, MetricThreshold> = {
  FCP: { good: 1800, needsImprovement: 3000, unit: 'ms', weight: 0.15 },
  LCP: { good: 2500, needsImprovement: 4000, unit: 'ms', weight: 0.30 },
  INP: { good: 200, needsImprovement: 500, unit: 'ms', weight: 0.30 },
  CLS: { good: 0.1, needsImprovement: 0.25, unit: 'score', weight: 0.25 },
  FID: { good: 100, needsImprovement: 300, unit: 'ms' },
  TBT: { good: 800, needsImprovement: 800, unit: 'ms' }, // Good < 800ms
  TTFB: { good: 800, needsImprovement: 1800, unit: 'ms' },
};

export const RES_METRIC_WEIGHTS: Record<'FCP' | 'LCP' | 'INP' | 'CLS', number> = {
  FCP: 0.15,
  LCP: 0.30,
  INP: 0.30,
  CLS: 0.25,
};

export interface SpeedInsightsEvent {
  name: SpeedInsightsMetric;
  value: number;
  rating?: MetricRating;
  delta?: number;
  id?: string;
  url: string;
  route?: string;
  speed?: string;
}

export interface SpeedInsightsConfig {
  sampleRate?: number; // 0 to 1, default 1
  beforeSend?: (data: SpeedInsightsEvent) => SpeedInsightsEvent | null;
  debug?: boolean;
  route?: string;
  endpoint?: string;
  scriptSrc?: string;
}

export interface DynamicObservabilityConfig {
  speedInsights?: {
    scriptSrc?: string;
    endpoint?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface MetricEvaluation {
  metric: SpeedInsightsMetric;
  value: number;
  rating: MetricRating;
  score: number; // 0 - 100
  weight?: number;
}

export interface RESResult {
  resScore: number; // 0 - 100
  resRating: MetricRating; // 'good' | 'needs-improvement' | 'poor'
  metrics: Partial<Record<SpeedInsightsMetric, MetricEvaluation>>;
  rawWeightsUsed: number;
}

/**
 * Determine performance rating tier based on official Vercel thresholds.
 */
export function rateMetric(metric: SpeedInsightsMetric, value: number): MetricRating {
  const threshold = SPEED_INSIGHTS_THRESHOLDS[metric];
  if (!threshold) {
    throw new Error(`Unknown metric: ${metric}`);
  }

  if (metric === 'TBT') {
    return value < threshold.good ? 'good' : 'needs-improvement';
  }

  if (value <= threshold.good) {
    return 'good';
  }
  if (value <= threshold.needsImprovement) {
    return 'needs-improvement';
  }
  return 'poor';
}

/**
 * Calculate a continuous 0-100 score for an individual metric:
 * - Good range (0 -> good threshold): 100 down to 90
 * - Needs improvement (good threshold -> needsImprovement threshold): 89 down to 50
 * - Poor (> needsImprovement threshold): 49 down to 0
 */
export function calculateMetricScore(metric: SpeedInsightsMetric, value: number): number {
  const threshold = SPEED_INSIGHTS_THRESHOLDS[metric];
  if (!threshold) return 0;
  if (value < 0) return 100;

  if (metric === 'TBT') {
    if (value < threshold.good) {
      // Good (< 800ms): 90 - 100
      const ratio = value / threshold.good;
      return Math.round(100 - ratio * 10);
    }
    // Beyond 800ms
    const excess = value - threshold.good;
    return Math.max(0, Math.round(89 - (excess / 1200) * 89));
  }

  if (value <= threshold.good) {
    // 90 to 100
    const ratio = threshold.good === 0 ? 0 : value / threshold.good;
    return Math.round(100 - ratio * 10);
  } else if (value <= threshold.needsImprovement) {
    // 50 to 89
    const span = threshold.needsImprovement - threshold.good;
    const offset = value - threshold.good;
    const ratio = span === 0 ? 1 : offset / span;
    return Math.round(89 - ratio * 39);
  } else {
    // 0 to 49
    const poorSpan = threshold.needsImprovement; // scale over another threshold width
    const excess = value - threshold.needsImprovement;
    const ratio = Math.min(1, excess / poorSpan);
    return Math.max(0, Math.round(49 - ratio * 49));
  }
}

/**
 * Calculate Real Experience Score (RES) according to Vercel Speed Insights:
 * RES = (FCP * 0.15) + (LCP * 0.30) + (INP * 0.30) + (CLS * 0.25)
 * Score scale:
 * 90 - 100: Good
 * 50 - 89: Needs Improvement
 * 0 - 49: Poor
 */
export function calculateRES(
  input: {
    FCP?: number;
    LCP?: number;
    INP?: number;
    CLS?: number;
    FID?: number; // Optional fallback if INP is absent
    TBT?: number;
    TTFB?: number;
  }
): RESResult {
  const evaluatedMetrics: Partial<Record<SpeedInsightsMetric, MetricEvaluation>> = {};

  // Track Core Web Vitals weights
  let weightedSum = 0;
  let totalWeight = 0;

  const coreKeys: Array<'FCP' | 'LCP' | 'INP' | 'CLS'> = ['FCP', 'LCP', 'INP', 'CLS'];

  // Handle INP fallback from FID if INP is missing
  const effectiveInput = { ...input };
  if (effectiveInput.INP == null && effectiveInput.FID != null) {
    effectiveInput.INP = effectiveInput.FID;
  }

  for (const key of coreKeys) {
    const val = effectiveInput[key];
    if (val != null && !Number.isNaN(val)) {
      const rating = rateMetric(key, val);
      const score = calculateMetricScore(key, val);
      const weight = RES_METRIC_WEIGHTS[key];

      evaluatedMetrics[key] = {
        metric: key,
        value: val,
        rating,
        score,
        weight,
      };

      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  // Also evaluate secondary metrics if provided
  const secondaryKeys: Array<'FID' | 'TBT' | 'TTFB'> = ['FID', 'TBT', 'TTFB'];
  for (const key of secondaryKeys) {
    const val = input[key];
    if (val != null && !Number.isNaN(val)) {
      evaluatedMetrics[key] = {
        metric: key,
        value: val,
        rating: rateMetric(key, val),
        score: calculateMetricScore(key, val),
      };
    }
  }

  // Normalize final score based on available weights
  const resScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  let resRating: MetricRating = 'poor';
  if (resScore >= 90) {
    resRating = 'good';
  } else if (resScore >= 50) {
    resRating = 'needs-improvement';
  }

  return {
    resScore,
    resRating,
    metrics: evaluatedMetrics,
    rawWeightsUsed: totalWeight,
  };
}

/**
 * Resolve Speed Insights Configuration:
 * Parses dynamic configuration (VERCEL_OBSERVABILITY_CLIENT_CONFIG)
 * and merges with user-provided component/function props.
 */
export function resolveSpeedInsightsConfig(
  clientConfigEnv?: string,
  propsConfig: SpeedInsightsConfig = {}
): SpeedInsightsConfig & { isDebugEnabled: boolean } {
  let parsedDynamic: DynamicObservabilityConfig['speedInsights'] = {};

  if (clientConfigEnv) {
    try {
      const parsed = JSON.parse(clientConfigEnv) as DynamicObservabilityConfig;
      if (parsed?.speedInsights) {
        parsedDynamic = parsed.speedInsights;
      }
    } catch {
      // Malformed JSON is ignored safely
    }
  }

  // Determine debug mode: automatic in 'development' or 'test' unless explicitly overridden
  const nodeEnv = process.env.NODE_ENV;
  const autoDebug = nodeEnv === 'development' || nodeEnv === 'test';
  const isDebugEnabled = propsConfig.debug !== undefined ? Boolean(propsConfig.debug) : autoDebug;

  return {
    sampleRate: propsConfig.sampleRate !== undefined ? propsConfig.sampleRate : 1.0,
    beforeSend: propsConfig.beforeSend,
    debug: isDebugEnabled,
    isDebugEnabled,
    route: propsConfig.route,
    endpoint: propsConfig.endpoint || parsedDynamic.endpoint,
    scriptSrc: propsConfig.scriptSrc || parsedDynamic.scriptSrc,
  };
}

/**
 * Filter and validate Speed Insights telemetry event before dispatch.
 * Implements sampleRate probabilistic sampling and beforeSend sanitization/filtering.
 */
export function processSpeedInsightsEvent(
  event: SpeedInsightsEvent,
  config: SpeedInsightsConfig,
  randomFn: () => number = Math.random
): SpeedInsightsEvent | null {
  // Validate sampleRate (0 to 1)
  const sampleRate = config.sampleRate !== undefined ? config.sampleRate : 1.0;
  if (sampleRate < 0 || sampleRate > 1) {
    throw new RangeError(`sampleRate must be between 0 and 1, got ${sampleRate}`);
  }

  // Probabilistic drop if sampleRate < 1
  if (sampleRate === 0 || randomFn() > sampleRate) {
    return null;
  }

  // Apply beforeSend transformation / filter
  if (typeof config.beforeSend === 'function') {
    const transformed = config.beforeSend(event);
    if (!transformed) {
      return null; // Ignored by beforeSend
    }
    return transformed;
  }

  return event;
}

/**
 * Diagnostics & Troubleshooting Utilities based on Vercel Speed Insights Reference:
 * - "No data visible in Speed Insights dashboard" (adblocker/CSP issues, script failure)
 * - "Requests are not getting called" (event buffering until blur/unload/pagehide)
 * - "Speed Insights behind a reverse proxy" (forwarding /_vercel/speed-insights/* & endpoints)
 */

export interface CspCheckResult {
  valid: boolean;
  scriptAllowed: boolean;
  connectAllowed: boolean;
  issues: string[];
}

/**
 * Validates that Content-Security-Policy permits Speed Insights scripts and telemetry.
 */
export function validateCspForSpeedInsights(cspHeader: string): CspCheckResult {
  const issues: string[] = [];

  // Parse directives
  const directives = cspHeader
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean);

  let scriptSrc = '';
  let connectSrc = '';

  for (const dir of directives) {
    if (dir.startsWith('script-src ')) {
      scriptSrc = dir.replace('script-src ', '');
    } else if (dir.startsWith('connect-src ')) {
      connectSrc = dir.replace('connect-src ', '');
    }
  }

  // Check script-src: must allow 'self', nonces, or va.vercel-scripts.com
  const scriptAllowed =
    !scriptSrc ||
    scriptSrc.includes("'self'") ||
    scriptSrc.includes('https://va.vercel-scripts.com') ||
    scriptSrc.includes("'unsafe-inline'");

  if (!scriptAllowed) {
    issues.push(
      "CSP script-src does not allow 'self' or 'https://va.vercel-scripts.com'. Speed Insights script will be blocked."
    );
  }

  // Check connect-src: must allow 'self' or va.vercel-scripts.com
  const connectAllowed =
    !connectSrc ||
    connectSrc.includes("'self'") ||
    connectSrc.includes('https://va.vercel-scripts.com') ||
    connectSrc.includes('*');

  if (!connectAllowed) {
    issues.push(
      "CSP connect-src does not allow 'self' or 'https://va.vercel-scripts.com'. Speed Insights beacon will be blocked."
    );
  }

  return {
    valid: issues.length === 0,
    scriptAllowed,
    connectAllowed,
    issues,
  };
}

/**
 * Verifies if a reverse proxy route forwards Speed Insights traffic.
 * Vercel requires forwarding of `/_vercel/speed-insights/*` and custom script endpoints.
 */
export function isReverseProxyPathExempt(pathname: string): boolean {
  return (
    pathname.startsWith('/_vercel/speed-insights') ||
    pathname.startsWith('/_vercel/insights')
  );
}

