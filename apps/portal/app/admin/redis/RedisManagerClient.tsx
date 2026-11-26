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
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlertRuleState } from '@/lib/observability/alert-evaluator';
import {
  AnimatedUptimeStrip,
  RedisKeyInspectorVisual,
  RedisTelemetryGauges,
} from './RedisVisualPanels';

const REDIS_ICON_LG_PX = 24;
const REDIS_ICON_SM_PX = 18;
const KPI_GRID_COLUMNS = 4;
const HEARTBEAT_TICK_COUNT = 90;
const PERCENT_MULTIPLIER = 100;
const MS_PER_SECOND = 1000;
const BYTES_PER_MEGABYTE = 1_048_576;

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
  readonly activeQueues: readonly string[];
  readonly queueDepth: number | null;
  readonly memoryAllocated: string;
  readonly maxMemoryLabel: string;
  readonly totalKeys: number | null;
  readonly opsPerSecond: number | null;
  readonly clusterHealth: string;
  readonly lastHeartbeat: string;
  readonly l1HitRatePct: number | null;
  readonly l2HitRatePct: number | null;
  readonly missRatePct: number | null;
  readonly slaPct: number | null;
  readonly heartbeatTicks: readonly HeartbeatTick[];
  readonly usedMemoryMb: number | null;
  readonly maxMemoryMb: number | null;
  readonly fragmentationRatio: number | null;
  readonly evictedKeys: number | null;
  readonly hitRateRatio: number | null;
  readonly slowlogCount: number | null;
  readonly replicationRole: string | null;
  readonly connectedSlaves: number | null;
  readonly maxmemoryPolicy: string | null;
  readonly commands: readonly CommandStat[];
  readonly slowlog: readonly SlowLogEntry[];
  readonly alerts: readonly {
    readonly ruleId: string;
    readonly label: string;
    readonly state: AlertState;
    readonly thresholdLabel: string;
  }[];
}

