import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { type CacheStatsSnapshot, collectRedisHealthDiagnostics, getCacheStats } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
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
  DEGRADED_WEIGHT,
  evaluateSloBudgetState,
  FULL_SLA_PCT,
  getUptimeTargetSummary,
  type HeartbeatStatus,
  type HeartbeatTick,
  MAX_HEARTBEAT_TICKS,
  P95_QUANTILE,
  ROUNDING_FACTOR,
  type SloBudgetState,
  type UptimeTargetId,
  WINDOW_7D_MS,
  WINDOW_24H_MS,
  WINDOW_30D_MS,
} from '@/lib/observability/uptime-engine';

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_ALERT_HOLD_MS = 30_000;
const REDIS_LATENCY_THRESHOLD_MS = 250;
const REDIS_LATENCY_RECOVERY_MS = 150;
const EVENT_LOOP_THRESHOLD_MS = 100;
const EVENT_LOOP_RECOVERY_MS = 50;
const MIN_HIT_RATIO_THRESHOLD_PCT = 80;
const MIN_HIT_RATIO_RECOVERY_PCT = 85;
const PERCENT_SCALE = 100;
const BYTES_PER_MEGABYTE = 1_048_576;
const SPARKLINE_SAMPLE_LIMIT = 12;
const MAX_SLO_HISTORY_ROWS = 360;

const ALL_TARGET_IDS: readonly UptimeTargetId[] = [
  'supabase',
  'redis',
  'fuxa_scada',
  'portal_runtime',
];

const TARGET_LABEL_MAP: Readonly<Record<UptimeTargetId, string>> = {
  supabase: 'Supabase Cloud (Postgres & Auth)',
  redis: 'Redis L1/L2 Cache Engine',
  fuxa_scada: 'FUXA SCADA Telemetry Gateway',
  portal_runtime: 'Portal Node.js 24 Runtime',
};

const SLO_NAMES = ALL_TARGET_IDS.map((targetId) => `uptime:${targetId}`);

const STATUS_WEIGHT_MAP: Readonly<Record<HeartbeatStatus, number>> = {
  UP: 1,
  DEGRADED: DEGRADED_WEIGHT,
  DOWN: 0,
};

const observabilityLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:admin_observability:',
});

function resolvePrincipalIdentity(principal: unknown): { role: string; actorId: string } {
  const record = principal as {
    id?: string;
    role?: string;
    user?: { id?: string };
    employee?: { id?: string; role?: string } | null;
  };
  const role = String(record.employee?.role ?? record.role ?? '').toLowerCase();
  const actorId = record.user?.id ?? record.employee?.id ?? record.id ?? 'unknown';
  return { role, actorId };
}

export interface PersistedUptimeTargetSummary {
  readonly targetId: UptimeTargetId;
  readonly label: string;
  readonly sampleCount: number;
  readonly statusLabel: string;
  readonly currentStatus: HeartbeatStatus | null;
  readonly sloBudgetState: SloBudgetState | null;
  readonly p95LatencyMs: number | null;
  readonly sla24hPct: number | null;
  readonly sla7dPct: number | null;
  readonly sla30dPct: number | null;
  readonly ticks: readonly HeartbeatTick[];
}

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

interface SloMetricRow {
  readonly slo_name?: string | null;
  readonly actual_value?: number | string | null;
  readonly status?: string | null;
  readonly measurement_time?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}

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
  readonly redisSummary: PersistedUptimeTargetSummary;
  readonly runtimeSummary: PersistedUptimeTargetSummary;
}

function computeCacheHitRatePct(cacheStats: CacheStatsSnapshot): number | null {
  const totalLookups = cacheStats.hits + cacheStats.misses;
  if (totalLookups <= 0) return null;
  return Number(((cacheStats.hits / totalLookups) * PERCENT_SCALE).toFixed(1));
}

function resolveTickStatusFromRow(row: SloMetricRow): HeartbeatStatus {
  const metaStatus = row.metadata?.currentStatus;
  if (metaStatus === 'UP' || metaStatus === 'DEGRADED' || metaStatus === 'DOWN') {
    return metaStatus;
  }
  if (row.status === 'breached') return 'DOWN';
  if (row.status === 'warning') return 'DEGRADED';
  return 'UP';
}

