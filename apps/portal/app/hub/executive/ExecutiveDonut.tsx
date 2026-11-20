'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DONUT_HEIGHT, TOOLTIP_STYLE } from './chart-theme';

export interface DonutSlice {
  label: string;
  count: number;
  color: string;
}

interface DonutChartProps {
  slices: readonly DonutSlice[];
  centerValue: string;
  centerLabel: string;
}

const INNER_RADIUS = '62%';
const OUTER_RADIUS = '88%';
const PADDING_ANGLE = 2;

/** Donut chart with a centred headline figure; slices with zero count are omitted. */
export function DonutChart({ slices, centerValue, centerLabel }: DonutChartProps) {
  const visible = slices.filter((slice) => slice.count > 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={DONUT_HEIGHT}>
        <PieChart>
          <Pie
            data={visible}
            dataKey="count"
            nameKey="label"
            innerRadius={INNER_RADIUS}
            outerRadius={OUTER_RADIUS}
            paddingAngle={PADDING_ANGLE}
            stroke="var(--bg-primary)"
            isAnimationActive={false}
          >
            {visible.map((slice) => (
              <Cell key={slice.label} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold text-[var(--text-heading)] text-xl tabular-nums">
          {centerValue}
        </span>
        <span className="text-[var(--text-muted)] text-xs">{centerLabel}</span>
      </div>
    </div>
  );
}