interface RedisDiagnosticsPayload {
  readonly usedMemoryBytes?: number | null;
  readonly usedMemoryRssBytes?: number | null;
  readonly usedMemoryDatasetBytes?: number | null;
  readonly memFragmentationRatio?: number | null;
  readonly maxmemoryBytes?: number | null;
  readonly maxmemoryPolicy?: string | null;
  readonly evictedKeysTotal?: number | null;
  readonly keyspaceHitsTotal?: number | null;
  readonly keyspaceMissesTotal?: number | null;
  readonly hitRateRatio?: number | null;
  readonly instantaneousOpsPerSec?: number | null;
  readonly totalKeys?: number | null;
  readonly replicationRole?: string | null;
  readonly connectedSlaves?: number | null;
  readonly masterReplOffset?: number | null;
  readonly slowlogCount?: number | null;
  readonly slowlogEntries?: readonly {
    readonly id: number;
    readonly timestamp: number;
    readonly durationUs: number;
    readonly command: string;
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
    readonly diagnostics?: RedisDiagnosticsPayload | null;
    readonly commands?: readonly CommandStat[];
    readonly slowlog?: readonly SlowLogEntry[];
  };
  readonly goldenSignals?: ReadonlyArray<{
    readonly id: 'latency' | 'traffic' | 'errors' | 'saturation';
    readonly alertState: string;
    readonly thresholdLabel: string;
  }>;
  readonly uptime?: {
    readonly sla24h?: number | null;
    readonly redis?: {
      readonly sla24h?: number | null;
      readonly ticks?: ReadonlyArray<{
        readonly status?: HeartbeatStatus;
        readonly latencyMs?: number;
      }>;
    };
    readonly targets?: {
      readonly redis?: {
        readonly sla24h?: number | null;
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
  readonly overallSla24hPct?: number | null;
  readonly uptimeByTarget?: {
    readonly redis?: {
      readonly sla24hPct?: number | null;
      readonly ticks?: ReadonlyArray<{
        readonly status?: HeartbeatStatus;
        readonly latencyMs?: number;
      }>;
    };
  };
}

const INITIAL_REDIS_STATS: RedisStats = {
  connected: false,
  activeQueues: [],
  queueDepth: null,
  memoryAllocated: 'Not reported',
  maxMemoryLabel: 'Max: Not reported',
  totalKeys: null,
  opsPerSecond: null,
  clusterHealth: 'Not reported',
  lastHeartbeat: '',
  l1HitRatePct: null,
  l2HitRatePct: null,
  missRatePct: null,
  slaPct: null,
  heartbeatTicks: [],
  usedMemoryMb: null,
  maxMemoryMb: null,
  fragmentationRatio: null,
  evictedKeys: null,
  hitRateRatio: null,
  slowlogCount: null,
  replicationRole: null,
  connectedSlaves: null,
  maxmemoryPolicy: null,
  commands: [],
  slowlog: [],
  alerts: [],
};

function computeHitRatePct(hits?: number, misses?: number): number | null {
  const safeHits = hits ?? 0;
  const safeMisses = misses ?? 0;
  const totalLookups = safeHits + safeMisses;
  if (totalLookups <= 0) return null;
  return Number(((safeHits / totalLookups) * PERCENT_MULTIPLIER).toFixed(1));
}

function normalizeHeartbeatTicks(
  rawTicks?: ReadonlyArray<{ readonly status?: HeartbeatStatus; readonly latencyMs?: number }>
): readonly HeartbeatTick[] {
  if (!rawTicks || rawTicks.length === 0) return [];
  return rawTicks.slice(-HEARTBEAT_TICK_COUNT).map((sourceTick, tickIndex) => ({
    index: tickIndex,
    status: sourceTick.status ?? 'UP',
    latencyMs: Math.max(0, sourceTick.latencyMs ?? 0),
  }));
}

function formatHeartbeatDisplay(isoTimestamp: string): { timeLabel: string; dateLabel: string } {
  const parsedMs = Date.parse(isoTimestamp);
  if (!isoTimestamp || Number.isNaN(parsedMs)) {
    return { timeLabel: 'Not reported', dateLabel: 'Awaiting sync' };
  }
  const dateObj = new Date(parsedMs);
  return {
    timeLabel: dateObj.toLocaleTimeString('en-ZA'),
    dateLabel: dateObj.toLocaleDateString('en-ZA'),
  };
}

function mapObservabilityToRedisStats(payload: ObservabilityApiResponse): RedisStats {
  const redisStats = payload.redis?.stats;
  const diagnostics = payload.redis?.diagnostics ?? null;
  const redisUptime =
    payload.uptimeByTarget?.redis ?? payload.uptime?.redis ?? payload.uptime?.targets?.redis;
  const goldenSignals = payload.goldenSignals ?? [];
  const syncedTimestamp = payload.timestamp ?? '';

  const l1HitRatePct =
    computeHitRatePct(redisStats?.l1Hits, redisStats?.l1Misses) ??
    computeHitRatePct(redisStats?.hits, redisStats?.misses) ??
    (typeof redisStats?.hitRate === 'number' ? redisStats.hitRate : null);
  const l2HitRatePct = computeHitRatePct(redisStats?.l2Hits, redisStats?.l2Misses);
  const missRatePct =
    l1HitRatePct !== null
      ? Number(Math.max(0, PERCENT_MULTIPLIER - l1HitRatePct).toFixed(1))
      : null;

  const hasInfoDiagnostics = Boolean(
    diagnostics &&
      (Boolean(diagnostics.replicationRole) ||
        Boolean(diagnostics.maxmemoryPolicy) ||
        (diagnostics.usedMemoryBytes ?? 0) > 0)
  );

  const usedMemoryMb =
    hasInfoDiagnostics && typeof diagnostics?.usedMemoryBytes === 'number'
      ? Number((diagnostics.usedMemoryBytes / BYTES_PER_MEGABYTE).toFixed(2))
      : null;

  const maxMemoryMb =
    hasInfoDiagnostics &&
    typeof diagnostics?.maxmemoryBytes === 'number' &&
    diagnostics.maxmemoryBytes > 0
      ? Number((diagnostics.maxmemoryBytes / BYTES_PER_MEGABYTE).toFixed(2))
      : null;

  const fragmentationRatio =
    hasInfoDiagnostics &&
    typeof diagnostics?.memFragmentationRatio === 'number' &&
    diagnostics.memFragmentationRatio > 0
      ? diagnostics.memFragmentationRatio
      : null;

  const evictedKeys =
    hasInfoDiagnostics && typeof diagnostics?.evictedKeysTotal === 'number'
      ? diagnostics.evictedKeysTotal
      : null;

  const slowlogCount =
    hasInfoDiagnostics && typeof diagnostics?.slowlogCount === 'number'
      ? diagnostics.slowlogCount
      : null;

  const replicationRole = diagnostics?.replicationRole ? diagnostics.replicationRole : null;
  const connectedSlaves =
    hasInfoDiagnostics && typeof diagnostics?.connectedSlaves === 'number'
      ? diagnostics.connectedSlaves
      : null;
  const maxmemoryPolicy = diagnostics?.maxmemoryPolicy ? diagnostics.maxmemoryPolicy : null;

  const diagKeyspaceTotal =
    (diagnostics?.keyspaceHitsTotal ?? 0) + (diagnostics?.keyspaceMissesTotal ?? 0);
  const statsLookupsTotal = (redisStats?.hits ?? 0) + (redisStats?.misses ?? 0);
  const hitRateRatio =
    diagKeyspaceTotal > 0 && typeof diagnostics?.hitRateRatio === 'number'
      ? diagnostics.hitRateRatio
      : statsLookupsTotal > 0
        ? (redisStats?.hits ?? 0) / statsLookupsTotal
        : null;

  const memoryAllocated =
    payload.memoryAllocated ??
    redisStats?.memoryAllocated ??
    (usedMemoryMb !== null ? `${usedMemoryMb.toFixed(1)} MB` : 'Not reported');

  const maxMemoryLabel =
    maxMemoryMb !== null
      ? `Max: ${maxMemoryMb.toFixed(1)} MB`
      : hasInfoDiagnostics && diagnostics?.maxmemoryBytes === 0
        ? 'Max: Unlimited (0)'
        : 'Max: Not reported';

  const alerts = goldenSignals.map((signal) => {
    const stateMap: Record<AlertRuleState | 'WARNING' | 'CRITICAL', AlertState> = {
      NORMAL: 'NORMAL',
      PENDING: 'PENDING',
      FIRING: 'FIRING',
      RESOLVED: 'RECOVERING',
      WARNING: 'PENDING',
      CRITICAL: 'FIRING',
    };
    return {
      ruleId: signal.id,
      label: signal.id.replace(/_/g, ' '),
      state: stateMap[signal.alertState as AlertRuleState] ?? 'NORMAL',
      thresholdLabel: signal.thresholdLabel,
    };
  });

  const resolvedOpsPerSec =
    payload.opsPerSecond ?? redisStats?.opsPerSecond ?? diagnostics?.instantaneousOpsPerSec ?? null;
  const commands: readonly CommandStat[] =
    payload.redis?.commands ??
    (resolvedOpsPerSec !== null ? [{ name: 'Ops / sec', count: resolvedOpsPerSec }] : []);
  const slowlog: readonly SlowLogEntry[] =
    payload.redis?.slowlog ??
    (diagnostics?.slowlogEntries ?? []).map((entry) => ({
      command: entry.command,
      durationMs: Math.round((entry.durationUs / 1_000) * 100) / 100,
      client: 'redis',
      timestamp: new Date(entry.timestamp * 1_000).toISOString(),
    }));

  const resolvedSlaPct =
    (redisUptime && 'sla24hPct' in redisUptime ? redisUptime.sla24hPct : undefined) ??
    (redisUptime && 'sla24h' in redisUptime ? redisUptime.sla24h : undefined) ??
    payload.overallSla24hPct ??
    payload.uptime?.sla24h ??
    null;

  const resolvedClusterHealth =
    payload.clusterHealth ??
    redisStats?.clusterHealth ??
    (diagnostics !== null
      ? (redisStats?.redisErrors ?? 0) === 0
        ? 'HEALTHY'
        : 'DEGRADED'
      : 'Not reported');

  const resolvedTotalKeys =
    payload.totalKeys ??
    redisStats?.totalKeys ??
    diagnostics?.totalKeys ??
    redisStats?.l1Size ??
    null;

  return {
    connected: diagnostics !== null || redisStats !== undefined,
    activeQueues: [],
    queueDepth: null,
    memoryAllocated,
    maxMemoryLabel,
    totalKeys: resolvedTotalKeys,
    opsPerSecond: resolvedOpsPerSec,
    clusterHealth: resolvedClusterHealth,
    lastHeartbeat: syncedTimestamp,
    l1HitRatePct,
    l2HitRatePct,
    missRatePct,
    slaPct: resolvedSlaPct,
    heartbeatTicks: normalizeHeartbeatTicks(redisUptime?.ticks),
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

function AlertStatusPanel({ alerts }: { readonly alerts: RedisStats['alerts'] }) {
  return (
    <GlassCard variant="window" className="p-4">
      <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        Golden Signal Alerts
      </h4>
      {alerts.length === 0 ? (
        <p className="font-mono text-xs text-zinc-500">No alert evaluations reported yet.</p>
      ) : (
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
      )}
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
        {commands.length === 0 ? (
          <p className="font-mono text-zinc-500">Not reported</p>
        ) : (
          commands.slice(0, 5).map((cmd) => (
            <div key={cmd.name} className="flex justify-between">
              <span className="font-mono text-zinc-600">{cmd.name}</span>
              <span className="font-mono text-cyan-700">{cmd.count.toLocaleString('en-US')}</span>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 border-zinc-100 border-t pt-2 text-xs">
        <div className="mb-2 font-semibold text-zinc-700">Slow Queries</div>
        {slowlog.length === 0 ? (
          <p className="font-mono text-zinc-500">No slow queries recorded</p>
        ) : (
          slowlog.slice(0, 3).map((entry, idx) => (
            <div key={`${entry.command}-${idx}`} className="flex justify-between text-zinc-600">
              <span className="font-mono">{entry.command}</span>
              <span className="font-mono text-amber-700">{entry.durationMs}ms</span>
            </div>
          ))
        )}
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
          <span className="font-mono text-purple-700">
            {stats.usedMemoryMb !== null ? `${stats.usedMemoryMb.toFixed(1)} MB` : 'Not reported'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Max Memory</span>
          <span className="font-mono text-zinc-700">
            {stats.maxMemoryMb !== null ? `${stats.maxMemoryMb.toFixed(1)} MB` : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Fragmentation</span>
          <span className="font-mono text-amber-700">
            {stats.fragmentationRatio !== null
              ? `${stats.fragmentationRatio.toFixed(2)}x`
              : 'Not reported'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Evicted Keys</span>
          <span className="font-mono text-rose-700">
            {stats.evictedKeys !== null
              ? stats.evictedKeys.toLocaleString('en-US')
              : 'Not reported'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Eviction Policy</span>
          <span className="font-mono text-zinc-700">{stats.maxmemoryPolicy ?? 'Not reported'}</span>
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
          <span className="font-mono text-indigo-700">
            {stats.replicationRole ?? 'Not reported'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Connected Slaves</span>
          <span className="font-mono text-zinc-700">
            {stats.connectedSlaves !== null ? stats.connectedSlaves : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Active Queues</span>
          <span className="font-mono text-zinc-700">{stats.activeQueues.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Slowlog Entries</span>
          <span className="font-mono text-zinc-700">
            {stats.slowlogCount !== null ? stats.slowlogCount : 'Not reported'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Hit Rate Ratio</span>
          <span className="font-mono text-emerald-700">
            {stats.hitRateRatio !== null
              ? `${(stats.hitRateRatio * PERCENT_MULTIPLIER).toFixed(1)}%`
              : 'N/A'}
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
  readonly engine: string;
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
  mode: 'Not reported',
  engine: 'Not reported',
  vectorIndexes: [],
};

export default function RedisManagerPage() {
  const [stats, setStats] = useState<RedisStats>(INITIAL_REDIS_STATS);
  const [searchHealth, setSearchHealth] =
    useState<RediSearchHealthState>(DEFAULT_REDISEARCH_HEALTH);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [liveKeys, setLiveKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const selectedKeyRef = useRef<string>('');
  selectedKeyRef.current = selectedKey;

  const [inspectedKeyData, setInspectedKeyData] = useState<{
    key: string;
    type: string;
    ttlSeconds: number;
    value: unknown;
  } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<{
    readonly tone: 'info' | 'warning';
    readonly message: string;
  } | null>(null);

  const inspectRedisKeys = useCallback(
    async (options?: { readonly pattern?: string; readonly keyToInspect?: string | null }) => {
      try {
        const pattern = options?.pattern?.trim() || '*';
        const keyToInspect = options?.keyToInspect ?? null;
        const params = new URLSearchParams({ pattern });
        if (keyToInspect) {
          params.set('key', keyToInspect);
        }
        const res = await fetch(`/api/admin/redis/inspect?${params.toString()}`);
        if (!res.ok) {
          setNoticeBanner({
            tone: 'warning',
            message: `Redis key inspection returned HTTP ${res.status}.`,
          });
          return;
        }
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
          if (!keyToInspect && payload.keys.length > 0 && !selectedKeyRef.current) {
            const firstKey = payload.keys[0] ?? '';
            selectedKeyRef.current = firstKey;
            setSelectedKey(firstKey);
          }
        }
        if (payload.inspected) {
          setInspectedKeyData(payload.inspected);
        }
      } catch {
        // Leave liveKeys unchanged if inspection endpoint is unreachable
      }
    },
    []
  );

  const fetchStats = useCallback(
    async (options?: { readonly pattern?: string; readonly keyToInspect?: string | null }) => {
      setIsLoading(true);
      try {
        const resolvedPattern = options?.pattern ?? '*';
        const resolvedKey =
          options?.keyToInspect !== undefined
            ? options.keyToInspect
            : selectedKeyRef.current || null;

        const [obsResult, healthResult] = await Promise.allSettled([
          fetch('/api/admin/observability'),
          fetch('/api/health/redis'),
          inspectRedisKeys({ pattern: resolvedPattern, keyToInspect: resolvedKey }),
        ]);
        if (obsResult.status === 'fulfilled' && obsResult.value.ok) {
          const payload = (await obsResult.value.json()) as ObservabilityApiResponse;
          setStats(mapObservabilityToRedisStats(payload));
        } else if (obsResult.status === 'fulfilled') {
          setNoticeBanner({
            tone: 'warning',
            message: `Observability telemetry returned HTTP ${obsResult.value.status}.`,
          });
        } else {
          setNoticeBanner({
            tone: 'warning',
            message: 'Unable to reach /api/admin/observability.',
          });
        }
        if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
          const health = (await healthResult.value.json()) as {
            mode?: string;
            engine?: string;
            vectorSearch?: { available?: boolean; reason?: string };
            vectorIndexes?: RediSearchHealthState['vectorIndexes'];
          };
          setSearchHealth({
            searchSupported: Boolean(health.vectorSearch?.available),
            reason: health.vectorSearch?.reason,
            mode: health.mode ?? 'Not reported',
            engine: health.engine ?? 'Not reported',
            vectorIndexes: health.vectorIndexes ?? [],
          });
        } else if (healthResult.status === 'fulfilled') {
          setNoticeBanner({
            tone: 'warning',
            message: `Redis health probe returned HTTP ${healthResult.value.status}.`,
          });
        }
      } catch {
        setNoticeBanner({
          tone: 'warning',
          message: 'Failed to refresh Redis telemetry.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [inspectRedisKeys]
  );

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const trimmed = searchFilter.trim();
    if (!trimmed) return;
    const timer = window.setTimeout(() => {
      void inspectRedisKeys({
        pattern: trimmed.includes('*') ? trimmed : `*${trimmed}*`,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchFilter, inspectRedisKeys]);

  const selectedKeyRecord = inspectedKeyData?.value ?? null;
  const heartbeatDisplay = formatHeartbeatDisplay(stats.lastHeartbeat);
  const ttlExpiresIso =
    inspectedKeyData && inspectedKeyData.ttlSeconds > 0
      ? new Date(Date.now() + inspectedKeyData.ttlSeconds * MS_PER_SECOND).toISOString()
      : inspectedKeyData?.ttlSeconds === -1
        ? 'Never (persistent)'
        : 'N/A';

  const handleInspectKey = () => {
    void fetchStats({
      pattern: searchFilter.trim() || '*',
      keyToInspect: selectedKey || null,
    });
    setNoticeBanner({
      tone: 'info',
      message: selectedKey
        ? `Inspected live Redis key "${selectedKey}" and refreshed cluster telemetry.`
        : 'Refreshed live Redis key list and cluster telemetry.',
    });
  };

  const handleOpenDeleteConfirm = () => {
    if (!selectedKey) {
      setNoticeBanner({
        tone: 'warning',
        message: 'Select a Redis key before requesting deletion.',
      });
      return;
    }
    setPendingDeleteKey(selectedKey);
  };

  const handleConfirmDeleteKey = async () => {
    if (!pendingDeleteKey) return;
    const keyToDelete = pendingDeleteKey;
    setIsDeleting(true);
    try {
      const params = new URLSearchParams({ key: keyToDelete });
      const res = await fetch(`/api/admin/redis/inspect?${params.toString()}`, {
        method: 'DELETE',
      });
      const body = (await res.json().catch(() => ({}))) as {
        deleted?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setNoticeBanner({
          tone: 'warning',
          message: body.error ?? `Failed to delete Redis key "${keyToDelete}".`,
        });
        return;
      }

      const remainingKeys = liveKeys.filter((existingKey) => existingKey !== keyToDelete);
      setLiveKeys(remainingKeys);
      const nextKey = remainingKeys[0] ?? '';
      selectedKeyRef.current = nextKey;
      setSelectedKey(nextKey);
      setInspectedKeyData(null);
      setNoticeBanner({
        tone: 'info',
        message: body.deleted
          ? `Deleted Redis key "${keyToDelete}" and recorded admin audit log.`
          : `Redis key "${keyToDelete}" was already expired or absent.`,
      });
    } catch {
      setNoticeBanner({
        tone: 'warning',
        message: `Network error while deleting Redis key "${keyToDelete}".`,
      });
    } finally {
      setIsDeleting(false);
      setPendingDeleteKey(null);
    }
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
              Transport: {searchHealth.mode} • Engine: {searchHealth.engine}
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

      {pendingDeleteKey && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="redis-delete-confirm-title"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 text-xs"
        >
          <div>
            <p id="redis-delete-confirm-title" className="font-semibold">
              Confirm Redis key deletion
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-rose-800">
              Permanently delete &ldquo;{pendingDeleteKey}&rdquo;? Protected session/auth/lock keys
              are blocked server-side and all deletions are audit-logged.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingDeleteKey(null)}
              disabled={isDeleting}
              className="rounded border border-zinc-300 bg-white px-2.5 py-1 font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleConfirmDeleteKey();
              }}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 rounded border border-rose-600 bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              <Trash2 className="h-3 w-3" />
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      )}

      <RedisUptimeSection stats={stats} />

      <KPIGrid cols={KPI_GRID_COLUMNS}>
        <KPICard
          label="Memory Usage"
          value={stats.memoryAllocated}
          sub={stats.maxMemoryLabel}
          color="blue"
          icon={<HardDrive className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Cluster Status"
          value={stats.clusterHealth}
          sub={`Transport: ${searchHealth.mode}`}
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
          value={heartbeatDisplay.timeLabel}
          sub={heartbeatDisplay.dateLabel}
          color="indigo"
          icon={<Clock className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Keys (DB 0)"
          value={
            stats.totalKeys !== null ? stats.totalKeys.toLocaleString('en-US') : 'Not reported'
          }
          sub="Indexed"
          color="indigo"
          icon={<Key className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Ops / sec"
          value={
            stats.opsPerSecond !== null
              ? stats.opsPerSecond.toLocaleString('en-US')
              : 'Not reported'
          }
          sub="Live Telemetry"
          color="cyan"
          icon={<Activity className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="24h SLA"
          value={stats.slaPct !== null ? `${stats.slaPct}%` : 'No samples yet'}
          sub="Persisted SLO"
          color="green"
          icon={<Gauge className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Queue Depth"
          value={stats.queueDepth !== null ? String(stats.queueDepth) : 'Not reported'}
          sub="Live Queue Size"
          color="green"
          icon={<DatabaseZap className="h-5 w-5 opacity-70" />}
        />
      </KPIGrid>

      <RedisTelemetryGauges
        slaPct={stats.slaPct}
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
                  liveKeys.filter((keyItem) =>
                    keyItem.toLowerCase().includes(searchFilter.toLowerCase())
                  ).length
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
                          selectedKeyRef.current = keyName;
                          setSelectedKey(keyName);
                          void inspectRedisKeys({
                            pattern: searchFilter.trim() || '*',
                            keyToInspect: keyName,
                          });
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
                  onClick={handleOpenDeleteConfirm}
                  className="rounded border border-red-200 bg-red-50 px-3 py-1 text-red-600 text-xs hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
            <RedisKeyInspectorVisual
              selectedKey={selectedKey}
              keyType={inspectedKeyData?.type ?? 'unknown'}
              ttlSeconds={inspectedKeyData?.ttlSeconds ?? null}
              ttlExpiresIso={ttlExpiresIso}
              lastInspected={stats.lastHeartbeat}
              selectedKeyRecord={selectedKeyRecord}
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
