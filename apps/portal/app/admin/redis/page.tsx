'use client';

import React from 'react';
import { GlassCard } from '@repo/ui/GlassCard';
import { PageHeader } from '@repo/ui/PageHeader';
import { KPIGrid, KPICard } from '@repo/ui/KPI';
import { Database, Activity, HardDrive, Key, Network } from 'lucide-react';

export default function RedisManagerPage() {
  return (
    <div className="flex min-h-screen flex-col gap-6 p-4 lg:p-8 bg-zinc-50">
      <PageHeader title="RedisInsight Manager" />

      {/* Top Metrics Grid */}
      <KPIGrid cols={4}>
        <KPICard
          label="Memory Usage"
          value="45.2 MB"
          sub="/ 256 MB (+1.2%)"
          color="blue"
          icon={<HardDrive className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Active Connections"
          value="1,240"
          sub="+12"
          color="green"
          icon={<Network className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Keys (DB 0)"
          value="84,392"
          sub="+430"
          color="indigo"
          icon={<Key className="h-5 w-5 opacity-70" />}
        />
        <KPICard
          label="Ops / sec"
          value="2,400"
          sub="-50"
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
              placeholder="Search keys (*:pattern)"
              className="w-full rounded-md border border-zinc-200 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex-1 overflow-auto border rounded-md border-zinc-200 bg-white/30">
              <ul className="divide-y divide-zinc-100">
                {['shift_001_cache', 'user_session_abc123', 'telemetry_dump_r1', 'rate_limit_api', 'pubsub_drilling_event'].map((key) => (
                  <li key={key} className="px-3 py-2 hover:bg-zinc-100/50 cursor-pointer text-sm font-mono text-zinc-700">
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
                <h3 className="font-mono text-sm font-semibold text-zinc-800">shift_001_cache</h3>
                <p className="text-xs text-zinc-500 uppercase">Type: Hash • TTL: 3600s</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50">Refresh</button>
                <button className="px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded text-xs hover:bg-red-100">Delete</button>
              </div>
            </div>
            <div className="p-4 flex-1 bg-white/40 overflow-auto font-mono text-sm text-zinc-800">
              <pre>{JSON.stringify({
                shiftId: "shift_001",
                foreman: "John Doe",
                activeMachines: 14,
                totalTonsMoved: 15400,
                lastUpdated: new Date().toISOString()
              }, null, 2)}</pre>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
