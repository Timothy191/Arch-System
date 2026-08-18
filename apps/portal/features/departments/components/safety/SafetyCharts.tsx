"use client";

import { Card, Title, AreaChart, DonutChart, Color } from "@tremor/react";

export interface SafetyChartsProps {
  trendData: {
    date: string;
    incidents: number;
    severity: number;
  }[];
  distributionData: {
    name: string;
    value: number;
  }[];
}

const CHART_COLORS: Color[] = ["emerald", "blue", "rose", "cyan", "indigo"];
const COLOR_DOT_CLASSES = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
];

// AGENT-TRACE: Static class map replaces dynamic template literals for Tailwind JIT compilation safety
export function SafetyCharts({ trendData, distributionData }: SafetyChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Incident Trend Chart */}
      <Card className="lg:col-span-2 bg-[var(--bg-primary)] border-[var(--border-default)] shadow-none">
        <Title className="text-[var(--text-heading)] text-sm font-medium mb-4">
          Incident & Severity Trend (30d)
        </Title>
        <AreaChart
          className="h-72 mt-4"
          data={trendData}
          index="date"
          categories={["incidents", "severity"]}
          colors={["emerald", "blue"] as Color[]}
          valueFormatter={(number: number) => `${number}`}
          showLegend={true}
          showGridLines={false}
          curveType="monotone"
        />
      </Card>

      {/* Type Distribution Chart */}
      <Card className="bg-[var(--bg-primary)] border-[var(--border-default)] shadow-none">
        <Title className="text-[var(--text-heading)] text-sm font-medium mb-4">
          Incident Type Distribution
        </Title>
        <DonutChart
          className="h-72 mt-4"
          data={distributionData}
          category="value"
          index="name"
          colors={CHART_COLORS}
          variant="donut"
          showAnimation={true}
        />
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {distributionData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${COLOR_DOT_CLASSES[idx % COLOR_DOT_CLASSES.length]}`}
              />
              <span className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
