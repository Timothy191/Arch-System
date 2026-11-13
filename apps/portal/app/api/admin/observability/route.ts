import { type CacheStatsSnapshot, collectRedisHealthDiagnostics, getCacheStats } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { NextResponse } from 'next/server';
import {
  type AlertEvaluationResult,
  type AlertRuleDefinition,
  type AlertRuleState,
  evaluateAlertRule,
  getActiveAlertEvaluations,
} from '@/lib/observability/alert-evaluator';
import { collectRealLayerRuntimeSnapshot } from '@/lib/observability/metrics';
import { getObservabilityMetrics } from '@/lib/observability/simple-metrics';
import {
  getAllUptimeSummaries,
  getOverallSla24hPct,
  getUptimeSummariesByTarget,
  recordHeartbeatTick,
  type UptimeTargetSummary,
} from '@/lib/observability/uptime-engine';

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const DEFAULT_ALERT_HOLD_MS = 30_000;
const REDIS_LATENCY_THRESHOLD_MS = 250;
const REDIS_LATENCY_RECOVERY_MS = 150;
const EVENT_LOOP_THRESHOLD_MS = 100;
const EVENT_LOOP_RECOVERY_MS = 50;
const MIN_HIT_RATIO_THRESHOLD_PCT = 80;
const MIN_HIT_RATIO_RECOVERY_PCT = 85;
const PERCENT_SCALE = 100;
const BYTES_PER_MEGABYTE = 1_048_576;
const DEFAULT_HIT_RATE_PCT = 100;
const SPARKLINE_SAMPLE_LIMIT = 12;

export interface GoldenSignalSummaryItem {
  readonly id: 'latency' | 'traffic' | 'errors' | 'saturation';
  readonly title: string;
  readonly subtitle: string;
  readonly primaryValue: string;
  readonly unit: string;
  readonly secondaryLabel: string;
  readonly secondaryValue: string;
  readonly alertState: AlertRuleState;
  readonly thresholdLabel: string;
  readonly seriesValues: readonly number[];
}

const GOLDEN_SIGNAL_RULES: readonly AlertRuleDefinition[] = [
  {
    ruleId: 'redis_p95_latency',
    label: 'Redis L2 p95 Latency (ms)',
    threshold: REDIS_LATENCY_THRESHOLD_MS,
    recoveryThreshold: REDIS_LATENCY_RECOVERY_MS,
    forDurationMs: DEFAULT_ALERT_HOLD_MS,
    comparison: 'gt',
  },
  {
    ruleId: 'node_event_loop_p95',
    label: 'Node.js Event Loop p95 Delay (ms)',
    threshold: EVENT_LOOP_THRESHOLD_MS,
    recoveryThreshold: EVENT_LOOP_RECOVERY_MS,
    forDurationMs: DEFAULT_ALERT_HOLD_MS,
    comparison: 'gt',
  },
  {
    ruleId: 'redis_error_spike',
    label: 'Redis Transport Errors',
    threshold: 0,
    forDurationMs: 0,
    comparison: 'gt',
  },
  {
    ruleId: 'cache_hit_ratio_drop',
    label: 'Cache Hit Ratio (%)',
    threshold: MIN_HIT_RATIO_THRESHOLD_PCT,
    recoveryThreshold: MIN_HIT_RATIO_RECOVERY_PCT,
    forDurationMs: DEFAULT_ALERT_HOLD_MS,
    comparison: 'lt',
  },
];

const FALLBACK_CACHE_STATS: CacheStatsSnapshot = {
  xFetchTriggers: 0,
  hits: 0,
  misses: 0,
  l1Hits: 0,
  l2Hits: 0,
  redisErrors: 1,
  avgLatencyMs: 0,
  p95LatencyMs: 0,
  l1Evictions: 0,
  l2RoundTrips: 0,
  privilegeVersionChanges: 0,
  avgWriteThroughDelayMs: 0,
};

interface JobMetricLike {
  readonly count: number;
  readonly errors: number;
  readonly lastDurationMs?: number;
  readonly totalDurationMs?: number;
}

