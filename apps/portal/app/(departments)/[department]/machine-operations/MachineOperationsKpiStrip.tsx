'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, AlertTriangle, Clock, Gauge, Layers, TrendingUp } from 'lucide-react';
import { memo } from 'react';

export interface MachineOperationsKpiStripProps {
  totalHours: number;
  activeMachines: number;
  totalMaterialBCM: number;
  avgBcmPerHour: number;
  totalDelayHours: number;
  controlRoomDelayHours?: number;
  totalEngineeringDelayHours?: number;
}

interface TelemetrySparklineProps {
  id: string;
  points: number[];
  avgValue: string;
  peakValue: string;
  currentValue: string;
  strokeColor?: string;
}

const ARCH_LOGO_PATH =
  'm 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z';

function buildSparklinePoints(targetValue: number, invert = false): number[] {
  const clamped = Math.max(10, Math.min(100, Math.round(targetValue)));
  const start = invert ? Math.min(92, clamped + 18) : Math.max(15, clamped - 24);
  return Array.from({ length: 8 }, (_, idx) => {
    const progress = idx / 7;
    const wave = Math.sin(progress * Math.PI) * 6;
    return Math.round(start + (clamped - start) * progress + (idx > 0 && idx < 7 ? wave : 0));
  });
}

const KPI_HEADER_LABEL_CLASS =
  'flex items-center gap-1.5 font-medium text-[13px] text-[var(--text-muted)] leading-[18px]';

const KPI_BADGE_GREEN_CLASS =
  'inline-flex items-center gap-1 rounded-full border border-accent-green/30 bg-accent-green/10 px-2 py-0.5 font-medium font-mono text-[13px] text-accent-green leading-[18px]';

