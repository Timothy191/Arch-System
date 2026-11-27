'use client';

import {
  EngineeringMountedWheelIcon,
  EngineeringReliabilityPulseIcon,
} from '@repo/ui/engineering-icons';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { BarChart, type Color, DonutChart } from '@tremor/react';
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

const LEGEND_PILL_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-white/85 px-2.5 py-1 font-medium text-[var(--text-heading)] text-xs shadow-2xs';

const TRIGGER_CARD_CLASS =
  'gold-steel-border gold-steel-border-slim flex flex-col justify-between space-y-2 rounded-xl border border-white/40 bg-white/85 p-3.5 shadow-card transition-transform duration-200 hover:-translate-y-0.5';

const STATUS_ROW_CLASS =
  'flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-white/75 px-3 py-2 text-xs transition-colors hover:bg-white';

export function BreakdownCharts({
  statusData,
  mtbfData = [],
  serviceTriggers = [],
}: BreakdownChartsProps) {
  const reliabilityChartData = mtbfData.map((d) => ({
    category: d.category,
    'MTTR (hrs)': d.mttrHours,
    'MTBF (hrs)': d.mtbfHours,
  }));

  return (
    <div className="space-y-6">
      {/* Automated Preventative Service Triggers */}
      {serviceTriggers.length > 0 && (
        <GoldenPanel
          variant="subtle"
          title={`Automated Preventative Service Triggers (${serviceTriggers.length} Active)`}
          headingLevel="h3"
          subtitle="High-frequency workshop interventions flagged for scheduled bay overhaul"
          icon={<ShieldAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />}
          statusBadge={
            <span className="rounded-full border border-amber-500/30 bg-amber-500/12 px-2.5 py-0.5 font-semibold text-[11px] text-amber-800 uppercase tracking-wider">
              High Priority
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {serviceTriggers.map((trigger) => (
              <div key={trigger.id} className={TRIGGER_CARD_CLASS}>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-heading)] text-xs">
                      {trigger.machine_name}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-semibold text-[10px]',
                        trigger.severity === 'high'
                          ? 'bg-rose-500/12 text-rose-800'
                          : 'bg-amber-500/12 text-amber-800'
                      )}
                    >
                      {trigger.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {trigger.machine_type} • {trigger.reason}
                  </p>
                </div>

                <div className="flex items-center justify-between border-[var(--border-default)] border-t pt-2 text-[11px]">
                  <span className="font-mono text-[var(--text-muted)]">{trigger.metric_value}</span>
                  <span className="font-semibold text-[var(--text-heading)]">
                    {trigger.recommended_action}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GoldenPanel>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* #11 Reliability Analytics: MTTR vs Predictive MTBF (Hours) */}
        <GoldenPanel
          variant="interactive"
          className="lg:col-span-2"
          title="Reliability Analytics: MTTR vs Predictive MTBF (Hours)"
          headingLevel="h3"
          subtitle="Mean Time to Repair vs Mean Time Between Failures by equipment category."
          icon={<EngineeringReliabilityPulseIcon className="h-5 w-5 text-accent-gold" />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <span className={LEGEND_PILL_CLASS}>
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" aria-hidden="true" />
                <span>MTTR (Repair)</span>
              </span>
              <span className={LEGEND_PILL_CLASS}>
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" aria-hidden="true" />
                <span>MTBF (Uptime)</span>
              </span>
            </div>
          }
        >
          <BarChart
            className="mt-2 h-72"
            data={reliabilityChartData}
            index="category"
            categories={['MTTR (hrs)', 'MTBF (hrs)']}
            colors={['blue', 'emerald'] as Color[]}
            valueFormatter={(number: number) => `${number}h`}
            showLegend={false}
            showGridLines={true}
          />
        </GoldenPanel>

        {/* #10 Fleet Health Distribution */}
        <GoldenPanel
          variant="interactive"
          title="Fleet Health Distribution"
          headingLevel="h3"
          subtitle="Proportion of active operational fleet vs broken-down units."
          icon={<EngineeringMountedWheelIcon className="h-5 w-5 text-emerald-700" />}
        >
          <DonutChart
            className="mt-1 h-56"
            data={statusData}
            category="value"
            index="name"
            colors={['emerald', 'rose'] as Color[]}
            variant="pie"
            showAnimation={true}
          />
          <div className="mt-4 flex flex-col gap-2">
            {statusData.map((item, idx) => (
              <div key={item.name} className={STATUS_ROW_CLASS}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      idx === 0 ? 'bg-emerald-600' : 'bg-rose-600'
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-[var(--text-heading)]">{item.name}</span>
                </div>
                <span className="font-mono font-semibold text-[var(--text-heading)]">
                  {item.value} units
                </span>
              </div>
            ))}
          </div>
        </GoldenPanel>
      </div>
    </div>
  );
}
