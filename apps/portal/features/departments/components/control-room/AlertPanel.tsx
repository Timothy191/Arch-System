'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { AlertCircle, ArrowUpRight, BellRing, Info, Zap } from 'lucide-react';
import { useState } from 'react';

export function AlertPanel({ departmentId }: { departmentId: string }) {
  const [alerts] = useState([
    {
      id: '1',
      level: 'critical',
      title: 'Hydraulic Pressure Drop',
      source: 'Dump Truck 14',
      time: '2 mins ago',
      icon: Zap,
    },
    {
      id: '2',
      level: 'warning',
      title: 'Engine RPM High',
      source: 'Excavator 02',
      time: '15 mins ago',
      icon: AlertCircle,
    },
    {
      id: '3',
      level: 'info',
      title: 'Scheduled Maintenance Due',
      source: 'Dozer 05',
      time: '1 hour ago',
      icon: Info,
    },
  ]);

  const levelStyles = {
    critical: 'bg-accent-red/10 text-accent-red border-accent-red/20',
    warning: 'bg-accent-orange/10 text-accent-orange border-accent-orange/20',
    info: 'bg-arch-brand-blue/10 text-arch-brand-blue border-arch-brand-blue/20',
  };

  return (
    <GlassCard variant="spotlight" className="p-0 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-arch-border-subtle bg-arch-surface-secondary/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-arch-brand-blue" />
          <h3 className="text-sm font-bold text-arch-text-primary">Active Alerts</h3>
        </div>
        <span className="bg-accent-red text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {alerts.filter((a) => a.level === 'critical').length} Critical
        </span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-3 rounded-xl border ${levelStyles[alert.level as keyof typeof levelStyles]}`}
          >
            <div className="p-2 rounded-lg bg-white/50 backdrop-blur-sm">
              <alert.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold">{alert.title}</h4>
              <div className="flex items-center gap-2 text-xs opacity-80 mt-1">
                <span>{alert.source}</span>
                <span>•</span>
                <span>{alert.time}</span>
              </div>
            </div>
            <button type="button" className="p-1.5 hover:bg-black/5 rounded-md transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
