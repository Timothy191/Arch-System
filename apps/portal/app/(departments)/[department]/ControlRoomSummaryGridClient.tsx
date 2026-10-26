'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { TrendingUp } from 'lucide-react';
import { memo } from 'react';
import { useControlRoomSummary } from '@/hooks/useDashboardQueries';

interface ControlRoomSummaryGridClientProps {
  deptId: string;
  today: string;
}

interface GoldenGraphProps {
  id: string;
  title: string;
  deltaBadge: string;
  currentValue: string;
  avgValue: string;
  peakValue: string;
  points: number[];
}

const ARCH_LOGO_PATH =
  'm 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z';

function HeroSummaryGoldenGraph({
  id,
  title,
  deltaBadge,
  currentValue,
  avgValue,
  peakValue,
  points,
}: GoldenGraphProps) {
  const strokeColor = '#d4af37';
  const fillId = `cr-gold-grad-${id}`;
  const width = 260;
  const height = 56;
  const padX = 6;
  const padY = 7;
  const minVal = Math.min(...points) - 6;
  const maxVal = Math.max(...points) + 4;
  const range = Math.max(maxVal - minVal, 1);

  const coords = points.map((pt, i) => {
    const x = padX + (i / Math.max(points.length - 1, 1)) * (width - padX * 2);
    const y = height - padY - ((pt - minVal) / range) * (height - padY * 2);
    return { x, y, val: pt };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const firstX = (coords[0]?.x ?? padX).toFixed(1);
  const lastX = (coords[coords.length - 1]?.x ?? width - padX).toFixed(1);
  const areaPath = `${linePath} L ${lastX} ${height} L ${firstX} ${height} Z`;

  return (
    <div
      className="mt-auto border-slate-200/70 border-t pt-2.5"
      data-testid={`summary-golden-graph-${id}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent-green"
            aria-hidden="true"
          />
          <span className="truncate font-bold text-[10px] text-[var(--text-heading)] uppercase tracking-wider">
            {title}
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-[var(--text-heading)]">
          <TrendingUp className="h-2.5 w-2.5 text-[var(--accent-blue)]" aria-hidden="true" />
          {deltaBadge}
        </span>
      </div>

      <div
        className="gold-steel-border gold-steel-border-slim relative overflow-hidden rounded-xl border border-accent-amber/40 bg-white/85 px-2.5 py-1.5 shadow-2xs backdrop-blur-md"
        data-testid={`summary-golden-box-${id}`}
      >
        <div
          className="pointer-events-none absolute inset-0 animate-scanline opacity-30"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, rgba(212,175,55,0.12) 50%, transparent 100%)',
          }}
        />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="relative z-10 h-12 w-full overflow-visible"
          role="img"
          aria-label={`${title} golden telemetry trend graph`}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.34" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.03" />
            </linearGradient>
            <filter id={`glow-${fillId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <line
            x1={padX}
            y1={height * 0.28}
            x2={width - padX}
            y2={height * 0.28}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="3 3"
            strokeWidth="0.75"
          />
          <line
            x1={padX}
            y1={height * 0.65}
            x2={width - padX}
            y2={height * 0.65}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="3 3"
            strokeWidth="0.75"
          />

          {coords.map((c, i) => {
            const barHeight = Math.max(height - padY - c.y, 4);
            return (
              <rect
                key={i}
                x={c.x - 3.5}
                y={c.y}
                width={7}
                height={barHeight}
                rx={1.5}
                fill={strokeColor}
                fillOpacity={i === coords.length - 1 ? 0.26 : 0.1}
                className={i === coords.length - 1 ? 'motion-safe:animate-pulse' : ''}
              />
            );
          })}

          <path d={areaPath} fill={`url(#${fillId})`} />

          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#glow-${fillId})`}
          />

          {coords.map((c, i) => {
            const isLast = i === coords.length - 1;
            const iconSize = isLast ? 10 : 7;
            return (
              <svg
                key={i}
                x={c.x - iconSize / 2}
                y={c.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                viewBox="22.75 16.625 166.16 166.19"
                aria-hidden="true"
                data-testid="summary-graph-arch-node"
                className={isLast ? 'motion-safe:animate-pulse' : ''}
              >
                <path
                  d={ARCH_LOGO_PATH}
                  fill={strokeColor}
                  fillOpacity={isLast ? 1 : 0.9}
                  stroke="#ffffff"
                  strokeWidth="6"
                  paintOrder="stroke"
                  fillRule="evenodd"
                />
              </svg>
            );
          })}
        </svg>

        <div className="relative z-10 flex items-center justify-between border-slate-100 border-t pt-1 font-mono text-[8.5px] text-[var(--text-secondary)] tabular-nums">
          <span>AVG {avgValue}</span>
          <span>PEAK {peakValue}</span>
          <span className="font-bold text-[var(--accent-blue)]">{currentValue}</span>
        </div>
      </div>
    </div>
  );
}

function buildSparklinePoints(currentRatio: number, invert = false): number[] {
  const clamped = Math.max(25, Math.min(98, Math.round(currentRatio)));
  const start = invert ? Math.min(92, clamped + 22) : Math.max(25, clamped - 28);
  return Array.from({ length: 8 }, (_, idx) => {
    const progress = idx / 7;
    return Math.round(start + (clamped - start) * progress);
  });
}

// AGENT-TRACE: Memoized to prevent re-renders when parent Dashboard re-renders.
// Props (deptId, today) are stable strings — re-renders only from React Query data updates.
function ControlRoomSummaryGridClientBase({ deptId, today }: ControlRoomSummaryGridClientProps) {
  const { data } = useControlRoomSummary(deptId, today);

  if (!data) return null;

  const hoursVal = Math.max(data.totalHours, 0);
  const loadsVal = Math.max(data.totalLoads, 0);
  const delayHoursVal = Math.max(data.totalDelayHours, 0);
  const machinesVal = Math.max(data.machineCount, 0);
  const delayEntriesVal = Math.max(data.delayEntriesCount, 0);

  const shiftCapacityHours = Math.max(machinesVal * 12, 12);
  const hoursAttainmentPct = Math.min(100, Math.round((hoursVal / shiftCapacityHours) * 100));
  const loadsPerHour = hoursVal > 0 ? Math.round(loadsVal / hoursVal) : Math.round(loadsVal / 12);
  const availabilityPct =
    hoursVal + delayHoursVal > 0
      ? Math.round((hoursVal / (hoursVal + delayHoursVal)) * 1000) / 10
      : machinesVal > 0
        ? 100
        : 0;
  const committedRatioPct =
    delayHoursVal > 0
      ? Math.round((Math.max(data.committedDelayHours, 0) / delayHoursVal) * 1000) / 10
      : 100;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <GlassCard hover accent="charcoal" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Hours Today</p>
            {data.activeOperations > 0 && (
              <span className="rounded bg-[var(--accent-blue)]/10 px-1.5 py-0.5 font-semibold text-[10px] text-[var(--accent-blue)]">
                {data.activeOperations} active
              </span>
            )}
          </div>
          <p className="mt-1 font-bold text-2xl text-accent-charcoal">
            {data.totalHours.toFixed(1)}h
          </p>
        </div>
        <HeroSummaryGoldenGraph
          id="hours-today"
          title="SMR Run Curve"
          deltaBadge={`${hoursAttainmentPct}% cap`}
          currentValue={`${hoursVal.toFixed(1)}h`}
          avgValue={`${(hoursVal / Math.max(machinesVal, 1)).toFixed(1)}h/u`}
          peakValue={`${shiftCapacityHours}h cap`}
          points={buildSparklinePoints(Math.max(hoursAttainmentPct, 35))}
        />
      </GlassCard>

      <GlassCard hover accent="none" className="flex flex-col justify-between">
        <div>
          <p className="system-label">Total Loads</p>
          <p className="mt-1 font-bold text-2xl text-text-heading">
            {data.totalLoads.toLocaleString()}
          </p>
        </div>
        <HeroSummaryGoldenGraph
          id="total-loads"
          title="Haulage Velocity"
          deltaBadge={`${loadsPerHour}/h`}
          currentValue={`${loadsVal.toLocaleString()} ld`}
          avgValue={`${loadsPerHour}/h`}
          peakValue={`${Math.round(loadsVal * 25).toLocaleString()} BCM`}
          points={buildSparklinePoints(
            Math.min(96, Math.max(35, Math.round((loadsVal / 180) * 100)))
          )}
        />
      </GlassCard>

      <GlassCard hover accent="red" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Delay Hours</p>
            {data.draftDelayHours > 0 && (
              <span className="font-medium text-[10px] text-accent-charcoal">
                {data.draftDelayHours.toFixed(1)}h draft
              </span>
            )}
          </div>
          <p className="mt-1 font-bold text-2xl text-accent-red">
            {data.totalDelayHours.toFixed(1)}h
          </p>
        </div>
        <HeroSummaryGoldenGraph
          id="delay-hours"
          title="Downtime Variance"
          deltaBadge={`${data.committedDelayHours.toFixed(1)}h lock`}
          currentValue={`${delayHoursVal.toFixed(1)}h`}
          avgValue={`${(delayHoursVal / Math.max(delayEntriesVal, 1)).toFixed(1)}h/ev`}
          peakValue={`${data.draftDelayHours.toFixed(1)}h open`}
          points={buildSparklinePoints(Math.max(30, 90 - Math.round(delayHoursVal * 5)), true)}
        />
      </GlassCard>

      <GlassCard hover accent="green" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Machines</p>
            <span className="rounded bg-accent-green/10 px-1.5 py-0.5 font-semibold text-[10px] text-accent-green">
              Active Fleet
            </span>
          </div>
          <p className="mt-1 font-bold text-2xl text-accent-green">{data.machineCount}</p>
        </div>
        <HeroSummaryGoldenGraph
          id="machines"
          title="Fleet Availability"
          deltaBadge={`${availabilityPct.toFixed(1)}%`}
          currentValue={`${machinesVal} units`}
          avgValue={`${data.activeOperations} open`}
          peakValue={`${machinesVal} reg`}
          points={buildSparklinePoints(availabilityPct)}
        />
      </GlassCard>

      <GlassCard hover accent="charcoal" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Delay Entries</p>
            {data.committedDelayHours > 0 && (
              <span className="font-medium text-[10px] text-accent-green">
                {data.committedDelayHours.toFixed(1)}h committed
              </span>
            )}
          </div>
          <p className="mt-1 font-bold text-2xl text-accent-charcoal">{data.delayEntriesCount}</p>
        </div>
        <HeroSummaryGoldenGraph
          id="delay-entries"
          title="Event Resolution"
          deltaBadge={`${committedRatioPct.toFixed(0)}%`}
          currentValue={`${delayEntriesVal} logs`}
          avgValue={`${data.committedDelayHours.toFixed(1)}h com`}
          peakValue={`${data.draftDelayHours.toFixed(1)}h drf`}
          points={buildSparklinePoints(committedRatioPct)}
        />
      </GlassCard>
    </div>
  );
}

export const ControlRoomSummaryGridClient = memo(ControlRoomSummaryGridClientBase);
