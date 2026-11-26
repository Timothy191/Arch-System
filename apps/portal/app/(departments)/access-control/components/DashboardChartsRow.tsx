'use client';

import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { GlassCard } from '@repo/ui/GlassCard';
import dynamic from 'next/dynamic';
import type { BadgeStatusDistribution, HourlyAccessPoint } from '../actions';

const HourlyAccessChart = dynamic(() => import('./HourlyAccessChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[240px] w-full" />,
});

const QRStatusDistributionChart = dynamic(() => import('./QRStatusDistributionChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[240px] w-full" />,
});

interface DashboardChartsRowProps {
  hourlyStats: HourlyAccessPoint[];
  distribution: BadgeStatusDistribution[];
}

export default function DashboardChartsRow({ hourlyStats, distribution }: DashboardChartsRowProps) {
  const total = distribution.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <GlassCard className="p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-foreground text-sm">Access Events — Today</h2>
            <p className="mt-0.5 text-muted-foreground text-xs">
              Hourly scan volume across all entry points
            </p>
          </div>
          <span className="rounded-md bg-secondary px-2 py-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
            Live
          </span>
        </div>
        <HourlyAccessChart data={hourlyStats} />
      </GlassCard>
      <GlassCard className="p-5 lg:col-span-1">
        <div className="mb-4">
          <h2 className="font-bold text-foreground text-sm">QR Code Status Distribution</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            {total.toLocaleString('en-US')} registered QR codes
          </p>
        </div>
        <QRStatusDistributionChart data={distribution} />
      </GlassCard>
    </div>
  );
}
