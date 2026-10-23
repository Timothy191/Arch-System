import { AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import type { BreakdownMetrics } from './types';

interface BreakdownStatsProps {
  metrics: BreakdownMetrics;
}

export function BreakdownStats({ metrics }: BreakdownStatsProps) {
  const stats = [
    {
      label: 'Active Incidents',
      value: metrics.active,
      icon: Zap,
      color: 'text-accent-red',
      bg: 'bg-accent-red/10 border-accent-red/20',
      sub: 'Currently in workshop',
    },
    {
      label: 'Total Breakdowns',
      value: metrics.total,
      icon: AlertTriangle,
      color: 'text-accent-blue',
      bg: 'bg-accent-blue/10 border-accent-blue/20',
      sub: 'All time',
    },
    {
      label: 'Completed Today',
      value: metrics.completedToday,
      icon: CheckCircle,
      color: 'text-accent-green',
      bg: 'bg-accent-green/10 border-accent-green/20',
      sub: 'Back in service',
    },
    {
      label: 'Avg. Repair Time',
      value: `${metrics.avgRepairHours.toFixed(1)}h`,
      icon: Clock,
      color: 'text-accent-blue',
      bg: 'bg-accent-blue/10 border-accent-blue/20',
      sub: 'All completed',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] p-4 transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="mt-1 font-bold text-2xl text-[var(--text-heading)]">{stat.value}</p>
                <p className="mt-1 text-[var(--text-secondary)] text-xs">{stat.sub}</p>
              </div>
              <div className={`rounded-lg border p-2 ${stat.bg}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
