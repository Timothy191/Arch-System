import { type CacheStatsSnapshot, collectRedisHealthDiagnostics, getCacheStats } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { NextResponse } from 'next/server';
import {
  type AlertRuleDefinition,
  evaluateAlertRule,
  getActiveAlertEvaluations,
} from '@/lib/observability/alert-evaluator';
import { collectRealLayerRuntimeSnapshot } from '@/lib/observability/metrics';
import { getObservabilityMetrics } from '@/lib/observability/simple-metrics';
import { getAllUptimeSummaries, recordHeartbeatTick } from '@/lib/observability/uptime-engine';

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const DEFAULT_ALERT_HOLD_MS = 30_000;
const REDIS_LATENCY_THRESHOLD_MS = 250;
const REDIS_LATENCY_RECOVERY_MS = 150;
const EVENT_LOOP_THRESHOLD_MS = 100;
const EVENT_LOOP_RECOVERY_MS = 50;

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
      uptime: getAllUptimeSummaries(),
      alerts: getActiveAlertEvaluations(),
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
