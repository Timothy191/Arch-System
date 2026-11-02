'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { Activity, Layers, TrendingUp, Truck } from 'lucide-react';
import { memo } from 'react';

export interface ExcavatorActivityTelemetryOverviewProps {
  readonly totalBcm: number;
  readonly totalLoads: number;
  readonly activeExcavators: number;
  readonly fleetExcavatorsCount: number;
  readonly wasteLoads: number;
  readonly coalLoads: number;
  readonly plantUnitsCount: number;
  readonly otherUnitsCount: number;
  readonly targetBcm?: number;
  readonly targetLoads?: number;
}

interface GoldenTelemetryGraphProps {
  readonly id: string;
  readonly title: string;
  readonly pctBadge: string;
  readonly currentValue: string;
  readonly avgValue: string;
  readonly peakValue: string;
  readonly points: readonly number[];
}

const ARCH_LOGO_PATH =
  'm 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z';

const GOLDEN_SEPARATOR_CLASS =
  'h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent';

const GOLDEN_LABEL_PILL_CLASS =
  'system-label gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-full border border-accent-amber/40 bg-white/85 px-2.5 py-0.5 shadow-2xs';

const TALLY_PILL_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-full border border-accent-amber/35 bg-white/85 px-2.5 py-1 font-mono font-semibold text-[11px] text-[var(--text-heading)] tabular-nums shadow-2xs';

const DEFAULT_SHIFT_BCM_TARGET = 5400;
const DEFAULT_SHIFT_LOADS_TARGET = 180;
const CHART_WIDTH = 260;
const CHART_HEIGHT = 56;
const CHART_PAD_X = 6;
const CHART_PAD_Y = 7;

function buildSparklinePoints(currentRatio: number): number[] {
  const clamped = Math.max(25, Math.min(98, Math.round(currentRatio)));
  const start = Math.max(22, clamped - 26);
  return Array.from({ length: 8 }, (_, idx) => {
    const progress = idx / 7;
    return Math.round(start + (clamped - start) * progress);
  });
}

