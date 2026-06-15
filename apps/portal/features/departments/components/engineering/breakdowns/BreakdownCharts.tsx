"use client";

import { Card, Title, BarChart, DonutChart, Color } from "@tremor/react";

interface BreakdownChartsProps {
  statusData: {
    name: string;
    value: number;
  }[];
  mttrData: {
    machine: string;
    hours: number;
  }[];
}

export function BreakdownCharts({
  statusData,
  mttrData,
}: BreakdownChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* MTTR by Machine Type */}
      <Card className="lg:col-span-2 bg-[var(--bg-primary)] border-[var(--border-default)] shadow-none">
        <Title className="text-[var(--text-heading)] text-sm font-medium mb-4">
          Mean Time To Repair (MTTR) by Category
        </Title>
        <BarChart
          className="h-72 mt-4"
          data={mttrData}
          index="machine"
          categories={["hours"]}
          colors={["violet"] as Color[]}
          valueFormatter={(number: number) => `${number} hrs`}
          showLegend={false}
          showGridLines={false}
        />
      </Card>

      {/* Fleet Status Donut */}
      <Card className="bg-[var(--bg-primary)] border-[var(--border-default)] shadow-none">
        <Title className="text-[var(--text-heading)] text-sm font-medium mb-4">
          Fleet Health Distribution
        </Title>
        <DonutChart
          className="h-72 mt-4"
          data={statusData}
          category="value"
          index="name"
          colors={["emerald", "rose"] as Color[]}
          variant="pie"
          showAnimation={true}
        />
        <div className="mt-6 flex flex-col gap-2">
          {statusData.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full bg-${idx === 0 ? "emerald" : "rose"}-500`}
                />
                <span className="text-[var(--text-secondary)]">
                  {item.name}
                </span>
              </div>
              <span className="text-[var(--text-heading)] font-medium">
                {item.value} units
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
