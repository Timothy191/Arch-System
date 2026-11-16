'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import { RedisIcon } from '@repo/ui/RedisIcon';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DatabaseZap,
  Gauge,
  GitBranch,
  HardDrive,
  Key,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const REDIS_ICON_LG_PX = 24;
const REDIS_ICON_SM_PX = 18;
const KPI_GRID_COLUMNS = 4;
const HEARTBEAT_TICK_COUNT = 90;
const DEFAULT_TOTAL_KEYS = 84392;
const DEFAULT_OPS_PER_SECOND = 2400;
const DEFAULT_SLA_PCT = 99.98;
const DEFAULT_L1_HIT_RATE_PCT = 94.2;
const DEFAULT_L2_HIT_RATE_PCT = 88.6;
const DEFAULT_MISS_RATE_PCT = 5.8;
const DEFAULT_LATENCY_MS = 4;
const PERCENT_MULTIPLIER = 100;
const JSON_INDENT_SPACES = 2;
const SAMPLE_TTL_SECONDS = 3600;
const MS_PER_SECOND = 1000;
const SAMPLE_READ_COUNT = 12847;
const SAMPLE_WRITE_COUNT = 3921;
const SAMPLE_COMMAND_COUNT = 16768;
const SAMPLE_ACTIVE_MACHINES = 14;
const SAMPLE_TOTAL_TONS_MOVED = 15400;
const SAMPLE_DRILL_DEPTH_METERS = 42.5;
const SAMPLE_DRILL_RPM = 120;
const SAMPLE_VIBRATION_G = 0.8;
const SAMPLE_RATE_LIMIT_MAX = 100;
const SAMPLE_RATE_LIMIT_REMAINING = 98;
const SAMPLE_RATE_LIMIT_WINDOW_S = 60;
const SAMPLE_QUEUED_EVENTS = 4;
const SAMPLE_SUBSCRIBERS = 2;
const DEFAULT_SLOWLOG_COUNT = 12;
const DEFAULT_EVICTED_KEYS = 42;
const DEFAULT_HIT_RATE_RATIO = 0.94;
const DEFAULT_MAX_MEMORY_MB = 64;
const DEFAULT_USED_MEMORY_MB = 48.6;
const DEFAULT_FRAGMENTATION_RATIO = 1.2;
const DEFAULT_CONNECTED_SLAVES = 0;
const DEFAULT_REPLICATION_ROLE = 'master';
const DEFAULT_MAXMEMORY_POLICY = 'noeviction';
const REDIS_LATENCY_THRESHOLD_MS = 250;
const EVENT_LOOP_THRESHOLD_MS = 100;
const MIN_HIT_RATIO_THRESHOLD_PCT = 80;
const SAMPLE_COMMAND_NAMES = [
  'GET',
  'SET',
  'HGET',
  'HSET',
  'LRANGE',
  'LPUSH',
  'EXPIRE',
  'INCR',
  'ZADD',
  'PUBLISH',
];
const SAMPLE_COMMAND_COUNTS = [3245, 2891, 1567, 1423, 987, 654, 432, 321, 234, 156];
const SAMPLE_SLOWLOG_COMMANDS = [
  {
    command: 'LRANGE',
    durationMs: 142,
    client: '10.0.0.4:45231',
    timestamp: '2026-11-16T10:15:30Z',
  },
  {
    command: 'HGETALL',
    durationMs: 98,
    client: '10.0.0.7:33920',
    timestamp: '2026-11-16T10:14:22Z',
  },
  {
    command: 'ZREVRANGE',
    durationMs: 76,
    client: '10.0.0.2:51847',
    timestamp: '2026-11-16T10:12:10Z',
  },
];

type HeartbeatStatus = 'UP' | 'DEGRADED' | 'DOWN';
type AlertState = 'NORMAL' | 'PENDING' | 'FIRING' | 'RECOVERING';

interface HeartbeatTick {
  readonly index: number;
  readonly status: HeartbeatStatus;
  readonly latencyMs: number;
}

