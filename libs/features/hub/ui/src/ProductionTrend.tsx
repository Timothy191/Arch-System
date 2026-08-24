"use client";

import { Title, AreaChart, Text as TremorText } from "@tremor/react";
import { AlertCircle } from "lucide-react";

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-arch-border-subtle">
        <div>
          <Title className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary">
            Site Production Trend
          </Title>
          <TremorText className="text-xs text-arch-text-tertiary mt-0.5">
            Real-time tonnage and volume output across core departments (last 24h)
          </TremorText>
          {/* AGENT-TRACE: Fallback indicator shown when RPC returns no data or errors */}
          {isFallback && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-accent-amber font-medium">
              <AlertCircle className="w-3 h-3" />
              Showing sample data — live telemetry unavailable
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle">
            <div className="w-2 h-2 rounded-full bg-[var(--dept-drilling)]" />
            <span className="text-xs font-medium text-arch-text-secondary">Drilling</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle">
            <div className="w-2 h-2 rounded-full bg-accent-green" />
            <span className="text-xs font-medium text-arch-text-secondary">Production</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle">
            <div className="w-2 h-2 rounded-full bg-[var(--dept-engineering)]" />
            <span className="text-xs font-medium text-arch-text-secondary">Engineering</span>
          </div>
        </div>
      </div>
      <AreaChart
        className="h-72 mt-2"
        data={data}
        index="date"
        categories={["Drilling", "Production", "Engineering"]}
        colors={["blue", "emerald", "violet"]}
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
