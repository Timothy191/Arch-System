"use client";

import { AreaChart, Text } from "@tremor/react";
import { linearForecast } from "@/lib/analytics/forecast";

interface TrendPoint {
  date: string;
  coal: number;
  waste: number;
}

export interface ProductionTrendChartProps {
  data: TrendPoint[];
  showForecast?: boolean;
}

export function ProductionTrendChart({
  data,
  showForecast = true,
}: ProductionTrendChartProps) {
  const coalValues = data.map((d) => d.coal);
  const forecast: number[] =
    showForecast && data.length >= 7 ? linearForecast(coalValues, 7) : [];

  const lastDate = data.at(-1)?.date ?? new Date().toISOString().split("T")[0]!;

  const forecastPoints = forecast.map((val: number, i: number) => {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i + 1);
    return {
      date: d.toISOString().split("T")[0]!,
      coal: undefined,
      waste: undefined,
      "Coal Forecast": Math.max(0, Math.round(val)),
    };
  });

  const chartData = [
    ...data.map((d) => ({
      date: d.date,
      "Coal (t)": Math.round(d.coal),
      "Waste (t)": Math.round(d.waste),
      "Coal Forecast": undefined,
    })),
    ...forecastPoints,
  ];

  const categories =
    showForecast && forecast.length > 0
      ? ["Coal (t)", "Waste (t)", "Coal Forecast"]
      : ["Coal (t)", "Waste (t)"];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <Text className="text-[var(--text-muted)]">
          No production data in the last 30 days
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-green inline-block" />
          Coal Removed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-blue inline-block" />
          Waste Removed
        </span>
        {forecast.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
            7-day Forecast
          </span>
        )}
      </div>
      <AreaChart
        className="h-64"
        data={chartData}
        index="date"
        categories={categories as unknown as string[]}
        colors={["emerald", "blue", "indigo"]}
        showLegend={false}
        showGridLines={false}
        curveType="monotone"
        connectNulls
      />
    </div>
  );
}