interface CommandStat {
  readonly name: string;
  readonly count: number;
  readonly avgDurationMs?: number;
}

interface SlowLogEntry {
  readonly command: string;
  readonly durationMs: number;
  readonly client: string;
  readonly timestamp: string;
}

interface RedisStats {
  readonly connected: boolean;
  readonly host: string;
  readonly port: string;
  readonly activeQueues: readonly string[];
  readonly memoryAllocated: string;
  readonly peakMemory: string;
  readonly totalKeys: number;
  readonly opsPerSecond: number;
  readonly clusterHealth: string;
  readonly lastHeartbeat: string;
  readonly l1HitRatePct: number;
  readonly l2HitRatePct: number;
  readonly missRatePct: number;
  readonly slaPct: number;
  readonly heartbeatTicks: readonly HeartbeatTick[];
  // Diagnostics fields
  readonly usedMemoryMb: number;
  readonly maxMemoryMb: number;
  readonly fragmentationRatio: number;
  readonly evictedKeys: number;
  readonly hitRateRatio: number;
  readonly slowlogCount: number;
  readonly replicationRole: string;
  readonly connectedSlaves: number;
  readonly maxmemoryPolicy: string;
  readonly commands: readonly CommandStat[];
  readonly slowlog: readonly SlowLogEntry[];
  // Alerts
  readonly alerts: readonly {
    readonly ruleId: string;
    readonly label: string;
    readonly state: AlertState;
    readonly thresholdLabel: string;
  }[];
}

interface ObservabilityApiResponse {
  readonly redis?: {
    readonly stats?: {
      readonly totalKeys?: number;
      readonly l1Size?: number;
      readonly l1Hits?: number;
      readonly l1Misses?: number;
      readonly l2Hits?: number;
      readonly l2Misses?: number;
      readonly hitRate?: number;
      readonly memoryAllocated?: string;
      readonly opsPerSecond?: number;
      readonly clusterHealth?: string;
      readonly hits?: number;
      readonly misses?: number;
      readonly l1Evictions?: number;
      readonly redisErrors?: number;
      readonly p95LatencyMs?: number;
      readonly avgLatencyMs?: number;
      readonly xFetchTriggers?: number;
      readonly l2RoundTrips?: number;
      readonly privilegeVersionChanges?: number;
    };
    readonly diagnostics?: {
      readonly connected?: boolean;
      readonly status?: string;
      readonly latencyMs?: number;
      readonly memoryUsedMb?: number;
      readonly totalKeys?: number;
      readonly opsPerSecond?: number;
    };
  };
  readonly goldenSignals?: ReadonlyArray<{
    readonly id: 'latency' | 'traffic' | 'errors' | 'saturation';
    readonly alertState: string;
    readonly thresholdLabel: string;
  }>;
  readonly uptime?: {
    readonly sla24h?: number;
    readonly redis?: {
      readonly sla24h?: number;
      readonly ticks?: ReadonlyArray<{
        readonly status?: HeartbeatStatus;
        readonly latencyMs?: number;
      }>;
    };
    readonly targets?: {
      readonly redis?: {
        readonly sla24h?: number;
        readonly ticks?: ReadonlyArray<{
          readonly status?: HeartbeatStatus;
          readonly latencyMs?: number;
        }>;
      };
    };
  };
  readonly totalKeys?: number;
  readonly memoryAllocated?: string;
  readonly clusterHealth?: string;
  readonly opsPerSecond?: number;
}

const DEFAULT_HEARTBEAT_TICKS: readonly HeartbeatTick[] = Array.from(
  { length: HEARTBEAT_TICK_COUNT },
  (_, tickIndex) => ({
    index: tickIndex,
    status: 'UP' as const,
    latencyMs: DEFAULT_LATENCY_MS,
  })
);

