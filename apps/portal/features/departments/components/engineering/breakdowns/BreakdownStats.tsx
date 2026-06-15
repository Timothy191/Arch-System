import { Zap, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { BreakdownMetrics } from "./types";

interface BreakdownStatsProps {
  metrics: BreakdownMetrics;
}

export function BreakdownStats({ metrics }: BreakdownStatsProps) {
  const stats = [
    {
      label: "Active Incidents",
      value: metrics.active,
      icon: Zap,
      color: "text-accent-red",
      bg: "bg-accent-red/10 border-accent-red/20",
      sub: "Currently in workshop",
    },
    {
      label: "Total Breakdowns",
      value: metrics.total,
      icon: AlertTriangle,
      color: "text-accent-blue",
      bg: "bg-accent-blue/10 border-accent-blue/20",
      sub: "All time",
    },
    {
      label: "Completed Today",
      value: metrics.completedToday,
      icon: CheckCircle,
      color: "text-accent-green",
      bg: "bg-accent-green/10 border-accent-green/20",
      sub: "Back in service",
    },
    {
      label: "Avg. Repair Time",
      value: `${metrics.avgRepairHours.toFixed(1)}h`,
      icon: Clock,
      color: "text-accent-blue",
      bg: "bg-accent-blue/10 border-accent-blue/20",
      sub: "All completed",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-xl border bg-[var(--bg-tertiary)] border-[var(--border-emphasis)] p-4 hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-[var(--text-heading)] mt-1">
                  {stat.value}
                </p>
                <p className="text-[var(--text-secondary)] text-xs mt-1">
                  {stat.sub}
                </p>
              </div>
              <div className={`p-2 rounded-lg border ${stat.bg}`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