interface GoldenSignalBuildContext {
  readonly cacheStats: CacheStatsSnapshot;
  readonly eventLoopDelayP95Ms: number;
  readonly heapUsedMb: number;
  readonly alerts: readonly AlertEvaluationResult[];
  readonly redisSummary: UptimeTargetSummary;
  readonly runtimeSummary: UptimeTargetSummary;
}

function computeCacheHitRatePct(cacheStats: CacheStatsSnapshot): number {
  const totalLookups = cacheStats.hits + cacheStats.misses;
  if (totalLookups <= 0) return DEFAULT_HIT_RATE_PCT;
  return Number(((cacheStats.hits / totalLookups) * PERCENT_SCALE).toFixed(1));
}

function recordPassiveHeartbeats(
  cacheStats: CacheStatsSnapshot,
  eventLoopDelayP95Ms: number
): void {
  const checkedAt = new Date().toISOString();
  recordHeartbeatTick({
    targetId: 'redis',
    latencyMs: cacheStats.p95LatencyMs || cacheStats.avgLatencyMs,
    checkedAt,
  });
  recordHeartbeatTick({
    targetId: 'portal_runtime',
    latencyMs: eventLoopDelayP95Ms,
    checkedAt,
  });
  recordHeartbeatTick({
    targetId: 'supabase',
    latencyMs: cacheStats.avgLatencyMs,
    checkedAt,
  });
  recordHeartbeatTick({
    targetId: 'fuxa_scada',
    latencyMs: eventLoopDelayP95Ms,
    checkedAt,
  });
}

function evaluateGoldenSignals(cacheStats: CacheStatsSnapshot, eventLoopDelayP95Ms: number): void {
  const redisLatencyRule = GOLDEN_SIGNAL_RULES[0];
  const eventLoopRule = GOLDEN_SIGNAL_RULES[1];
  const redisErrorRule = GOLDEN_SIGNAL_RULES[2];
  const hitRatioRule = GOLDEN_SIGNAL_RULES[3];

  if (redisLatencyRule) {
    evaluateAlertRule({
      rule: redisLatencyRule,
      sampleValue: cacheStats.p95LatencyMs,
    });
  }
  if (eventLoopRule) {
    evaluateAlertRule({
      rule: eventLoopRule,
      sampleValue: eventLoopDelayP95Ms,
    });
  }
  if (redisErrorRule) {
    evaluateAlertRule({
      rule: redisErrorRule,
      sampleValue: cacheStats.redisErrors,
    });
  }
  if (hitRatioRule) {
    evaluateAlertRule({
      rule: hitRatioRule,
      sampleValue: computeCacheHitRatePct(cacheStats),
    });
  }
}

function resolveAlertState(
  alerts: readonly AlertEvaluationResult[],
  ruleId: string
): AlertRuleState {
  return alerts.find((entry) => entry.ruleId === ruleId)?.state ?? 'NORMAL';
}