function ExcavatorGoldenGraph({
  id,
  title,
  pctBadge,
  currentValue,
  avgValue,
  peakValue,
  points,
}: GoldenTelemetryGraphProps) {
  const strokeColor = '#d4af37';
  const fillId = `exc-gold-grad-${id}`;
  const minVal = Math.min(...points) - 6;
  const maxVal = Math.max(...points) + 4;
  const range = Math.max(maxVal - minVal, 1);

  const coords = points.map((pt, i) => {
    const x = CHART_PAD_X + (i / Math.max(points.length - 1, 1)) * (CHART_WIDTH - CHART_PAD_X * 2);
    const y =
      CHART_HEIGHT - CHART_PAD_Y - ((pt - minVal) / range) * (CHART_HEIGHT - CHART_PAD_Y * 2);
    return { x, y, val: pt };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const firstX = (coords[0]?.x ?? CHART_PAD_X).toFixed(1);
  const lastX = (coords[coords.length - 1]?.x ?? CHART_WIDTH - CHART_PAD_X).toFixed(1);
  const areaPath = `${linePath} L ${lastX} ${CHART_HEIGHT} L ${firstX} ${CHART_HEIGHT} Z`;

  return (
    <div className="mt-auto pt-2.5" data-testid={`excavator-golden-graph-${id}`}>
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
          {pctBadge}
        </span>
      </div>

      <div
        className="gold-steel-border gold-steel-border-slim relative overflow-hidden rounded-xl border border-accent-amber/40 bg-white/85 px-2.5 py-1.5 shadow-2xs backdrop-blur-md"
        data-testid={`excavator-golden-box-${id}`}
      >
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="relative z-10 h-12 w-full overflow-visible"
          role="img"
          aria-label={`${title} golden telemetry trend graph`}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.34" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.03" />
            </linearGradient>
          </defs>

          <line
            x1={CHART_PAD_X}
            y1={CHART_HEIGHT * 0.28}
            x2={CHART_WIDTH - CHART_PAD_X}
            y2={CHART_HEIGHT * 0.28}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="3 3"
            strokeWidth="0.75"
          />
          <line
            x1={CHART_PAD_X}
            y1={CHART_HEIGHT * 0.65}
            x2={CHART_WIDTH - CHART_PAD_X}
            y2={CHART_HEIGHT * 0.65}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="3 3"
            strokeWidth="0.75"
          />

          {coords.map((c, i) => {
            const barHeight = Math.max(CHART_HEIGHT - CHART_PAD_Y - c.y, 4);
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
                data-testid="excavator-graph-arch-node"
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
          <span>TARGET {peakValue}</span>
          <span className="font-bold text-[var(--accent-blue)]">{currentValue}</span>
        </div>
      </div>
    </div>
  );
}

function ExcavatorActivityTelemetryOverviewBase({
  totalBcm,
  totalLoads,
  activeExcavators,
  fleetExcavatorsCount,
  wasteLoads,
  coalLoads,
  plantUnitsCount,
  otherUnitsCount,
  targetBcm = DEFAULT_SHIFT_BCM_TARGET,
  targetLoads = DEFAULT_SHIFT_LOADS_TARGET,
}: ExcavatorActivityTelemetryOverviewProps) {
  const safeTargetBcm = Math.max(targetBcm, 1);
  const safeTargetLoads = Math.max(targetLoads, 1);
  const safeFleetCount = Math.max(fleetExcavatorsCount, 1);

  const bcmAttainmentPct = Math.min(100, Math.round((totalBcm / safeTargetBcm) * 1000) / 10);
  const loadsAttainmentPct = Math.min(100, Math.round((totalLoads / safeTargetLoads) * 1000) / 10);
  const activeFleetPct = Math.min(100, Math.round((activeExcavators / safeFleetCount) * 1000) / 10);

  const avgBcmPerExcavator =
    activeExcavators > 0 ? totalBcm / activeExcavators : totalBcm / safeFleetCount;
  const avgLoadsPerExcavator =
    activeExcavators > 0 ? totalLoads / activeExcavators : totalLoads / safeFleetCount;

  return (
    <div className="space-y-6">
      {/* Item 5: Full-window extended header panel with Golden Separator & Global Combined Tally */}
      <div
        className="flex w-full items-center justify-between"
        data-testid="excavator-activity-header-row"
      >
        <div className="gold-steel-border gold-steel-border-slim w-full rounded-xl bg-white/80 px-4 py-3 shadow-2xs backdrop-blur-md">
          <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2.5">
              <Logo variant="gold" className="h-5 w-5 shrink-0" />
              <h2 className="font-medium text-[var(--text-heading)] text-fluid-2xl">
                Excavator Activity
              </h2>
            </div>

            {/* Global Combined Tally Strip */}
            <div
              className="flex flex-wrap items-center gap-2"
              data-testid="excavator-global-combined-tally"
              aria-label="Global Combined Excavator Tally"
            >
              <span className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Global Combined Tally:
              </span>
              <span className={TALLY_PILL_CLASS}>
                <Layers className="h-3 w-3 text-accent-green" />
                {totalBcm.toFixed(1)} BCM ({bcmAttainmentPct.toFixed(1)}%)
              </span>
              <span className={TALLY_PILL_CLASS}>
                <Truck className="h-3 w-3 text-[var(--accent-blue)]" />
                {totalLoads.toLocaleString()} Loads (W: {wasteLoads} · C: {coalLoads})
              </span>
              <span className={TALLY_PILL_CLASS}>
                <Activity className="h-3 w-3 text-accent-amber" />
                {activeExcavators}/{fleetExcavatorsCount} Active ({activeFleetPct.toFixed(0)}%)
                {(plantUnitsCount > 0 || otherUnitsCount > 0) &&
                  ` · Plant: ${plantUnitsCount} · Other: ${otherUnitsCount}`}
              </span>
            </div>
          </div>

          <div
            data-testid="excavator-header-golden-separator"
            aria-hidden="true"
            className={`mt-2.5 ${GOLDEN_SEPARATOR_CLASS}`}
          />
        </div>
      </div>

      {/* Items 6-11: 3 Redesigned KPI Cards with Golden Bordering on Labels, % Badges, Separators & Golden Graphs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Total BCM */}
        <GlassCard hover accent="green" className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={GOLDEN_LABEL_PILL_CLASS}>Total BCM</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="mt-1 font-bold text-2xl text-accent-green">{totalBcm.toFixed(1)}</p>
                  <span
                    data-testid="total-bcm-pct-badge"
                    className="rounded-full border border-accent-green/30 bg-accent-green/12 px-2 py-0.5 font-mono font-semibold text-[11px] text-accent-green tabular-nums"
                  >
                    {bcmAttainmentPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div
              data-testid="excavator-kpi-separator-total-bcm"
              aria-hidden="true"
              className={`mt-2 ${GOLDEN_SEPARATOR_CLASS}`}
            />
          </div>
          <ExcavatorGoldenGraph
            id="total-bcm"
            title="Volume Moved Curve"
            pctBadge={`${bcmAttainmentPct.toFixed(1)}% target`}
            currentValue={`${totalBcm.toFixed(1)} BCM`}
            avgValue={`${avgBcmPerExcavator.toFixed(1)}/ex`}
            peakValue={`${safeTargetBcm.toLocaleString()} BCM`}
            points={buildSparklinePoints(Math.max(bcmAttainmentPct, 32))}
          />
        </GlassCard>

        {/* Card 2: Total Loads */}
        <GlassCard hover accent="blue" className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={GOLDEN_LABEL_PILL_CLASS}>Total Loads</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="mt-1 font-bold text-2xl text-accent-green">
                    {totalLoads.toLocaleString()}
                  </p>
                  <span
                    data-testid="total-loads-pct-badge"
                    className="rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/12 px-2 py-0.5 font-mono font-semibold text-[11px] text-[var(--accent-blue)] tabular-nums"
                  >
                    {loadsAttainmentPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div
              data-testid="excavator-kpi-separator-total-loads"
              aria-hidden="true"
              className={`mt-2 ${GOLDEN_SEPARATOR_CLASS}`}
            />
          </div>
          <ExcavatorGoldenGraph
            id="total-loads"
            title="Haulage Loads Velocity"
            pctBadge={`${loadsAttainmentPct.toFixed(1)}% target`}
            currentValue={`${totalLoads.toLocaleString()} ld`}
            avgValue={`${avgLoadsPerExcavator.toFixed(1)}/ex`}
            peakValue={`${safeTargetLoads} ld`}
            points={buildSparklinePoints(Math.max(loadsAttainmentPct, 35))}
          />
        </GlassCard>

        {/* Card 3: Active Excavators */}
        <GlassCard hover accent="cyan" className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={GOLDEN_LABEL_PILL_CLASS}>Active Excavators</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="mt-1 font-bold text-2xl text-[var(--accent-green)]">
                    {activeExcavators}
                  </p>
                  <span
                    data-testid="active-excavators-pct-badge"
                    className="rounded-full border border-accent-amber/40 bg-accent-amber/12 px-2 py-0.5 font-mono font-semibold text-[11px] text-[var(--text-heading)] tabular-nums"
                  >
                    {activeFleetPct.toFixed(1)}% ({activeExcavators}/{fleetExcavatorsCount})
                  </span>
                </div>
              </div>
            </div>
            <div
              data-testid="excavator-kpi-separator-active-excavators"
              aria-hidden="true"
              className={`mt-2 ${GOLDEN_SEPARATOR_CLASS}`}
            />
          </div>
          <ExcavatorGoldenGraph
            id="active-excavators"
            title="Fleet Deployment Rate"
            pctBadge={`${activeFleetPct.toFixed(1)}% active`}
            currentValue={`${activeExcavators} active`}
            avgValue={`${plantUnitsCount + otherUnitsCount} aux`}
            peakValue={`${fleetExcavatorsCount} fleet`}
            points={buildSparklinePoints(Math.max(activeFleetPct, 38))}
          />
        </GlassCard>
      </div>
    </div>
  );
}

export const ExcavatorActivityTelemetryOverview = memo(ExcavatorActivityTelemetryOverviewBase);
