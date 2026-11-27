'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_HEIGHT,
  CHART_MARGIN,
  paletteColor,
  TOOLTIP_CURSOR_BAR,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from './chart-theme';
import { ChartCard, chartStateFor } from './ExecutiveChartCard';
import { DonutChart } from './ExecutiveDonut';
import { formatNumber, formatPercent } from './executive-format';
import type { BreakdownStats, FleetSnapshot, LabeledCount } from './executive-metrics';

export interface OperationsChartsProps {
  fleet: FleetSnapshot;
  breakdowns: BreakdownStats;
  personnelByDepartment: readonly LabeledCount[];
}

interface HorizontalBarProps {
  entries: readonly LabeledCount[];
  seriesName: string;
  color: string;
}

const CATEGORY_AXIS_WIDTH = 120;
const CATEGORY_LABEL_MAX = 18;
const BAR_RADIUS: [number, number, number, number] = [0, 4, 4, 0];
const GRID_DASH = '3 3';

function truncateCategory(value: string): string {
  return value.length > CATEGORY_LABEL_MAX ? `${value.slice(0, CATEGORY_LABEL_MAX - 1)}…` : value;
}

const BREAKDOWN_STATUS_COLORS: Readonly<Record<string, string>> = {
  Open: CHART_COLORS.alert,
  Completed: CHART_COLORS.active,
};

function HorizontalBar({ entries, seriesName, color }: HorizontalBarProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT} debounce={100}>
      <BarChart data={[...entries]} layout="vertical" margin={CHART_MARGIN}>
        <CartesianGrid
          stroke={CHART_COLORS.grid}
          strokeDasharray={GRID_DASH}
          strokeOpacity={0.4}
          horizontal={false}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={AXIS_TICK}
          stroke={CHART_COLORS.grid}
          tickMargin={6}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={CATEGORY_AXIS_WIDTH}
          tick={AXIS_TICK}
          stroke={CHART_COLORS.grid}
          tickMargin={8}
          tickFormatter={truncateCategory}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={TOOLTIP_CURSOR_BAR}
        />
        <Bar
          dataKey="count"
          name={seriesName}
          fill={color}
          radius={BAR_RADIUS}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FleetMixChart({ fleet }: { fleet: FleetSnapshot }) {
  const slices = fleet.mix.map((entry, index) => ({
    label: entry.label,
    count: entry.active + entry.inactive,
    color: paletteColor(index),
  }));
  return (
    <ChartCard
      title="Fleet Mix by Machine Type"
      description="Registered machines grouped by machine type (active and inactive)."
      state={chartStateFor(true, slices.length > 0)}
      emptyMessage="No machines registered."
      legend={slices.map((slice, index) => ({
        label: slice.label,
        color: slice.color,
        detail: `${formatNumber(fleet.mix[index]?.active ?? 0)}/${formatNumber(slice.count)}`,
      }))}
    >
      <DonutChart slices={slices} centerValue={formatNumber(fleet.total)} centerLabel="Machines" />
    </ChartCard>
  );
}

function FleetStatusChart({ fleet }: { fleet: FleetSnapshot }) {
  const [active, standby] = fleet.status;
  const slices = [
    { label: active?.label ?? 'Active', count: active?.count ?? 0, color: CHART_COLORS.active },
    { label: standby?.label ?? 'Standby', count: standby?.count ?? 0, color: CHART_COLORS.standby },
  ];
  return (
    <ChartCard
      title="Fleet Status"
      description="Active machines versus inactive or standby units in the register."
      state={chartStateFor(true, fleet.total > 0)}
      emptyMessage="No machines registered."
      legend={slices.map((slice) => ({
        label: slice.label,
        color: slice.color,
        detail: formatNumber(slice.count),
      }))}
    >
      <DonutChart
        slices={slices}
        centerValue={formatPercent(fleet.availabilityPct, 0)}
        centerLabel="Available"
      />
    </ChartCard>
  );
}

function BreakdownsChart({ breakdowns }: { breakdowns: BreakdownStats }) {
  return (
    <ChartCard
      title="Breakdowns by Machine Type (MTD)"
      description={`Breakdowns logged since the start of the month by machine type — ${formatNumber(breakdowns.downtimeHours, 1)} h recorded downtime.`}
      state={chartStateFor(true, breakdowns.total > 0)}
      emptyMessage="No breakdowns logged this month."
      legend={breakdowns.byStatus.map((entry) => ({
        label: entry.label,
        color: BREAKDOWN_STATUS_COLORS[entry.label] ?? CHART_COLORS.muted,
        detail: formatNumber(entry.count),
      }))}
    >
      <HorizontalBar
        entries={breakdowns.byMachineType}
        seriesName="Breakdowns"
        color={CHART_COLORS.alert}
      />
    </ChartCard>
  );
}

function PersonnelChart({ entries }: { entries: readonly LabeledCount[] }) {
  return (
    <ChartCard
      title="Personnel by Department"
      description="Active employee records grouped by assigned department."
      state={chartStateFor(true, entries.length > 0)}
      emptyMessage="No employee records found."
      legend={[{ label: 'Employees', color: CHART_COLORS.total }]}
    >
      <HorizontalBar entries={entries} seriesName="Employees" color={CHART_COLORS.total} />
    </ChartCard>
  );
}

export function ExecutiveOperationsCharts({
  fleet,
  breakdowns,
  personnelByDepartment,
}: OperationsChartsProps) {
  return (
    <>
      <FleetMixChart fleet={fleet} />
      <FleetStatusChart fleet={fleet} />
      <BreakdownsChart breakdowns={breakdowns} />
      <PersonnelChart entries={personnelByDepartment} />
    </>
  );
}
