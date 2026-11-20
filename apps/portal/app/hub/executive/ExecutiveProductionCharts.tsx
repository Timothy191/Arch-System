'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RECONCILIATION_THRESHOLDS } from '@/lib/production-reconciliation';
import { AXIS_TICK, CHART_COLORS, CHART_HEIGHT, CHART_MARGIN, TOOLTIP_STYLE } from './chart-theme';
import { ChartCard, type ChartState, chartStateFor } from './ExecutiveChartCard';
import { DonutChart } from './ExecutiveDonut';
import { formatCompact, formatPercent, formatRatio, formatShortDate } from './executive-format';
import type { DailyProductionPoint, PeriodSummary } from './executive-metrics';

export interface ProductionChartsProps {
  summaryAvailable: boolean;
  daily: readonly DailyProductionPoint[];
  mtd: PeriodSummary;
  avgDailyTonnes: number | null;
}

interface SeriesChartProps {
  daily: readonly DailyProductionPoint[];
  state: ChartState;
}

const WIDE_CARD_CLASS = 'lg:col-span-2';
const LINE_WIDTH = 2;
const REFERENCE_DASH = '4 4';
const GRID_DASH = '3 3';
const PERCENT = 100;

function TimeAxes({ rightAxis = false }: { rightAxis?: boolean }) {
  return (
    <>
      <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray={GRID_DASH} vertical={false} />
      <XAxis
        dataKey="date"
        tickFormatter={formatShortDate}
        tick={AXIS_TICK}
        stroke={CHART_COLORS.grid}
      />
      <YAxis
        yAxisId="left"
        tickFormatter={formatCompact}
        tick={AXIS_TICK}
        stroke={CHART_COLORS.grid}
      />
      {rightAxis ? (
        <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} stroke={CHART_COLORS.grid} />
      ) : null}
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelFormatter={(label) => formatShortDate(String(label ?? ''))}
      />
    </>
  );
}

function TonnageTrendChart({
  daily,
  state,
  avgDailyTonnes,
}: SeriesChartProps & { avgDailyTonnes: number | null }) {
  return (
    <ChartCard
      title="30-Day Tonnage Trend"
      description="Daily coal and waste tonnes from shift logs, against the 30-day average daily total."
      state={state}
      className={WIDE_CARD_CLASS}
      legend={[
        { label: 'Coal (t)', color: CHART_COLORS.coal },
        { label: 'Waste (t)', color: CHART_COLORS.waste },
        { label: 'Total (t)', color: CHART_COLORS.total },
        { label: '30-day avg total', color: CHART_COLORS.muted },
      ]}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={[...daily]} margin={CHART_MARGIN}>
          <TimeAxes />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="coal"
            name="Coal (t)"
            stroke={CHART_COLORS.coal}
            strokeWidth={LINE_WIDTH}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="waste"
            name="Waste (t)"
            stroke={CHART_COLORS.waste}
            strokeWidth={LINE_WIDTH}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="total"
            name="Total (t)"
            stroke={CHART_COLORS.total}
            strokeWidth={LINE_WIDTH}
            dot={false}
          />
          {avgDailyTonnes === null ? null : (
            <ReferenceLine
              yAxisId="left"
              y={avgDailyTonnes}
              stroke={CHART_COLORS.muted}
              strokeDasharray={REFERENCE_DASH}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function DriftEfficiencyChart({ daily, state }: SeriesChartProps) {
  const tolerance = RECONCILIATION_THRESHOLDS.minor;
  return (
    <ChartCard
      title="Reconciliation Drift & Fuel Efficiency"
      description={`Daily drift % (left, ±${tolerance}% tolerance band) and fuel litres per tonne moved (right).`}
      state={state}
      legend={[
        { label: 'Drift %', color: CHART_COLORS.drift },
        { label: 'Fuel L/t', color: CHART_COLORS.efficiency },
      ]}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={[...daily]} margin={CHART_MARGIN}>
          <TimeAxes rightAxis />
          <ReferenceLine
            yAxisId="left"
            y={tolerance}
            stroke={CHART_COLORS.alert}
            strokeDasharray={REFERENCE_DASH}
          />
          <ReferenceLine
            yAxisId="left"
            y={-tolerance}
            stroke={CHART_COLORS.alert}
            strokeDasharray={REFERENCE_DASH}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="drift"
            name="Drift %"
            stroke={CHART_COLORS.drift}
            strokeWidth={LINE_WIDTH}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="fuelPerTonne"
            name="Fuel L/t"
            stroke={CHART_COLORS.efficiency}
            strokeWidth={LINE_WIDTH}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function FuelHoursChart({ daily, state }: SeriesChartProps) {
  return (
    <ChartCard
      title="Daily Diesel & Machine Hours"
      description="Fuel litres issued (left axis) and machine hours worked (right axis) per day."
      state={state}
      className={WIDE_CARD_CLASS}
      legend={[
        { label: 'Diesel (L)', color: CHART_COLORS.fuel },
        { label: 'Machine hours (h)', color: CHART_COLORS.hours },
      ]}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={[...daily]} margin={CHART_MARGIN}>
          <TimeAxes rightAxis />
          <Bar
            yAxisId="left"
            dataKey="fuelLitres"
            name="Diesel (L)"
            fill={CHART_COLORS.fuel}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="hours"
            name="Machine hours (h)"
            fill={CHART_COLORS.hours}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function MaterialSplitChart({ mtd, state }: { mtd: PeriodSummary; state: ChartState }) {
  const coalShare = mtd.total > 0 ? (mtd.coal / mtd.total) * PERCENT : null;
  return (
    <ChartCard
      title="Coal vs Waste (MTD)"
      description="Month-to-date split of material moved; centre shows the strip ratio (waste : coal)."
      state={state}
      legend={[
        { label: 'Coal', color: CHART_COLORS.coal, detail: formatPercent(coalShare) },
        {
          label: 'Waste',
          color: CHART_COLORS.waste,
          detail: formatPercent(coalShare === null ? null : PERCENT - coalShare),
        },
      ]}
    >
      <DonutChart
        centerValue={formatRatio(mtd.stripRatio)}
        centerLabel="Strip ratio"
        slices={[
          { label: 'Coal (t)', count: mtd.coal, color: CHART_COLORS.coal },
          { label: 'Waste (t)', count: mtd.waste, color: CHART_COLORS.waste },
        ]}
      />
    </ChartCard>
  );
}

export function ExecutiveProductionCharts({
  summaryAvailable,
  daily,
  mtd,
  avgDailyTonnes,
}: ProductionChartsProps) {
  const seriesState = chartStateFor(summaryAvailable, daily.length > 0);
  const splitState = chartStateFor(summaryAvailable, mtd.total > 0);
  return (
    <>
      <TonnageTrendChart daily={daily} state={seriesState} avgDailyTonnes={avgDailyTonnes} />
      <MaterialSplitChart mtd={mtd} state={splitState} />
      <FuelHoursChart daily={daily} state={seriesState} />
      <DriftEfficiencyChart daily={daily} state={seriesState} />
    </>
  );
}