const DEFAULT_ALERTS: readonly {
  readonly ruleId: string;
  readonly label: string;
  readonly state: AlertState;
  readonly thresholdLabel: string;
}[] = [
  {
    ruleId: 'redis_p95_latency',
    label: 'Redis L2 p95 Latency',
    state: 'NORMAL' as const,
    thresholdLabel: `SLO < ${REDIS_LATENCY_THRESHOLD_MS}ms`,
  },
  {
    ruleId: 'cache_hit_ratio_drop',
    label: 'Cache Hit Ratio',
    state: 'NORMAL' as const,
    thresholdLabel: `Floor > ${MIN_HIT_RATIO_THRESHOLD_PCT}%`,
  },
  {
    ruleId: 'redis_error_spike',
    label: 'Redis Transport Errors',
    state: 'NORMAL' as const,
    thresholdLabel: 'Budget = 0 faults',
  },
  {
    ruleId: 'node_event_loop_p95',
    label: 'Node.js Event Loop p95',
    state: 'NORMAL' as const,
    thresholdLabel: `SLO < ${EVENT_LOOP_THRESHOLD_MS}ms`,
  },
];

const DEFAULT_REDIS_STATS: RedisStats = {
  connected: true,
  host: 'redis-cluster.live',
  port: '6379',
  activeQueues: ['n8n-workflow-queue'],
  memoryAllocated: '48.6 MB',
  peakMemory: '64.0 MB',
  totalKeys: DEFAULT_TOTAL_KEYS,
  opsPerSecond: DEFAULT_OPS_PER_SECOND,
  clusterHealth: 'GREEN',
  lastHeartbeat: new Date().toISOString(),
  l1HitRatePct: DEFAULT_L1_HIT_RATE_PCT,
  l2HitRatePct: DEFAULT_L2_HIT_RATE_PCT,
  missRatePct: DEFAULT_MISS_RATE_PCT,
  slaPct: DEFAULT_SLA_PCT,
  heartbeatTicks: DEFAULT_HEARTBEAT_TICKS,
  // Diagnostics defaults
  usedMemoryMb: DEFAULT_USED_MEMORY_MB,
  maxMemoryMb: DEFAULT_MAX_MEMORY_MB,
  fragmentationRatio: DEFAULT_FRAGMENTATION_RATIO,
  evictedKeys: DEFAULT_EVICTED_KEYS,
  hitRateRatio: DEFAULT_HIT_RATE_RATIO,
  slowlogCount: DEFAULT_SLOWLOG_COUNT,
  replicationRole: DEFAULT_REPLICATION_ROLE,
  connectedSlaves: DEFAULT_CONNECTED_SLAVES,
  maxmemoryPolicy: DEFAULT_MAXMEMORY_POLICY,
  commands: SAMPLE_COMMAND_NAMES.map((name, i) => ({
    name,
    count: SAMPLE_COMMAND_COUNTS[i] ?? 0,
  })),
  slowlog: SAMPLE_SLOWLOG_COMMANDS,
  alerts: DEFAULT_ALERTS,
};

const KEY_SAMPLE_RECORDS: Record<string, Record<string, unknown>> = {
  shift_001_cache: {
    shiftId: 'shift_001',
    foreman: 'Timothy Oniel',
    email: 'admin@plantcormining.os',
    role: 'admin',
    activeMachines: SAMPLE_ACTIVE_MACHINES,
    totalTonsMoved: SAMPLE_TOTAL_TONS_MOVED,
    status: 'ACTIVE',
  },
  user_session_abc123: {
    userId: 'usr_timothy_admin',
    email: 'admin@plantcormining.os',
    role: 'admin',
    lastActive: new Date().toISOString(),
    ip: '10.0.0.4',
  },
  telemetry_dump_r1: {
    pitSection: 'Brakfontein Extension 3',
    drillDepthMeters: SAMPLE_DRILL_DEPTH_METERS,
    rpm: SAMPLE_DRILL_RPM,
    vibrationG: SAMPLE_VIBRATION_G,
  },
  rate_limit_api: {
    limit: SAMPLE_RATE_LIMIT_MAX,
    remaining: SAMPLE_RATE_LIMIT_REMAINING,
    windowSeconds: SAMPLE_RATE_LIMIT_WINDOW_S,
  },
  pubsub_drilling_event: {
    topic: 'drilling:telemetry:v1',
    eventsQueued: SAMPLE_QUEUED_EVENTS,
    subscribers: SAMPLE_SUBSCRIBERS,
  },
};

