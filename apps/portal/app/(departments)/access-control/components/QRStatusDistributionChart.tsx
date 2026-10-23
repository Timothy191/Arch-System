'use client';

import { RadialBar, RadialBarChart, ResponsiveContainer, Tooltip } from 'recharts';

interface QRStatusDistributionChartProps {
  data: Array<{ name: string; value: number; fill: string }>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; fill: string } }>;
  totalValue: number;
}

function CustomTooltip({ active, payload, totalValue }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const d = payload[0].payload;
  const pct = totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : '0.0';
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card">
      <div className="mb-0.5 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
        <span className="font-semibold text-foreground">{d.name}</span>
      </div>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">
          {d.value.toLocaleString()}
        </span>{' '}
        codes ({pct}%)
      </p>
    </div>
  );
}

export default function QRStatusDistributionChart({ data }: QRStatusDistributionChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="90%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={4}
            background={{ fill: 'hsl(var(--secondary))' }}
          />
          <Tooltip content={<CustomTooltip totalValue={total} />} />
        </RadialBarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="mt-1 grid w-full grid-cols-2 gap-x-6 gap-y-2">
        {data.map((d) => (
          <div key={`legend-${d.name}`} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.fill }}
            />
            <div className="min-w-0">
              <p className="truncate text-[10px] text-muted-foreground">{d.name}</p>
              <p className="font-bold text-foreground text-xs tabular-nums">
                {d.value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
