"use client";

import { Title, AreaChart, Text } from "@tremor/react";

export interface TrendDataPoint {
  date: string;
  Drilling: number;
  Production: number;
  Engineering: number;
}

interface ProductionTrendProps {
  data: TrendDataPoint[];
}

export function ProductionTrend({ data }: ProductionTrendProps) {
  if (data.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Title className="text-arch-text-primary">Site Production Trend</Title>
          <Text className="text-arch-text-tertiary">Real-time output across core departments</Text>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-blue" />
            <span className="text-xs text-arch-text-tertiary">Drilling</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-green" />
            <span className="text-xs text-arch-text-tertiary">Production</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-blue" />
            <span className="text-xs text-arch-text-tertiary">Engineering</span>
          </div>
        </div>
      </div>
      <AreaChart
        className="h-72 mt-4"
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