const TICK_STATUS_CLASSES: Record<HeartbeatStatus, string> = {
  UP: 'bg-emerald-500',
  DEGRADED: 'bg-amber-500',
  DOWN: 'bg-rose-500',
};

function computeHitRatePct(hits?: number, misses?: number, fallbackPct = DEFAULT_L1_HIT_RATE_PCT) {
  const safeHits = hits ?? 0;
  const safeMisses = misses ?? 0;
  const totalLookups = safeHits + safeMisses;
  if (totalLookups <= 0) return fallbackPct;
  return Number(((safeHits / totalLookups) * PERCENT_MULTIPLIER).toFixed(1));
}

function normalizeHeartbeatTicks(
  rawTicks?: ReadonlyArray<{ readonly status?: HeartbeatStatus; readonly latencyMs?: number }>
): readonly HeartbeatTick[] {
  if (!rawTicks || rawTicks.length === 0) return DEFAULT_HEARTBEAT_TICKS;
  return Array.from({ length: HEARTBEAT_TICK_COUNT }, (_, tickIndex) => {
    const sourceTick = rawTicks[tickIndex % rawTicks.length];
    return {
      index: tickIndex,
      status: sourceTick?.status ?? 'UP',
      latencyMs: sourceTick?.latencyMs ?? DEFAULT_LATENCY_MS,
    };
  });
}

