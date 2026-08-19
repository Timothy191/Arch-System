"use client";

import { Card, Title, BarChart, DonutChart, Color } from "@tremor/react";
import { Wrench, ShieldAlert, AlertTriangle, CheckCircle2, Clock, Activity } from "lucide-react";
import type { MTBFDataPoint, ServiceTrigger } from "./types";

interface BreakdownChartsProps {
  statusData: {
    name: string;
    value: number;
  }[];
  mttrData?: {
    machine: string;
    hours: number;
  }[];
  mtbfData?: MTBFDataPoint[];
  serviceTriggers?: ServiceTrigger[];
}

export function BreakdownCharts({
  statusData,
  mttrData = [],
  mtbfData = [],
  serviceTriggers = [],
}: BreakdownChartsProps) {
  // Combine MTTR and MTBF into unified chart series if mtbfData is available
  const reliabilityChartData =
    mtbfData.length > 0
      ? mtbfData.map((d) => ({
          category: d.category,
          "MTTR (hrs)": d.mttrHours,
          "MTBF (hrs)": d.mtbfHours,
        }))
      : mttrData.map((d) => ({
          category: d.machine,
          "MTTR (hrs)": d.hours,
          "MTBF (hrs)": Math.round(d.hours * 18.5), // Predictive baseline fallback
        }));

  return (
    <div className="space-y-6">
      {/* Automated Preventative Service Triggers */}
      {serviceTriggers.length > 0 && (
        <div className="p-4 rounded-xl bg-accent-amber/10 border border-accent-amber/25 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-accent-amber" />
              <h3 className="text-sm font-semibold text-[var(--text-heading)]">
                Automated Preventative Service Triggers ({serviceTriggers.length} Active)
              </h3>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-amber/20 text-accent-amber font-semibold uppercase tracking-wider">
              High Priority
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {serviceTriggers.map((trigger) => (
              <div
                key={trigger.id}
                className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] flex flex-col justify-between space-y-2 shadow-card"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[var(--text-heading)]">
                      {trigger.machine_name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        trigger.severity === "high"
                          ? "bg-accent-red/15 text-accent-red"
                          : "bg-accent-amber/15 text-accent-amber"
                      }`}
                    >
                      {trigger.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {trigger.machine_type} • {trigger.reason}
                  </p>
                </div>

                <div className="pt-2 border-t border-[var(--border-default)] flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)] font-mono">{trigger.metric_value}</span>
                  <span className="text-[var(--accent-blue)] font-medium">
                    {trigger.recommended_action}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reliability Metrics: MTTR vs Predictive MTBF */}
        <Card className="lg:col-span-2 bg-[var(--bg-primary)] border-[var(--border-default)] shadow-none p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <Title className="text-[var(--text-heading)] text-sm font-semibold">
                Reliability Analytics: MTTR vs Predictive MTBF (Hours)
              </Title>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Mean Time to Repair vs Mean Time Between Failures by equipment category.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded bg-accent-blue" />
                <span className="text-[var(--text-muted)]">MTTR (Repair)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded bg-accent-green" />
                <span className="text-[var(--text-muted)]">MTBF (Uptime)</span>
              </div>
            </div>
          </div>

          <BarChart
            className="h-72 mt-4"
            data={reliabilityChartData}
            index="category"
            categories={["MTTR (hrs)", "MTBF (hrs)"]}
            colors={["blue", "emerald"] as Color[]}
            valueFormatter={(number: number) => `${number}h`}
            showLegend={false}
            showGridLines={true}
          />
        </Card>

        {/* Fleet Health Distribution */}
        <Card className="bg-[var(--bg-primary)] border-[var(--border-default)] shadow-none p-5">
          <Title className="text-[var(--text-heading)] text-sm font-semibold mb-1">
            Fleet Health Distribution
          </Title>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Proportion of active operational fleet vs broken-down units.
          </p>
          <DonutChart
            className="h-60 mt-2"
            data={statusData}
            category="value"
            index="name"
            colors={["emerald", "rose"] as Color[]}
            variant="pie"
            showAnimation={true}
          />
          <div className="mt-4 flex flex-col gap-2">
            {statusData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-accent-green" : "bg-accent-red"}`}
                  />
                  <span className="text-[var(--text-secondary)]">{item.name}</span>
                </div>
                <span className="text-[var(--text-heading)] font-medium">{item.value} units</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