function computeWindowSlaPct(ticks: readonly HeartbeatTick[], windowMs: number): number | null {
  if (ticks.length === 0) return null;
  const nowMs = Date.now();
  const windowTicks = ticks.filter((tick) => {
    const parsedMs = Date.parse(tick.checkedAt);
    return Number.isNaN(parsedMs) || nowMs - parsedMs <= windowMs;
  });
  const effectiveTicks = windowTicks.length > 0 ? windowTicks : ticks;
  const weightedSum = effectiveTicks.reduce((sum, tick) => sum + STATUS_WEIGHT_MAP[tick.status], 0);
  const rawPct = (weightedSum / effectiveTicks.length) * FULL_SLA_PCT;
  return Math.round(rawPct * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

function computeP95FromTicks(ticks: readonly HeartbeatTick[]): number | null {
  const nonNegative = ticks.filter((tick) => tick.latencyMs >= 0);
  if (nonNegative.length === 0) return null;
  const sorted = nonNegative.map((tick) => tick.latencyMs).sort((left, right) => left - right);
  const quantileIdx = Math.max(0, Math.ceil(sorted.length * P95_QUANTILE) - 1);
  const p95 = sorted[quantileIdx] ?? 0;
  return Math.round(p95 * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

async function readPersistedSloRows(): Promise<readonly SloMetricRow[]> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase || typeof supabase.from !== 'function') {
      return [];
    }
    const { data: rows, error } = await supabase
      .from('slo_metrics')
      .select('slo_name, actual_value, status, measurement_time, metadata')
      .in('slo_name', SLO_NAMES)
      .order('measurement_time', { ascending: false })
      .limit(MAX_SLO_HISTORY_ROWS);

    if (error || !Array.isArray(rows)) {
      return [];
    }
    return rows as unknown as readonly SloMetricRow[];
  } catch {
    return [];
  }
}

function buildTargetUptimeSummary(
  targetId: UptimeTargetId,
  persistedRows: readonly SloMetricRow[]
): PersistedUptimeTargetSummary {
  const sloKey = `uptime:${targetId}`;
  const matchingPersistedTicks: HeartbeatTick[] = persistedRows
    .filter((row) => row.slo_name === sloKey)
    .slice()
    .reverse()
    .map((row) => {
      const metaLatency = Number(row.metadata?.p95LatencyMs);
      return {
        status: resolveTickStatusFromRow(row),
        latencyMs: Number.isFinite(metaLatency) && metaLatency >= 0 ? metaLatency : 0,
        checkedAt:
          typeof row.measurement_time === 'string' && row.measurement_time.length > 0
            ? row.measurement_time
            : '',
      };
    });

  const inMemoryTicks = getUptimeTargetSummary(targetId).ticks;
  const seenTimestamps = new Set<string>();
  const combinedTicks: HeartbeatTick[] = [];

  for (const tick of [...matchingPersistedTicks, ...inMemoryTicks]) {
    const dedupeKey = tick.checkedAt ? `${tick.checkedAt}:${tick.status}` : '';
    if (dedupeKey && seenTimestamps.has(dedupeKey)) continue;
    if (dedupeKey) seenTimestamps.add(dedupeKey);
    combinedTicks.push(tick);
  }

  const boundedTicks = combinedTicks.slice(-MAX_HEARTBEAT_TICKS);
  if (boundedTicks.length === 0) {
    return {
      targetId,
      label: TARGET_LABEL_MAP[targetId],
      sampleCount: 0,
      statusLabel: 'No samples yet',
      currentStatus: null,
      sloBudgetState: null,
      p95LatencyMs: null,
      sla24hPct: null,
      sla7dPct: null,
      sla30dPct: null,
      ticks: [],
    };
  }

  const latestTick = boundedTicks[boundedTicks.length - 1];
  const currentStatus: HeartbeatStatus = latestTick ? latestTick.status : 'UP';
  const p95LatencyMs = computeP95FromTicks(boundedTicks);
  const sloBudgetState: SloBudgetState =
    currentStatus === 'DOWN' ? 'CRITICAL' : evaluateSloBudgetState(p95LatencyMs ?? 0);

  const latestPersistedForTarget = persistedRows.find((row) => row.slo_name === sloKey);
  const persistedActual = Number(latestPersistedForTarget?.actual_value);
  const computed24h = computeWindowSlaPct(boundedTicks, WINDOW_24H_MS);
  const sla24hPct =
    inMemoryTicks.length === 0 && Number.isFinite(persistedActual) ? persistedActual : computed24h;

  return {
    targetId,
    label: TARGET_LABEL_MAP[targetId],
    sampleCount: boundedTicks.length,
    statusLabel: currentStatus,
    currentStatus,
    sloBudgetState,
    p95LatencyMs,
    sla24hPct,
    sla7dPct: computeWindowSlaPct(boundedTicks, WINDOW_7D_MS),
    sla30dPct: computeWindowSlaPct(boundedTicks, WINDOW_30D_MS),
    ticks: boundedTicks,
  };
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
  const hitRatePct = computeCacheHitRatePct(cacheStats);
  if (hitRatioRule && hitRatePct !== null) {
    evaluateAlertRule({
      rule: hitRatioRule,
      sampleValue: hitRatePct,
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
      primaryValue: hitRatePct !== null ? String(hitRatePct) : 'No samples yet',
      unit: hitRatePct !== null ? '%' : '',
      secondaryLabel: 'Total Lookups',
      secondaryValue: totalLookups.toLocaleString('en-US'),
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

  const { role, actorId } = resolvePrincipalIdentity(principal);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: HTTP_FORBIDDEN });
  }

  const rateLimit = await observabilityLimiter.check(actorId);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  const [cacheStats, redisDiagnostics, observability, persistedSloRows] = await Promise.all([
    getCacheStats().catch(() => FALLBACK_CACHE_STATS),
    collectRedisHealthDiagnostics().catch(() => null),
    getObservabilityMetrics(),
    readPersistedSloRows(),
  ]);

  const runtimeSnapshot = collectRealLayerRuntimeSnapshot();
  evaluateGoldenSignals(cacheStats, runtimeSnapshot.eventLoopDelayP95Ms);

  const uptimeByTarget: Record<UptimeTargetId, PersistedUptimeTargetSummary> = {
    supabase: buildTargetUptimeSummary('supabase', persistedSloRows),
    redis: buildTargetUptimeSummary('redis', persistedSloRows),
    fuxa_scada: buildTargetUptimeSummary('fuxa_scada', persistedSloRows),
    portal_runtime: buildTargetUptimeSummary('portal_runtime', persistedSloRows),
  };
  const uptimeSummaries = ALL_TARGET_IDS.map((targetId) => uptimeByTarget[targetId]);
  const recordedSlaValues = uptimeSummaries
    .map((summary) => summary.sla24hPct)
    .filter((sla): sla is number => sla !== null);

  const overallSla24hPct =
    recordedSlaValues.length > 0
      ? Math.round(
          (recordedSlaValues.reduce((sum, sla) => sum + sla, 0) / recordedSlaValues.length) *
            ROUNDING_FACTOR
        ) / ROUNDING_FACTOR
      : null;

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
      uptimeStatus: overallSla24hPct !== null ? 'recorded' : 'No samples yet',
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