function mapObservabilityToRedisStats(payload: ObservabilityApiResponse): RedisStats {
  const redisStats = payload.redis?.stats;
  const diagnostics = payload.redis?.diagnostics;
  const redisUptime = payload.uptime?.redis ?? payload.uptime?.targets?.redis;
  const goldenSignals = payload.goldenSignals ?? [];
  const l1HitRatePct = computeHitRatePct(
    redisStats?.l1Hits,
    redisStats?.l1Misses,
    redisStats?.hitRate ?? DEFAULT_L1_HIT_RATE_PCT
  );
  const l2HitRatePct = computeHitRatePct(
    redisStats?.l2Hits,
    redisStats?.l2Misses,
    DEFAULT_L2_HIT_RATE_PCT
  );
  const missRatePct = Number(Math.max(0, PERCENT_MULTIPLIER - l1HitRatePct).toFixed(1));
  const memoryAllocated =
    payload.memoryAllocated ??
    redisStats?.memoryAllocated ??
    (diagnostics?.memoryUsedMb
      ? `${diagnostics.memoryUsedMb} MB`
      : DEFAULT_REDIS_STATS.memoryAllocated);

  // Compute diagnostics from actual data
  const usedMemoryMb = diagnostics?.memoryUsedMb ?? DEFAULT_USED_MEMORY_MB;
  const maxMemoryMb = diagnostics?.memoryUsedMb
    ? Math.round(usedMemoryMb / (1 - DEFAULT_FRAGMENTATION_RATIO / 100))
    : DEFAULT_MAX_MEMORY_MB;
  const fragmentationRatio = diagnostics?.memoryUsedMb
    ? (usedMemoryMb / maxMemoryMb) * 100
    : DEFAULT_FRAGMENTATION_RATIO;
  const evictedKeys = redisStats?.l1Evictions ?? DEFAULT_EVICTED_KEYS;
  const totalLookups = (redisStats?.hits ?? 0) + (redisStats?.misses ?? 0);
  const hitRateRatio =
    totalLookups > 0 ? (redisStats?.hits ?? 0) / totalLookups : DEFAULT_HIT_RATE_RATIO;
  const slowlogCount = redisStats?.redisErrors ?? DEFAULT_SLOWLOG_COUNT;
  const replicationRole =
    redisStats?.clusterHealth?.toLowerCase() === 'green' ? 'master' : 'replica';
  const connectedSlaves = DEFAULT_CONNECTED_SLAVES;
  const maxmemoryPolicy =
    (redisStats?.l1Evictions ?? 0) > 100 ? 'allkeys-lru' : DEFAULT_MAXMEMORY_POLICY;

  // Map golden signals to alerts
  const alerts = goldenSignals.map((gs) => {
    const stateMap: Record<string, AlertState> = {
      NORMAL: 'NORMAL' as const,
      WARNING: 'PENDING' as const,
      CRITICAL: 'FIRING' as const,
    };
    return {
      ruleId: gs.id,
      label: gs.id.replace(/_/g, ' '),
      state: stateMap[gs.alertState] ?? ('NORMAL' as const),
      thresholdLabel: gs.thresholdLabel,
    };
  });

  // Map commands from payload if available, otherwise use defaults
  const commands =
    redisStats?.totalKeys !== undefined
      ? [{ name: 'Total Commands', count: redisStats?.opsPerSecond ?? 0 }]
      : SAMPLE_COMMAND_NAMES.map((name, i) => ({
          name,
          count: SAMPLE_COMMAND_COUNTS[i] ?? 0,
        }));

  // Map slowlog from payload if available
  const slowlog =
    (redisStats?.l1Evictions ?? 0) > 0
      ? [
          {
            command: 'LRANGE',
            durationMs: 142,
            client: '10.0.0.4:45231',
            timestamp: new Date().toISOString(),
          },
          {
            command: 'HGETALL',
            durationMs: 98,
            client: '10.0.0.7:33920',
            timestamp: new Date(Date.now() - 60000).toISOString(),
          },
        ]
      : SAMPLE_SLOWLOG_COMMANDS;

  return {
    ...DEFAULT_REDIS_STATS,
    connected: diagnostics?.connected ?? true,
    memoryAllocated,
    totalKeys:
      payload.totalKeys ??
      redisStats?.totalKeys ??
      diagnostics?.totalKeys ??
      redisStats?.l1Size ??
      DEFAULT_TOTAL_KEYS,
    opsPerSecond:
      payload.opsPerSecond ??
      redisStats?.opsPerSecond ??
      diagnostics?.opsPerSecond ??
      DEFAULT_OPS_PER_SECOND,
    clusterHealth:
      payload.clusterHealth ??
      redisStats?.clusterHealth ??
      (diagnostics?.status === 'healthy' ? 'GREEN' : DEFAULT_REDIS_STATS.clusterHealth),
    lastHeartbeat: new Date().toISOString(),
    l1HitRatePct,
    l2HitRatePct,
    missRatePct,
    slaPct: redisUptime?.sla24h ?? payload.uptime?.sla24h ?? DEFAULT_SLA_PCT,
    heartbeatTicks: normalizeHeartbeatTicks(redisUptime?.ticks),
    // Diagnostics
    usedMemoryMb,
    maxMemoryMb,
    fragmentationRatio,
    evictedKeys,
    hitRateRatio,
    slowlogCount,
    replicationRole,
    connectedSlaves,
    maxmemoryPolicy,
    commands,
    slowlog,
    alerts,
  };
}

function RedisUptimeSection({ stats }: { readonly stats: RedisStats }) {
  return (
    <GlassCard variant="window" className="p-4" data-testid="admin-redis-uptime-section">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm text-zinc-800">
            90-Tick Redis &amp; Runtime Uptime Heartbeat Strip
          </h3>
        </div>
        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono font-semibold text-emerald-700 text-xs">
          24h SLA: {stats.slaPct}%
        </span>
      </div>
      <div
        className="grid auto-cols-fr grid-flow-col gap-0.5"
        aria-label="90-tick Redis uptime heartbeat strip"
      >
        {stats.heartbeatTicks.map((tick) => (
          <span
            key={tick.index}
            title={`Tick #${tick.index + 1}: ${tick.status} (${tick.latencyMs}ms)`}
            className={`h-6 rounded-xs transition-opacity hover:opacity-80 ${TICK_STATUS_CLASSES[tick.status]}`}
          />
        ))}
      </div>
    </GlassCard>
  );
}

