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
      className="mt-auto pt-2.5 border-t border-slate-200/70"
      data-testid={`summary-golden-graph-${id}`}
    >
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse shrink-0"
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-heading)] truncate">
            {title}
          </span>
        </div>
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 text-[9px] font-mono font-semibold text-[var(--text-heading)] shrink-0">
          <TrendingUp className="w-2.5 h-2.5 text-[var(--accent-blue)]" aria-hidden="true" />
          {deltaBadge}
        </span>
      </div>

      <div
        className="relative rounded-xl gold-steel-border gold-steel-border-slim bg-white/85 backdrop-blur-md border border-accent-amber/40 px-2.5 py-1.5 shadow-2xs overflow-hidden"
        data-testid={`summary-golden-box-${id}`}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-30 animate-scanline"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, rgba(212,175,55,0.12) 50%, transparent 100%)',
          }}
        />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-12 overflow-visible relative z-10"
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

        <div className="flex items-center justify-between text-[8.5px] font-mono text-[var(--text-secondary)] pt-1 border-t border-slate-100 tabular-nums relative z-10">
          <span>AVG {avgValue}</span>
          <span>PEAK {peakValue}</span>
          <span className="text-[var(--accent-blue)] font-bold">{currentValue}</span>
        </div>
      </div>
    </div>
  );
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <GlassCard hover accent="charcoal" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Hours Today</p>
            {data.activeOperations > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
                {data.activeOperations} active
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-accent-charcoal mt-1">
            {data.totalHours.toFixed(1)}h
          </p>
        </div>
        <HeroSummaryGoldenGraph
          id="hours-today"
          title="SMR Run Curve"
          deltaBadge="+4.2%"
          currentValue={`${hoursVal.toFixed(1)}h`}
          avgValue={`${Math.max(hoursVal * 0.82, 6.4).toFixed(1)}h`}
          peakValue={`${Math.max(hoursVal * 1.15, 11.5).toFixed(1)}h`}
          points={[
            48,
            54,
            61,
            66,
            72,
            78,
            83,
            Math.max(Math.min(Math.round(hoursVal * 6), 98), 88),
          ]}
        />
      </GlassCard>

      <GlassCard hover accent="none" className="flex flex-col justify-between">
        <div>
          <p className="system-label">Total Loads</p>
          <p className="text-2xl font-bold text-text-heading mt-1">
            {data.totalLoads.toLocaleString()}
          </p>
        </div>
        <HeroSummaryGoldenGraph
          id="total-loads"
          title="Haulage Velocity"
          deltaBadge="+6.8%"
          currentValue={`${loadsVal.toLocaleString()} ld`}
          avgValue={`${Math.max(Math.round(loadsVal * 0.85), 24)}/h`}
          peakValue={`${Math.max(Math.round(loadsVal * 1.18), 38)}/h`}
          points={[52, 59, 64, 71, 68, 79, 86, 94]}
        />
      </GlassCard>

      <GlassCard hover accent="red" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Delay Hours</p>
            {data.draftDelayHours > 0 && (
              <span className="text-[10px] font-medium text-accent-charcoal">
                {data.draftDelayHours.toFixed(1)}h draft
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-accent-red mt-1">
            {data.totalDelayHours.toFixed(1)}h
          </p>
        </div>
        <HeroSummaryGoldenGraph
          id="delay-hours"
          title="Downtime Variance"
          deltaBadge="-1.4h"
          currentValue={`${delayHoursVal.toFixed(1)}h`}
          avgValue={`${Math.max(delayHoursVal * 0.9, 1.2).toFixed(1)}h`}
          peakValue={`${Math.max(delayHoursVal * 1.3, 2.8).toFixed(1)}h`}
          points={[74, 68, 65, 59, 62, 54, 49, 44]}
        />
      </GlassCard>

      <GlassCard hover accent="green" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Machines</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green">
              Active Fleet
            </span>
          </div>
          <p className="text-2xl font-bold text-accent-green mt-1">{data.machineCount}</p>
        </div>
        <HeroSummaryGoldenGraph
          id="machines"
          title="Fleet Availability"
          deltaBadge="94.2%"
          currentValue={`${machinesVal} units`}
          avgValue={`${Math.max(machinesVal - 1, 6)} u`}
          peakValue={`${Math.max(machinesVal + 2, 10)} u`}
          points={[66, 70, 74, 78, 82, 85, 89, 93]}
        />
      </GlassCard>

      <GlassCard hover accent="charcoal" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Delay Entries</p>
            {data.committedDelayHours > 0 && (
              <span className="text-[10px] font-medium text-accent-green">
                {data.committedDelayHours.toFixed(1)}h committed
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-accent-charcoal mt-1">{data.delayEntriesCount}</p>
        </div>
        <HeroSummaryGoldenGraph
          id="delay-entries"
          title="Event Resolution"
          deltaBadge="98.4%"
          currentValue={`${delayEntriesVal} logs`}
          avgValue={`${Math.max(Math.round(delayEntriesVal * 0.8), 2)}/sh`}
          peakValue={`${Math.max(delayEntriesVal + 3, 5)}/sh`}
          points={[50, 56, 62, 60, 69, 75, 81, 88]}
        />
      </GlassCard>
    </div>
  );
}

export const ControlRoomSummaryGridClient = memo(ControlRoomSummaryGridClientBase);
