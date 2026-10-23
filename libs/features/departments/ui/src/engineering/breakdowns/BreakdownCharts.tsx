'use client';

import { BarChart, Card, type Color, DonutChart, Title } from '@tremor/react';
import { ShieldAlert } from 'lucide-react';
import type { MTBFDataPoint, ServiceTrigger } from './types';

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
          'MTTR (hrs)': d.mttrHours,
          'MTBF (hrs)': d.mtbfHours,
        }))
      : mttrData.map((d) => ({
          category: d.machine,
          'MTTR (hrs)': d.hours,
          'MTBF (hrs)': Math.round(d.hours * 18.5), // Predictive baseline fallback
        }));

  return (
    <div className="space-y-6">
      {/* Automated Preventative Service Triggers */}
      {serviceTriggers.length > 0 && (
        <div className="space-y-3 rounded-xl border border-accent-amber/25 bg-accent-amber/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-accent-amber" />
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                Automated Preventative Service Triggers ({serviceTriggers.length} Active)
              </h3>
            </div>
            <span className="rounded-full bg-accent-amber/20 px-2 py-0.5 font-semibold text-[11px] text-accent-amber uppercase tracking-wider">
              High Priority
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {serviceTriggers.map((trigger) => (
              <div
                key={trigger.id}
                className="flex flex-col justify-between space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 shadow-card"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-heading)] text-xs">
                      {trigger.machine_name}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium text-[10px] ${
                        trigger.severity === 'high'
                          ? 'bg-accent-red/15 text-accent-red'
                          : 'bg-accent-amber/15 text-accent-amber'
                      }`}
                    >
                      {trigger.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {trigger.machine_type} • {trigger.reason}
                  </p>
                </div>

                <div className="flex items-center justify-between border-[var(--border-default)] border-t pt-2 text-[11px]">
                  <span className="font-mono text-[var(--text-muted)]">{trigger.metric_value}</span>
                  <span className="font-medium text-[var(--accent-blue)]">
                    {trigger.recommended_action}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Reliability Metrics: MTTR vs Predictive MTBF */}
        <Card className="border-[var(--border-default)] bg-[var(--bg-primary)] p-5 shadow-none lg:col-span-2">
          <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <Title className="font-semibold text-[var(--text-heading)] text-sm">
                Reliability Analytics: MTTR vs Predictive MTBF (Hours)
              </Title>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Mean Time to Repair vs Mean Time Between Failures by equipment category.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded bg-accent-blue" />
                <span className="text-[var(--text-muted)]">MTTR (Repair)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded bg-accent-green" />
                <span className="text-[var(--text-muted)]">MTBF (Uptime)</span>
              </div>
            </div>
          </div>

          <BarChart
            className="mt-4 h-72"
            data={reliabilityChartData}
            index="category"
            categories={['MTTR (hrs)', 'MTBF (hrs)']}
            colors={['blue', 'emerald'] as Color[]}
            valueFormatter={(number: number) => `${number}h`}
            showLegend={false}
            showGridLines={true}
          />
        </Card>

        {/* Fleet Health Distribution */}
        <Card className="border-[var(--border-default)] bg-[var(--bg-primary)] p-5 shadow-none">
          <Title className="mb-1 font-semibold text-[var(--text-heading)] text-sm">
            Fleet Health Distribution
          </Title>
          <p className="mb-4 text-[var(--text-muted)] text-xs">
            Proportion of active operational fleet vs broken-down units.
          </p>
          <DonutChart
            className="mt-2 h-60"
            data={statusData}
            category="value"
            index="name"
            colors={['emerald', 'rose'] as Color[]}
            variant="pie"
            showAnimation={true}
          />
          <div className="mt-4 flex flex-col gap-2">
            {statusData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-2 w-2 rounded-full ${idx === 0 ? 'bg-accent-green' : 'bg-accent-red'}`}
                  />
                  <span className="text-[var(--text-secondary)]">{item.name}</span>
                </div>
                <span className="font-medium text-[var(--text-heading)]">{item.value} units</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