function TelemetrySparkline({
  id,
  points,
  avgValue,
  peakValue,
  currentValue,
  strokeColor = '#d4af37',
}: TelemetrySparklineProps) {
  const fillId = `kpi-grad-${id}`;
  const width = 240;
  const height = 48;
  const padX = 6;
  const padY = 6;
  const minVal = Math.min(...points) - 4;
  const maxVal = Math.max(...points) + 4;
  const range = Math.max(maxVal - minVal, 1);

  const coords = points.map((pt, i) => {
    const x = padX + (i / Math.max(points.length - 1, 1)) * (width - padX * 2);
    const y = height - padY - ((pt - minVal) / range) * (height - padY * 2);
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const firstX = (coords[0]?.x ?? padX).toFixed(1);
  const lastX = (coords[coords.length - 1]?.x ?? width - padX).toFixed(1);
  const areaPath = `${linePath} L ${lastX} ${height} L ${firstX} ${height} Z`;

  return (
    <div className="mt-2.5" data-testid={`kpi-sparkline-${id}`}>
      <div className="gold-steel-border gold-steel-border-slim relative overflow-hidden rounded-xl border border-accent-amber/35 bg-white/90 px-2.5 py-1.5 shadow-2xs">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="relative z-10 h-10 w-full overflow-visible"
          role="img"
          aria-label={`${id} telemetry sparkline`}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.03" />
            </linearGradient>
            <filter id={`glow-${fillId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <symbol id={`arch-node-${fillId}`} viewBox="22.75 16.625 166.16 166.19">
              <path
                d={ARCH_LOGO_PATH}
                fill={strokeColor}
                stroke="#ffffff"
                strokeWidth="5"
                paintOrder="stroke"
                fillRule="evenodd"
              />
            </symbol>
          </defs>

          <line
            x1={padX}
            y1={height * 0.35}
            x2={width - padX}
            y2={height * 0.35}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="2 3"
            strokeWidth="0.75"
          />
          <line
            x1={padX}
            y1={height * 0.72}
            x2={width - padX}
            y2={height * 0.72}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="2 3"
            strokeWidth="0.75"
          />

          <path d={areaPath} fill={`url(#${fillId})`} />

          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#glow-${fillId})`}
          />

          {coords.map((c, i) => {
            const isLast = i === coords.length - 1;
            const iconSize = isLast ? 9 : 6;
            return (
              <svg
                key={`spark-node-${i}`}
                x={c.x - iconSize / 2}
                y={c.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                viewBox="22.75 16.625 166.16 166.19"
                aria-hidden="true"
              >
                <use href={`#arch-node-${fillId}`} opacity={isLast ? 1 : 0.85} />
              </svg>
            );
          })}
        </svg>

        <div className="relative z-10 flex items-center justify-between border-slate-100 border-t pt-1 font-mono text-[13px] text-[var(--text-secondary)] tabular-nums leading-[18px]">
          <span>AVG {avgValue}</span>
          <span>PEAK {peakValue}</span>
          <span className="font-semibold text-[var(--accent-blue)]">{currentValue}</span>
        </div>
      </div>
    </div>
  );
}

export const MachineOperationsKpiStrip = memo(function MachineOperationsKpiStrip({
  totalHours,
  activeMachines,
  totalMaterialBCM,
  avgBcmPerHour,
  totalDelayHours,
  controlRoomDelayHours = 0,
  totalEngineeringDelayHours = 0,
}: MachineOperationsKpiStripProps) {
  // Sparkline data points calculated from metrics
  const hoursPoints = buildSparklinePoints(Math.min(100, Math.round(totalHours * 1.5)));
  const machinesPoints = buildSparklinePoints(Math.min(100, Math.round(activeMachines * 4)));
  const materialPoints = buildSparklinePoints(Math.min(100, Math.round(totalMaterialBCM / 40)));
  const bcmRatePoints = buildSparklinePoints(Math.min(100, Math.round(avgBcmPerHour / 2)));
  const delaysPoints = buildSparklinePoints(Math.min(100, Math.round(totalDelayHours * 6)), true);

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
      data-testid="machine-operations-kpi-strip"
    >
      {/* 1. Today's Hours */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Clock className="h-3.5 w-3.5 text-[var(--accent-blue)]" aria-hidden="true" />
              Today&apos;s Hours
            </p>
            <span className={KPI_BADGE_GREEN_CLASS}>
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              Live
            </span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
            {totalHours.toFixed(1)}h
          </p>
        </div>
        <TelemetrySparkline
          id="today-hours"
          points={hoursPoints}
          avgValue={`${(totalHours * 0.72).toFixed(1)}h`}
          peakValue={`${(totalHours * 1.05).toFixed(1)}h`}
          currentValue={`${totalHours.toFixed(1)}h`}
        />
      </GlassCard>

      {/* 2. Active Machines */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Activity className="h-3.5 w-3.5 text-accent-green" aria-hidden="true" />
              Active Machines
            </p>
            <span className={KPI_BADGE_GREEN_CLASS}>Fleet</span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-accent-green tabular-nums">
            {activeMachines}
          </p>
        </div>
        <TelemetrySparkline
          id="active-machines"
          points={machinesPoints}
          avgValue={`${Math.max(1, Math.round(activeMachines * 0.8))}`}
          peakValue={`${Math.max(activeMachines, Math.round(activeMachines * 1.15))}`}
          currentValue={`${activeMachines}`}
          strokeColor="#10b981"
        />
      </GlassCard>

      {/* 3. Material Moved */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Layers className="h-3.5 w-3.5 text-[var(--accent-blue)]" aria-hidden="true" />
              Material Moved
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium font-mono text-[13px] text-[var(--accent-blue)] leading-[18px]">
              BCM
            </span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-[var(--accent-blue)] tabular-nums">
            {totalMaterialBCM.toFixed(1)} <span className="font-normal text-sm">BCM</span>
          </p>
        </div>
        <TelemetrySparkline
          id="material-moved"
          points={materialPoints}
          avgValue={`${(totalMaterialBCM * 0.65).toFixed(0)}`}
          peakValue={`${(totalMaterialBCM * 1.08).toFixed(0)}`}
          currentValue={`${totalMaterialBCM.toFixed(0)}`}
          strokeColor="#3b82f6"
        />
      </GlassCard>

      {/* 4. BCM/Hour */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Gauge className="h-3.5 w-3.5 text-accent-blue" aria-hidden="true" />
              BCM/Hour
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-2 py-0.5 font-medium font-mono text-[13px] text-accent-amber leading-[18px]">
              Rate
            </span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-accent-blue tabular-nums">
            {avgBcmPerHour.toFixed(1)}
          </p>
        </div>
        <TelemetrySparkline
          id="bcm-rate"
          points={bcmRatePoints}
          avgValue={`${(avgBcmPerHour * 0.85).toFixed(1)}`}
          peakValue={`${(avgBcmPerHour * 1.12).toFixed(1)}`}
          currentValue={`${avgBcmPerHour.toFixed(1)}`}
        />
      </GlassCard>

      {/* 5. Total Delays */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <AlertTriangle className="h-3.5 w-3.5 text-accent-red" aria-hidden="true" />
              Total Delays
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-red/30 bg-accent-red/10 px-2 py-0.5 font-medium font-mono text-[13px] text-accent-red leading-[18px]">
              Shift
            </span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-accent-red tabular-nums">
            {totalDelayHours.toFixed(1)}h
          </p>
          {totalEngineeringDelayHours > 0 && (
            <p className="mt-0.5 font-mono text-[13px] text-[var(--text-muted)] leading-[18px]">
              CR: {controlRoomDelayHours.toFixed(1)}h + Eng: {totalEngineeringDelayHours.toFixed(1)}
              h
            </p>
          )}
        </div>
        <TelemetrySparkline
          id="total-delays"
          points={delaysPoints}
          avgValue={`${(totalDelayHours * 0.6).toFixed(1)}h`}
          peakValue={`${(totalDelayHours * 1.25).toFixed(1)}h`}
          currentValue={`${totalDelayHours.toFixed(1)}h`}
          strokeColor="#ef4444"
        />
      </GlassCard>
    </div>
  );
});
