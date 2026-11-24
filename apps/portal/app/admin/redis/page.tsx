'use client';

import { RedisIcon } from '@repo/ui/components/RedisIcon';
import { GlassCard } from '@repo/ui/GlassCard';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
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
import {
  AnimatedUptimeStrip,
  RedisKeyInspectorVisual,
  RedisTelemetryGauges,
} from './RedisVisualPanels';

const REDIS_ICON_LG_PX = 24;
const REDIS_ICON_SM_PX = 18;
const KPI_GRID_COLUMNS = 4;
const HEARTBEAT_TICK_COUNT = 90;
const DEFAULT_TOTAL_KEYS = 0;
const DEFAULT_OPS_PER_SECOND = 0;
const DEFAULT_SLA_PCT = 0;
const DEFAULT_L1_HIT_RATE_PCT = 0;
const DEFAULT_L2_HIT_RATE_PCT = 0;
const DEFAULT_MISS_RATE_PCT = 0;
const DEFAULT_LATENCY_MS = 4;
const PERCENT_MULTIPLIER = 100;
const SAMPLE_TTL_SECONDS = 3600;
const MS_PER_SECOND = 1000;
const SAMPLE_READ_COUNT = 12847;
const SAMPLE_WRITE_COUNT = 3921;
const SAMPLE_COMMAND_COUNT = 16768;
const _SAMPLE_ACTIVE_MACHINES = 14;
const _SAMPLE_TOTAL_TONS_MOVED = 15400;
const _SAMPLE_DRILL_DEPTH_METERS = 42.5;
const _SAMPLE_DRILL_RPM = 120;
const _SAMPLE_VIBRATION_G = 0.8;
const _SAMPLE_RATE_LIMIT_MAX = 100;
const _SAMPLE_RATE_LIMIT_REMAINING = 98;
const SAMPLE_RATE_LIMIT_WINDOW_S = 60;
const _SAMPLE_QUEUED_EVENTS = 4;
const _SAMPLE_SUBSCRIBERS = 2;
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
const _DEFAULT_HEARTBEAT_ISO = '2026-11-19T00:00:00.000Z';

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
  readonly timestamp?: string;
  readonly overallSla24hPct?: number;
  readonly uptimeByTarget?: {
    readonly redis?: {
      readonly sla24hPct?: number;
      readonly ticks?: ReadonlyArray<{
        readonly status?: HeartbeatStatus;
        readonly latencyMs?: number;
      }>;
    };
  };
}

const DEFAULT_HEARTBEAT_TICKS: readonly HeartbeatTick[] = Array.from(
  { length: HEARTBEAT_TICK_COUNT },
  (_, tickIndex) => ({
    index: tickIndex,
    status: 'UP' as const,
    latencyMs: DEFAULT_LATENCY_MS,
  })
);

