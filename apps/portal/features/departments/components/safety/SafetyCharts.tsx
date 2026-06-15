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

export function SafetyCharts({
  trendData,
  distributionData,
}: SafetyChartsProps) {
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
          colors={["emerald", "blue", "rose", "cyan", "indigo"] as Color[]}
          variant="donut"
          showAnimation={true}
        />
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {distributionData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full bg-${["emerald", "blue", "rose", "cyan", "indigo"][idx % 5]}-500`}
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
