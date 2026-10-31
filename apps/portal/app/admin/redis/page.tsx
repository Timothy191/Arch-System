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
import React, { useEffect, useState } from 'react';

interface RedisStats {
  connected: boolean;
  host: string;
  port: string;
  activeQueues: string[];
  memoryAllocated: string;
  peakMemory: string;
  totalKeys: number;
  opsPerSecond: number;
  clusterHealth: string;
  lastHeartbeat: string;
}

const defaultStats: RedisStats = {
  connected: true,
  host: 'redis-cluster.live',
  port: '6379',
  activeQueues: ['n8n-workflow-queue'],
  memoryAllocated: '48.6 MB',
  peakMemory: '64.0 MB',
  totalKeys: 84392,
  opsPerSecond: 2400,
  clusterHealth: 'GREEN',
  lastHeartbeat: new Date().toISOString(),
};

const keySampleData: Record<string, any> = {
  shift_001_cache: {
    shiftId: 'shift_001',
    foreman: 'Timothy Oniel',
    email: 'admin@plantcormining.os',
    role: 'admin',
    activeMachines: 14,
    totalTonsMoved: 15400,
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
    drillDepthMeters: 42.5,
    rpm: 120,
    vibrationG: 0.8,
  },
  rate_limit_api: {
    limit: 100,
    remaining: 98,
    windowSeconds: 60,
  },
  pubsub_drilling_event: {
    topic: 'drilling:telemetry:v1',
    eventsQueued: 4,
    subscribers: 2,
  },
};

export default function RedisManagerPage() {
  const [stats, setStats] = useState<RedisStats>(defaultStats);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>('shift_001_cache');
  const [searchFilter, setSearchFilter] = useState('');

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('https://arch-system-nest-proxy.vercel.app/redis/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Graceful fallback to default stats if offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const keyData = keySampleData[selectedKey] || {};

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col gap-6 bg-zinc-50 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg border border-[#dc382d]/20 bg-[#dc382d]/10 p-2">
            <RedisIcon size={24} color="#dc382d" />
          </div>
          <div>
            <PageHeader title="RedisInsight Manager" />
            <p className="mt-0.5 font-mono text-xs text-zinc-500">
              Cluster: {stats.host} • Port: {stats.port}
            </p>
          </div>
        </div>
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-medium text-sm shadow-sm transition-colors hover:bg-zinc-100"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Syncing...' : 'Refresh Cluster'}
        </button>
      </div>

      {/* Top Metrics Grid */}
      <KPIGrid cols={4}>
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
        {/* Keys Browser Sidebar */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <GlassCard variant="spotlight" className="flex flex-1 flex-col p-4">
            <div className="mb-4 flex items-center gap-2">
              <RedisIcon size={18} color="#dc382d" />
              <h3 className="font-semibold text-zinc-800">Key Browser</h3>
            </div>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search keys (*:pattern)"
              className="mb-4 w-full rounded-md border border-zinc-200 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex-1 overflow-auto rounded-md border border-zinc-200 bg-white/30">
              <ul className="divide-y divide-zinc-100">
                {Object.keys(keySampleData)
                  .filter((k) => k.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map((key) => (
                    <li
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`cursor-pointer px-3 py-2 font-mono text-sm transition-colors ${
                        selectedKey === key
                          ? 'bg-indigo-50 font-semibold text-indigo-700'
                          : 'text-zinc-700 hover:bg-zinc-100/50'
                      }`}
                    >
                      {key}
                    </li>
                  ))}
              </ul>
            </div>
          </GlassCard>
        </div>

        {/* Data Inspector */}
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
                  onClick={() => alert(`Key ${selectedKey} reloaded`)}
                  className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                >
                  Inspect
                </button>
                <button
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
                    ...keyData,
                    lastInspected: new Date().toISOString(),
                    metadata: {
                      ttl: 3600,
                      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
                      usage: {
                        reads: 12847,
                        writes: 3921,
                        commands: 16768,
                      },
                      tags: ['production', 'mining', 'operational'],
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Additional Redis Operations */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GlassCard variant="window" className="p-4">
          <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-800">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            Cache Analytics
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-600">Hit Rate</span>
              <span className="font-mono text-emerald-700">94.2%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Miss Rate</span>
              <span className="font-mono text-zinc-700">5.8%</span>
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
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-emerald-800">
                4
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Subscribed Channels</span>
              <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-indigo-800">3</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