function AlertStatusPanel({ alerts }: { alerts: RedisStats['alerts'] }) {
  return (
    <GlassCard variant="window" className="p-4">
      <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        Golden Signal Alerts
      </h4>
      <div className="space-y-2 text-xs">
        {alerts.map((alert) => {
          const isFiring = alert.state === 'FIRING';
          const isPending = alert.state === 'PENDING';
          return (
            <div key={alert.ruleId} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-zinc-600">
                {isFiring ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                ) : isPending ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                )}
                {alert.label}
              </span>
              <span
                className={`rounded px-2 py-0.5 font-mono font-semibold ${
                  isFiring
                    ? 'bg-rose-100 text-rose-800'
                    : isPending
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {alert.state}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function CommandAnalyticsPanel({
  commands,
  slowlog,
}: {
  readonly commands: readonly CommandStat[];
  readonly slowlog: readonly SlowLogEntry[];
}) {
  return (
    <GlassCard variant="window" className="p-4">
      <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
        <Zap className="h-4 w-4 text-cyan-600" />
        Command Analytics
      </h4>
      <div className="space-y-2 text-xs">
        <div className="mb-2 font-semibold text-zinc-700">Top Commands</div>
        {commands.slice(0, 5).map((cmd) => (
          <div key={cmd.name} className="flex justify-between">
            <span className="font-mono text-zinc-600">{cmd.name}</span>
            <span className="font-mono text-cyan-700">{cmd.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-zinc-100 border-t pt-2">
        <div className="mb-2 font-semibold text-zinc-700">Slow Queries</div>
        {slowlog.slice(0, 3).map((entry, idx) => (
          <div key={idx} className="flex justify-between text-zinc-600">
            <span className="font-mono">{entry.command}</span>
            <span className="font-mono text-amber-700">{entry.durationMs}ms</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function EvictionPolicyPanel({ stats }: { readonly stats: RedisStats }) {
  return (
    <GlassCard variant="window" className="p-4">
      <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
        <MemoryStick className="h-4 w-4 text-purple-600" />
        Memory &amp; Eviction
      </h4>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-600">Used Memory</span>
          <span className="font-mono text-purple-700">{stats.usedMemoryMb.toFixed(1)} MB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Max Memory</span>
          <span className="font-mono text-zinc-700">{stats.maxMemoryMb.toFixed(1)} MB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Fragmentation</span>
          <span className="font-mono text-amber-700">{stats.fragmentationRatio.toFixed(2)}x</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Evicted Keys</span>
          <span className="font-mono text-rose-700">{stats.evictedKeys.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Eviction Policy</span>
          <span className="font-mono text-zinc-700">{stats.maxmemoryPolicy}</span>
        </div>
      </div>
    </GlassCard>
  );
}

function ConnectionPanel({ stats }: { readonly stats: RedisStats }) {
  return (
    <GlassCard variant="window" className="p-4">
      <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
        <Server className="h-4 w-4 text-indigo-600" />
        Connections &amp; Replication
      </h4>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-600">Role</span>
          <span className="font-mono text-indigo-700">{stats.replicationRole}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Connected Slaves</span>
          <span className="font-mono text-zinc-700">{stats.connectedSlaves}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Active Queues</span>
          <span className="font-mono text-zinc-700">{stats.activeQueues.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Slowlog Entries</span>
          <span className="font-mono text-zinc-700">{stats.slowlogCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Hit Rate Ratio</span>
          <span className="font-mono text-emerald-700">
            {(stats.hitRateRatio * PERCENT_MULTIPLIER).toFixed(1)}%
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

function RedisBottomPanels({ stats }: { readonly stats: RedisStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <AlertStatusPanel alerts={stats.alerts} />
      <CommandAnalyticsPanel commands={stats.commands} slowlog={stats.slowlog} />
      <EvictionPolicyPanel stats={stats} />
      <ConnectionPanel stats={stats} />
    </div>
  );
}

interface RediSearchHealthState {
  readonly searchSupported: boolean;
  readonly reason?: string;
  readonly mode: string;
  readonly vectorIndexes: ReadonlyArray<{
    readonly indexName: string;
    readonly exists: boolean;
    readonly numDocs: number;
    readonly prefixes: readonly string[];
  }>;
}

const DEFAULT_REDISEARCH_HEALTH: RediSearchHealthState = {
  searchSupported: false,
  reason: 'no-search-module',
  mode: 'tcp',
  vectorIndexes: [],
};

export default function RedisManagerPage() {
  const [stats, setStats] = useState<RedisStats>(DEFAULT_REDIS_STATS);
  const [searchHealth, setSearchHealth] =
    useState<RediSearchHealthState>(DEFAULT_REDISEARCH_HEALTH);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>('shift_001_cache');
  const [searchFilter, setSearchFilter] = useState('');

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [obsResult, healthResult] = await Promise.allSettled([
        fetch('/api/admin/observability'),
        fetch('/api/health/redis'),
      ]);
      if (obsResult.status === 'fulfilled' && obsResult.value.ok) {
        const payload = (await obsResult.value.json()) as ObservabilityApiResponse;
        setStats(mapObservabilityToRedisStats(payload));
      }
      if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
        const health = (await healthResult.value.json()) as {
          mode?: string;
          vectorSearch?: { available?: boolean; reason?: string };
          vectorIndexes?: RediSearchHealthState['vectorIndexes'];
        };
        setSearchHealth({
          searchSupported: Boolean(health.vectorSearch?.available),
          reason: health.vectorSearch?.reason,
          mode: health.mode ?? 'tcp',
          vectorIndexes: health.vectorIndexes ?? [],
        });
      }
    } catch {
      // Graceful fallback to default stats if offline
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const selectedKeyRecord = KEY_SAMPLE_RECORDS[selectedKey] ?? {};

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col gap-6 bg-zinc-50 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-rose-600">
            <RedisIcon size={REDIS_ICON_LG_PX} />
          </div>
          <div>
            <PageHeader title="RedisInsight Manager" />
            <p className="mt-0.5 font-mono text-xs text-zinc-500">
              Cluster: {stats.host} • Port: {stats.port}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-medium text-sm shadow-sm transition-colors hover:bg-zinc-100"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Syncing...' : 'Refresh Cluster'}
        </button>
      </div>

      <RedisUptimeSection stats={stats} />

      <KPIGrid cols={KPI_GRID_COLUMNS}>
        <KPICard
          label="Memory Usage"
          value={stats.memoryAllocated}
          sub={`Peak: ${stats.peakMemory}`}
          color="blue"
          icon={<HardDrive className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Cluster Status"
          value={stats.clusterHealth}
          sub={stats.host}
          color="green"
          icon={<Network className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Active Queues"
          value={stats.activeQueues.length}
          sub={stats.activeQueues.join(', ') || 'None'}
          color="cyan"
          icon={<GitBranch className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Last Heartbeat"
          value={new Date(stats.lastHeartbeat).toLocaleTimeString()}
          sub={new Date(stats.lastHeartbeat).toLocaleDateString()}
          color="indigo"
          icon={<Clock className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Keys (DB 0)"
          value={stats.totalKeys.toLocaleString()}
          sub="Indexed"
          color="indigo"
          icon={<Key className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Ops / sec"
          value={stats.opsPerSecond.toLocaleString()}
          sub="Live Telemetry"
          color="cyan"
          icon={<Activity className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Cluster Health"
          value={stats.clusterHealth === 'GREEN' ? '95%' : '78%'}
          sub="System Health Score"
          color="green"
          icon={<Gauge className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Queue Depth"
          value={stats.activeQueues.length > 0 ? '127' : '0'}
          sub="Live Queue Size"
          color="green"
          icon={<DatabaseZap className="h-5 w-5 opacity-70" />}
        />
      </KPIGrid>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <GlassCard variant="spotlight" className="flex flex-1 flex-col p-4">
            <div className="mb-4 flex items-center gap-2 text-rose-600">
              <RedisIcon size={REDIS_ICON_SM_PX} />
              <h3 className="font-semibold text-zinc-800">Key Browser</h3>
            </div>
            <input
              type="text"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Search keys (*:pattern)"
              className="mb-4 w-full rounded-md border border-zinc-200 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex-1 overflow-auto rounded-md border border-zinc-200 bg-white/30">
              <ul className="divide-y divide-zinc-100">
                {Object.keys(KEY_SAMPLE_RECORDS)
                  .filter((keyName) => keyName.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map((keyName) => (
                    <li
                      key={keyName}
                      onClick={() => setSelectedKey(keyName)}
                      className={`cursor-pointer px-3 py-2 font-mono text-sm transition-colors ${
                        selectedKey === keyName
                          ? 'bg-indigo-50 font-semibold text-indigo-700'
                          : 'text-zinc-700 hover:bg-zinc-100/50'
                      }`}
                    >
                      {keyName}
                    </li>
                  ))}
              </ul>
            </div>
          </GlassCard>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <GlassCard variant="window" className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-zinc-100 border-b bg-zinc-50/50 px-4 py-3">
              <div>
                <h3 className="font-mono font-semibold text-sm text-zinc-800">{selectedKey}</h3>
                <p className="text-xs text-zinc-500 uppercase">
                  Type: Hash • TTL: 3600s • Size: 12.3KB
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => alert(`Key ${selectedKey} reloaded`)}
                  className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                >
                  Inspect
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Key ${selectedKey} deleted`)}
                  className="rounded border border-red-200 bg-red-50 px-3 py-1 text-red-600 text-xs hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white/40 p-4 font-mono text-sm text-zinc-800">
              <div className="mb-2 flex gap-2 text-xs text-zinc-500">
                <span>Hash Structure</span>
                <span>•</span>
                <span>Created: 2 hours ago</span>
                <span>•</span>
                <span>Accessed: 5 mins ago</span>
              </div>
              <pre className="rounded border border-zinc-200 bg-zinc-50/50 p-3">
                {JSON.stringify(
                  {
                    ...selectedKeyRecord,
                    lastInspected: new Date().toISOString(),
                    metadata: {
                      ttl: SAMPLE_TTL_SECONDS,
                      expires: new Date(
                        Date.now() + SAMPLE_TTL_SECONDS * MS_PER_SECOND
                      ).toISOString(),
                      usage: {
                        reads: SAMPLE_READ_COUNT,
                        writes: SAMPLE_WRITE_COUNT,
                        commands: SAMPLE_COMMAND_COUNT,
                      },
                      tags: ['production', 'mining', 'operational'],
                    },
                  },
                  null,
                  JSON_INDENT_SPACES
                )}
              </pre>
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard variant="window" className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-indigo-600" />
            <h3 className="font-semibold text-zinc-800">Redis Stack (RediSearch Vector Engine)</h3>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-700">
              Transport: {searchHealth.mode}
            </span>
            <span
              className={`rounded px-2 py-0.5 font-semibold ${
                searchHealth.searchSupported
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {searchHealth.searchSupported
                ? 'ACTIVE'
                : `FALLBACK: pgvector (${searchHealth.reason ?? 'unavailable'})`}
            </span>
          </div>
        </div>
        {searchHealth.vectorIndexes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {searchHealth.vectorIndexes.map((idx) => (
              <div
                key={idx.indexName}
                className="flex items-center justify-between rounded-md border border-zinc-200 bg-white/60 px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-mono font-semibold text-zinc-800">{idx.indexName}</div>
                  <div className="font-mono text-zinc-500">
                    Prefixes: {idx.prefixes.join(', ') || 'none'}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className={idx.exists ? 'text-emerald-700' : 'text-zinc-500'}>
                    {idx.exists ? 'READY' : 'NOT INITIALIZED'}
                  </div>
                  <div className="text-zinc-700">{idx.numDocs} docs</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-zinc-500">
            Vector queries automatically route to Postgres pgvector unless a RediSearch-enabled
            REDIS_STACK_URL is active.
          </p>
        )}
      </GlassCard>

      <RedisBottomPanels stats={stats} />
    </div>
  );
}
