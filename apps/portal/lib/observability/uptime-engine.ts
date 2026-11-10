export type UptimeTargetId = 'supabase' | 'redis' | 'fuxa_scada' | 'portal_runtime';

export type HeartbeatStatus = 'UP' | 'DEGRADED' | 'DOWN';

export interface HeartbeatTick {
  readonly status: HeartbeatStatus;
  readonly latencyMs: number;
  readonly checkedAt: string;
}

export interface UptimeTargetSummary {
  readonly targetId: UptimeTargetId;
  readonly label: string;
  readonly currentStatus: HeartbeatStatus;
  readonly p95LatencyMs: number;
  readonly sla24hPct: number;
  readonly sla7dPct: number;
  readonly sla30dPct: number;
  readonly ticks: readonly HeartbeatTick[];
}

export interface RecordHeartbeatInput {
  readonly targetId: UptimeTargetId;
  readonly status?: HeartbeatStatus;
  readonly latencyMs: number;
  readonly checkedAt?: string;
}

export const MAX_HEARTBEAT_TICKS = 90;
export const DEGRADED_LATENCY_THRESHOLD_MS = 500;
export const FULL_SLA_PCT = 100;
export const DEGRADED_WEIGHT = 0.5;
export const P95_QUANTILE = 0.95;
export const ROUNDING_FACTOR = 100;

const TARGET_LABEL_MAP: Readonly<Record<UptimeTargetId, string>> = {
  supabase: 'Supabase Cloud (Postgres & Auth)',
  redis: 'Redis L1/L2 Cache Engine',
  fuxa_scada: 'FUXA SCADA Telemetry Gateway',
  portal_runtime: 'Portal Node.js 24 Runtime',
};

const ALL_TARGET_IDS: readonly UptimeTargetId[] = [
  'supabase',
  'redis',
  'fuxa_scada',
  'portal_runtime',
];

const STATUS_WEIGHT_MAP: Readonly<Record<HeartbeatStatus, number>> = {
  UP: 1,
  DEGRADED: DEGRADED_WEIGHT,
  DOWN: 0,
};

const heartbeatRingByTarget = new Map<UptimeTargetId, readonly HeartbeatTick[]>();

function classifyHeartbeatStatus(latencyMs: number): HeartbeatStatus {
  if (latencyMs < 0) return 'DOWN';
  if (latencyMs >= DEGRADED_LATENCY_THRESHOLD_MS) return 'DEGRADED';
  return 'UP';
}

function computeSlaPercentage(ticks: readonly HeartbeatTick[]): number {
  if (ticks.length === 0) return FULL_SLA_PCT;

  const weightedSum = ticks.reduce((sum, tick) => sum + STATUS_WEIGHT_MAP[tick.status], 0);
  const rawPct = (weightedSum / ticks.length) * FULL_SLA_PCT;
  return Math.round(rawPct * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

function computeP95LatencyMs(ticks: readonly HeartbeatTick[]): number {
  const positiveTicks = ticks.filter((tick) => tick.latencyMs >= 0);
  if (positiveTicks.length === 0) return 0;

  const sortedLatencies = positiveTicks
    .map((tick) => tick.latencyMs)
    .sort((left, right) => left - right);
  const quantileIndex = Math.max(0, Math.ceil(sortedLatencies.length * P95_QUANTILE) - 1);
  const p95Latency = sortedLatencies[quantileIndex] ?? 0;
  return Math.round(p95Latency * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

export function recordHeartbeatTick(input: RecordHeartbeatInput): HeartbeatTick {
  const resolvedStatus = input.status ?? classifyHeartbeatStatus(input.latencyMs);
  const tick: HeartbeatTick = {
    status: resolvedStatus,
    latencyMs: input.latencyMs,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
  };

  const existingTicks = heartbeatRingByTarget.get(input.targetId) ?? [];
  const nextTicks = [...existingTicks, tick].slice(-MAX_HEARTBEAT_TICKS);
  heartbeatRingByTarget.set(input.targetId, nextTicks);

  return tick;
}

export function getUptimeTargetSummary(targetId: UptimeTargetId): UptimeTargetSummary {
  const ticks = heartbeatRingByTarget.get(targetId) ?? [];
  const latestTick = ticks[ticks.length - 1];
  const currentStatus: HeartbeatStatus = latestTick ? latestTick.status : 'UP';
  const slaPct = computeSlaPercentage(ticks);

  return {
    targetId,
    label: TARGET_LABEL_MAP[targetId],
    currentStatus,
    p95LatencyMs: computeP95LatencyMs(ticks),
    sla24hPct: slaPct,
    sla7dPct: slaPct,
    sla30dPct: slaPct,
    ticks,
  };
}

export function getAllUptimeSummaries(): readonly UptimeTargetSummary[] {
  return ALL_TARGET_IDS.map((targetId) => getUptimeTargetSummary(targetId));
}

export function resetUptimeEngineState(targetId?: UptimeTargetId): void {
  if (targetId) {
    heartbeatRingByTarget.delete(targetId);
    return;
  }
  heartbeatRingByTarget.clear();
}