function buildGoldenSignalPanels(
  context: GoldenSignalBuildContext
): readonly GoldenSignalSummaryItem[] {
  const hitRatePct = computeCacheHitRatePct(context.cacheStats);
  const totalLookups = context.cacheStats.hits + context.cacheStats.misses;
  const redisLatencies = context.redisSummary.ticks
    .slice(-SPARKLINE_SAMPLE_LIMIT)
    .map((tick) => Math.max(1, tick.latencyMs));
  const runtimeLatencies = context.runtimeSummary.ticks
    .slice(-SPARKLINE_SAMPLE_LIMIT)
    .map((tick) => Math.max(1, tick.latencyMs));

  return [
    {
      id: 'latency',
      title: 'Latency (Redis & DB p95)',
      subtitle: 'W3C Server-Timing & L2 round-trip',
      primaryValue: String(context.cacheStats.p95LatencyMs || context.cacheStats.avgLatencyMs),
      unit: 'ms',
      secondaryLabel: 'Avg Latency',
      secondaryValue: `${context.cacheStats.avgLatencyMs}ms`,
      alertState: resolveAlertState(context.alerts, 'redis_p95_latency'),
      thresholdLabel: `SLO < ${REDIS_LATENCY_THRESHOLD_MS}ms`,
      seriesValues: redisLatencies,
    },
    {
      id: 'traffic',
      title: 'Traffic & Cache Hit Ratio',
      subtitle: 'L1 TinyLFU + L2 Redis Lookups',
      primaryValue: String(hitRatePct),
      unit: '%',
      secondaryLabel: 'Total Lookups',
      secondaryValue: totalLookups.toLocaleString(),
      alertState: resolveAlertState(context.alerts, 'cache_hit_ratio_drop'),
      thresholdLabel: `Floor > ${MIN_HIT_RATIO_THRESHOLD_PCT}%`,
      seriesValues: [context.cacheStats.l1Hits, context.cacheStats.l2Hits, totalLookups],
    },
    {
      id: 'errors',
      title: 'Errors & Circuit Breakers',
      subtitle: 'Transport faults & L1 evictions',
      primaryValue: String(context.cacheStats.redisErrors),
      unit: 'faults',
      secondaryLabel: 'L1 Evictions',
      secondaryValue: String(context.cacheStats.l1Evictions),
      alertState: resolveAlertState(context.alerts, 'redis_error_spike'),
      thresholdLabel: 'Budget = 0 faults',
      seriesValues: [context.cacheStats.redisErrors, context.cacheStats.l1Evictions],
    },
    {
      id: 'saturation',
      title: 'Saturation (Node.js 24 ELU)',
      subtitle: 'Event loop p95 delay & V8 heap',
      primaryValue: String(context.eventLoopDelayP95Ms),
      unit: 'ms',
      secondaryLabel: 'V8 Heap Used',
      secondaryValue: `${context.heapUsedMb} MB`,
      alertState: resolveAlertState(context.alerts, 'node_event_loop_p95'),
      thresholdLabel: `SLO < ${EVENT_LOOP_THRESHOLD_MS}ms`,
      seriesValues: runtimeLatencies,
    },
  ];
}

export async function GET() {
  const startedAtMs = Date.now();
  const principal = await getAuthenticatedEmployee().catch(() => null);
  if (!principal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const [cacheStats, redisDiagnostics, observability] = await Promise.all([
    getCacheStats().catch(() => FALLBACK_CACHE_STATS),
    collectRedisHealthDiagnostics().catch(() => null),
    getObservabilityMetrics(),
  ]);

  const runtimeSnapshot = collectRealLayerRuntimeSnapshot();
  recordPassiveHeartbeats(cacheStats, runtimeSnapshot.eventLoopDelayP95Ms);
  evaluateGoldenSignals(cacheStats, runtimeSnapshot.eventLoopDelayP95Ms);

  const uptimeSummaries = getAllUptimeSummaries();
  const uptimeByTarget = getUptimeSummariesByTarget();
  const overallSla24hPct = getOverallSla24hPct();
  const activeAlerts = getActiveAlertEvaluations();
  const goldenSignals = buildGoldenSignalPanels({
    cacheStats,
    eventLoopDelayP95Ms: runtimeSnapshot.eventLoopDelayP95Ms,
    heapUsedMb:
      Math.round((runtimeSnapshot.v8HeapUsedBytes / BYTES_PER_MEGABYTE) * PERCENT_SCALE) /
      PERCENT_SCALE,
    alerts: activeAlerts,
    redisSummary: uptimeByTarget.redis,
    runtimeSummary: uptimeByTarget.portal_runtime,
  });

  const workflows = Array.from(observability.jobMetrics.entries()).map(([jobId, metric]) => {
    const typedMetric = metric as JobMetricLike;
    return {
      jobId,
      count: typedMetric.count,
      errors: typedMetric.errors,
      lastDurationMs: typedMetric.lastDurationMs ?? typedMetric.totalDurationMs ?? 0,
    };
  });

  const totalDurationMs = Math.max(0, Date.now() - startedAtMs);

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      overallSla24hPct,
      uptime: uptimeSummaries,
      uptimeByTarget,
      goldenSignals,
      alerts: activeAlerts,
      redis: {
        stats: cacheStats,
        diagnostics: redisDiagnostics,
      },
      runtime: runtimeSnapshot,
      workflows,
    },
    {
      status: HTTP_OK,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Server-Timing': `cache;dur=${cacheStats.avgLatencyMs}, obs;dur=${totalDurationMs}`,
      },
    }
  );
}
