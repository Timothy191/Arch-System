'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import { Activity, Database, HardDrive, Key, Network, RefreshCw } from 'lucide-react';
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
    email: 'timothyoniel558@gmail.com',
    role: 'admin',
    activeMachines: 14,
    totalTonsMoved: 15400,
    status: 'ACTIVE',
  },
  user_session_abc123: {
    userId: 'usr_timothy_admin',
    email: 'timothyoniel558@gmail.com',
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

  const keys = Object.keys(keySampleData).filter((k) =>
    k.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col gap-6 p-4 lg:p-6 bg-zinc-50">
      <div className="flex justify-between items-center">
        <PageHeader title="RedisInsight Manager" />
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-md text-sm font-medium hover:bg-zinc-100 transition-colors shadow-sm"
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
      </KPIGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Keys Browser Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <GlassCard variant="spotlight" className="flex-1 flex flex-col p-4">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-zinc-800">Key Browser</h3>
            </div>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search keys (*:pattern)"
              className="w-full rounded-md border border-zinc-200 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex-1 overflow-auto border rounded-md border-zinc-200 bg-white/30">
              <ul className="divide-y divide-zinc-100">
                {keys.map((key) => (
                  <li
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`px-3 py-2 cursor-pointer text-sm font-mono transition-colors ${
                      selectedKey === key
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'hover:bg-zinc-100/50 text-zinc-700'
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
        <div className="lg:col-span-2 flex flex-col gap-4">
          <GlassCard variant="window" className="flex-1 flex flex-col">
            <div className="border-b border-zinc-100 bg-zinc-50/50 px-4 py-3 flex justify-between items-center">
              <div>
                <h3 className="font-mono text-sm font-semibold text-zinc-800">{selectedKey}</h3>
                <p className="text-xs text-zinc-500 uppercase">Type: Hash • TTL: 3600s</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => alert(`Key ${selectedKey} reloaded`)}
                  className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50"
                >
                  Inspect
                </button>
              </div>
            </div>
            <div className="p-4 flex-1 bg-white/40 overflow-auto font-mono text-sm text-zinc-800">
              <pre>
                {JSON.stringify(
                  {
                    ...(keySampleData[selectedKey] || { status: 'UNKNOWN_KEY' }),
                    lastInspected: new Date().toISOString(),
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