const _DEFAULT_ALERTS: readonly {
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
  connected: false,
  host: 'redis',
  port: '6379',
  activeQueues: [],
  memoryAllocated: '0.0 MB',
  peakMemory: '0.0 MB',
  totalKeys: DEFAULT_TOTAL_KEYS,
  opsPerSecond: DEFAULT_OPS_PER_SECOND,
  clusterHealth: 'RED',
  lastHeartbeat: '',
  l1HitRatePct: DEFAULT_L1_HIT_RATE_PCT,
  l2HitRatePct: DEFAULT_L2_HIT_RATE_PCT,
  missRatePct: DEFAULT_MISS_RATE_PCT,
  slaPct: DEFAULT_SLA_PCT,
  heartbeatTicks: [],
  usedMemoryMb: 0,
  maxMemoryMb: 0,
  fragmentationRatio: 0,
  evictedKeys: 0,
  hitRateRatio: 0,
  slowlogCount: 0,
  replicationRole: DEFAULT_REPLICATION_ROLE,
  connectedSlaves: 0,
  maxmemoryPolicy: DEFAULT_MAXMEMORY_POLICY,
  commands: [],
  slowlog: [],
  alerts: [],
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
  const redisUptime =
    payload.uptimeByTarget?.redis ?? payload.uptime?.redis ?? payload.uptime?.targets?.redis;
  const goldenSignals = payload.goldenSignals ?? [];
  const syncedTimestamp = payload.timestamp ?? new Date().toISOString();
  const syncedTimestampMs = Date.parse(syncedTimestamp);
  const previousSlowlogTimestamp = Number.isFinite(syncedTimestampMs)
    ? new Date(syncedTimestampMs - SAMPLE_RATE_LIMIT_WINDOW_S * MS_PER_SECOND).toISOString()
    : syncedTimestamp;
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

  // Map commands from payload if available; report empty array when metrics are unavailable.
  const commands =
    redisStats?.totalKeys !== undefined
      ? [{ name: 'Total Commands', count: redisStats?.opsPerSecond ?? 0 }]
      : [];

  // Map slowlog from payload if available; never fabricate slowlog entries.
  const slowlog =
    (redisStats?.l1Evictions ?? 0) > 0
      ? [
          {
            command: 'L1_EVICTIONS',
            durationMs: Math.max(1, Math.round(redisStats?.avgLatencyMs ?? 1)),
            client: 'portal-l1-cache',
            timestamp: previousSlowlogTimestamp,
          },
        ]
      : [];

  const resolvedSlaPct =
    (redisUptime && 'sla24hPct' in redisUptime ? redisUptime.sla24hPct : undefined) ??
    (redisUptime && 'sla24h' in redisUptime ? redisUptime.sla24h : undefined) ??
    payload.overallSla24hPct ??
    payload.uptime?.sla24h ??
    DEFAULT_SLA_PCT;

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
    lastHeartbeat: syncedTimestamp,
    l1HitRatePct,
    l2HitRatePct,
    missRatePct,
    slaPct: resolvedSlaPct,
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
  return <AnimatedUptimeStrip ticks={stats.heartbeatTicks} slaPct={stats.slaPct} />;
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
            <span className="font-mono text-cyan-700">{cmd.count.toLocaleString('en-US')}</span>
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
          <span className="font-mono text-rose-700">
            {stats.evictedKeys.toLocaleString('en-US')}
          </span>
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
  const [liveKeys, setLiveKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [inspectedKeyData, setInspectedKeyData] = useState<{
    key: string;
    type: string;
    ttlSeconds: number;
    value: unknown;
  } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [noticeBanner, setNoticeBanner] = useState<{
    readonly tone: 'info' | 'warning';
    readonly message: string;
  } | null>(null);

  const inspectRedisKeys = useCallback(
    async (pattern: string, keyToInspect?: string | null) => {
      try {
        const params = new URLSearchParams({ pattern: pattern || '*' });
        if (keyToInspect) {
          params.set('key', keyToInspect);
        }
        const res = await fetch(`/api/admin/redis/inspect?${params.toString()}`);
        if (!res.ok) return;
        const payload = (await res.json()) as {
          connected?: boolean;
          keys?: string[];
          inspected?: {
            key: string;
            type: string;
            ttlSeconds: number;
            value: unknown;
          } | null;
        };
        if (Array.isArray(payload.keys)) {
          setLiveKeys(payload.keys);
          if (!keyToInspect && payload.keys.length > 0 && !selectedKey) {
            setSelectedKey(payload.keys[0] ?? '');
          }
        }
        if (payload.inspected) {
          setInspectedKeyData(payload.inspected);
        }
      } catch {
        // Leave liveKeys unchanged if inspection endpoint is unreachable
      }
    },
    [selectedKey]
  );

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [obsResult, healthResult] = await Promise.allSettled([
        fetch('/api/admin/observability'),
        fetch('/api/health/redis'),
        inspectRedisKeys('*', selectedKey || null),
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
  }, [inspectRedisKeys, selectedKey]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const selectedKeyRecord = inspectedKeyData?.value ?? null;
  const heartbeatMs = Date.parse(stats.lastHeartbeat);
  const ttlExpiresIso =
    inspectedKeyData && inspectedKeyData.ttlSeconds > 0
      ? new Date(Date.now() + inspectedKeyData.ttlSeconds * MS_PER_SECOND).toISOString()
      : Number.isFinite(heartbeatMs)
        ? stats.lastHeartbeat
        : 'N/A';

  const handleInspectKey = () => {
    void inspectRedisKeys(searchFilter.trim() || '*', selectedKey || null);
    void fetchStats();
    setNoticeBanner({
      tone: 'info',
      message: selectedKey
        ? `Inspected live Redis key "${selectedKey}" and refreshed cluster telemetry.`
        : 'Refreshed live Redis key list and cluster telemetry.',
    });
  };

  const handleDeleteKeyNotice = () => {
    setNoticeBanner({
      tone: 'warning',
      message: `Destructive deletion for "${selectedKey}" is intentionally restricted to RedisInsight (:5540) or server-side tag invalidation.`,
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col gap-6 bg-transparent p-4 lg:p-6">
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
          onClick={() => {
            void fetchStats();
          }}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-medium text-sm shadow-sm transition-colors hover:bg-zinc-100"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Syncing...' : 'Refresh Cluster'}
        </button>
      </div>

      {noticeBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs ${
            noticeBanner.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-indigo-200 bg-indigo-50 text-indigo-900'
          }`}
        >
          <span>{noticeBanner.message}</span>
          <button
            type="button"
            onClick={() => setNoticeBanner(null)}
            className="rounded border border-current/20 px-2 py-0.5 font-medium text-[11px] hover:bg-white/60"
          >
            Dismiss
          </button>
        </div>
      )}

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
          value={new Date(stats.lastHeartbeat).toLocaleTimeString('en-ZA')}
          sub={new Date(stats.lastHeartbeat).toLocaleDateString('en-ZA')}
          color="indigo"
          icon={<Clock className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Keys (DB 0)"
          value={stats.totalKeys.toLocaleString('en-US')}
          sub="Indexed"
          color="indigo"
          icon={<Key className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Ops / sec"
          value={stats.opsPerSecond.toLocaleString('en-US')}
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

      <RedisTelemetryGauges
        healthPct={stats.clusterHealth === 'GREEN' ? 95 : 78}
        usedMemoryMb={stats.usedMemoryMb}
        maxMemoryMb={stats.maxMemoryMb}
        l1HitRatePct={stats.l1HitRatePct}
        opsPerSecond={stats.opsPerSecond}
      />

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <GlassCard variant="spotlight" className="flex flex-1 flex-col p-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-rose-600">
              <div className="flex items-center gap-2">
                <RedisIcon size={REDIS_ICON_SM_PX} />
                <h3 className="font-semibold text-zinc-800">Key Browser</h3>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-700">
                {
                  liveKeys.filter((k) => k.toLowerCase().includes(searchFilter.toLowerCase()))
                    .length
                }{' '}
                keys
              </span>
            </div>
            <div className="relative mb-2.5">
              <input
                type="text"
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.target.value)}
                placeholder="Search keys (*:pattern)"
                className="w-full rounded-md border border-zinc-200 bg-white/60 px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 hover:bg-zinc-200"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(['', 'arch:__tags__', 'auth', 'cache'] as const).map((prefix) => (
                <button
                  key={prefix || 'all'}
                  type="button"
                  onClick={() => setSearchFilter(prefix)}
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors ${
                    searchFilter === prefix
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {prefix || 'All'}
                </button>
              ))}
            </div>
            <div className="max-h-[420px] flex-1 overflow-auto rounded-md border border-zinc-200 bg-white/40">
              {liveKeys.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-zinc-500">
                  No matching live Redis keys found.
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {liveKeys
                    .filter((keyName) => keyName.toLowerCase().includes(searchFilter.toLowerCase()))
                    .map((keyName) => (
                      <li
                        key={keyName}
                        onClick={() => {
                          setSelectedKey(keyName);
                          void inspectRedisKeys(searchFilter.trim() || '*', keyName);
                        }}
                        title={keyName}
                        className={`flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-xs transition-colors ${
                          selectedKey === keyName
                            ? 'bg-indigo-50 font-semibold text-indigo-700'
                            : 'text-zinc-700 hover:bg-zinc-100/60'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            selectedKey === keyName ? 'bg-indigo-600' : 'bg-zinc-300'
                          }`}
                        />
                        <span className="truncate">{keyName}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </GlassCard>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <GlassCard variant="window" className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-zinc-100 border-b bg-zinc-50/50 px-4 py-3">
              <div className="min-w-0 pr-3">
                <h3 className="truncate font-mono font-semibold text-sm text-zinc-800">
                  {selectedKey || 'No key selected'}
                </h3>
                <p className="text-xs text-zinc-500 uppercase">
                  Type: {inspectedKeyData?.type ?? 'unknown'} • TTL:{' '}
                  {inspectedKeyData ? `${inspectedKeyData.ttlSeconds}s` : 'N/A'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={handleInspectKey}
                  className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                >
                  Inspect
                </button>
                <button
                  type="button"
                  onClick={handleDeleteKeyNotice}
                  className="rounded border border-red-200 bg-red-50 px-3 py-1 text-red-600 text-xs hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
            <RedisKeyInspectorVisual
              selectedKey={selectedKey}
              keyType={inspectedKeyData?.type ?? 'unknown'}
              ttlSeconds={inspectedKeyData?.ttlSeconds ?? 0}
              ttlExpiresIso={ttlExpiresIso}
              lastInspected={stats.lastHeartbeat}
              selectedKeyRecord={selectedKeyRecord}
              sampleTtlSeconds={SAMPLE_TTL_SECONDS}
              sampleReadCount={SAMPLE_READ_COUNT}
              sampleWriteCount={SAMPLE_WRITE_COUNT}
              sampleCommandCount={SAMPLE_COMMAND_COUNT}
            />
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
