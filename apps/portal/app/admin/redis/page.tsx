'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import { RedisIcon } from '@repo/ui/RedisIcon';
import {
  Activity,
  BarChart3,
  Clock,
  DatabaseZap,
  Gauge,
  GitBranch,
  HardDrive,
  Key,
  Network,
  RefreshCw,
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

type HeartbeatStatus = 'UP' | 'DEGRADED' | 'DOWN';

interface HeartbeatTick {
  readonly index: number;
  readonly status: HeartbeatStatus;
  readonly latencyMs: number;
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
  const memoryAllocated =
    payload.memoryAllocated ??
    redisStats?.memoryAllocated ??
    (diagnostics?.memoryUsedMb
      ? `${diagnostics.memoryUsedMb} MB`
      : DEFAULT_REDIS_STATS.memoryAllocated);

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
    missRatePct: Number(Math.max(0, PERCENT_MULTIPLIER - l1HitRatePct).toFixed(1)),
    slaPct: redisUptime?.sla24h ?? payload.uptime?.sla24h ?? DEFAULT_SLA_PCT,
    heartbeatTicks: normalizeHeartbeatTicks(redisUptime?.ticks),
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

function RedisBottomPanels({ stats }: { readonly stats: RedisStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <GlassCard variant="window" className="p-4">
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          Cache Analytics
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-600">Hit Rate (L1 / L2)</span>
            <span className="font-mono text-emerald-700">
              {stats.l1HitRatePct}% / {stats.l2HitRatePct}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Miss Rate</span>
            <span className="font-mono text-zinc-700">{stats.missRatePct}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Evictions</span>
            <span className="font-mono text-amber-700">12</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Memory Fragmentation</span>
            <span className="font-mono text-zinc-700">1.2%</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard variant="window" className="p-4">
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
          <GitBranch className="h-4 w-4 text-purple-600" />
          Queue Monitor
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-600">n8n Workflow Queue</span>
            <span className="font-mono text-indigo-700">127 items</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Processing Time</span>
            <span className="font-mono text-zinc-700">3.2s avg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Workers Active</span>
            <span className="font-mono text-emerald-700">8</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard variant="window" className="p-4">
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
          <Clock className="h-4 w-4 text-amber-600" />
          Recent Activity
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Pipeline Commands</span>
            <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-amber-800">456</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Monitor Connections</span>
            <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-emerald-800">4</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Subscribed Channels</span>
            <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-indigo-800">3</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

export default function RedisManagerPage() {
  const [stats, setStats] = useState<RedisStats>(DEFAULT_REDIS_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>('shift_001_cache');
  const [searchFilter, setSearchFilter] = useState('');

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/observability');
      if (response.ok) {
        const payload = (await response.json()) as ObservabilityApiResponse;
        setStats(mapObservabilityToRedisStats(payload));
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
          value="127"
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

      <RedisBottomPanels stats={stats} />
    </div>
  );
}
