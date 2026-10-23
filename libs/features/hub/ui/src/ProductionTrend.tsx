'use client';

import { AreaChart, Title, Text as TremorText } from '@tremor/react';
import { AlertCircle } from 'lucide-react';

export interface TrendDataPoint {
  date: string;
  Drilling: number;
  Production: number;
  Engineering: number;
}

interface ProductionTrendProps {
  data: TrendDataPoint[];
  isFallback?: boolean;
}

export function ProductionTrend({ data, isFallback = false }: ProductionTrendProps) {
  if (data.length === 0) return null;

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col justify-between gap-3 border-arch-border-subtle border-b pb-3 sm:flex-row sm:items-center">
        <div>
          <Title className="font-semibold text-arch-text-primary text-base tracking-tight sm:text-lg">
            Site Production Trend
          </Title>
          <TremorText className="mt-0.5 text-arch-text-tertiary text-xs">
            Real-time tonnage and volume output across core departments (last 24h)
          </TremorText>
          {/* AGENT-TRACE: Fallback indicator shown when RPC returns no data or errors */}
          {isFallback && (
            <div className="mt-1.5 flex items-center gap-1.5 font-medium text-[11px] text-accent-amber">
              <AlertCircle className="h-3 w-3" />
              Showing sample data — live telemetry unavailable
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-arch-border-subtle bg-arch-surface-secondary/80 px-2.5 py-1">
            <div className="h-2 w-2 rounded-full bg-[var(--dept-drilling)]" />
            <span className="font-medium text-arch-text-secondary text-xs">Drilling</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-arch-border-subtle bg-arch-surface-secondary/80 px-2.5 py-1">
            <div className="h-2 w-2 rounded-full bg-accent-green" />
            <span className="font-medium text-arch-text-secondary text-xs">Production</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-arch-border-subtle bg-arch-surface-secondary/80 px-2.5 py-1">
            <div className="h-2 w-2 rounded-full bg-[var(--dept-engineering)]" />
            <span className="font-medium text-arch-text-secondary text-xs">Engineering</span>
          </div>
        </div>
      </div>
      <AreaChart
        className="mt-2 h-72"
        data={data}
        index="date"
        categories={['Drilling', 'Production', 'Engineering']}
        colors={['blue', 'emerald', 'violet']}
        showLegend={false}
        showYAxis={true}
        yAxisWidth={48}
        showGridLines={true}
        showXAxis={true}
        curveType="monotone"
      />
    </div>
  );
}
