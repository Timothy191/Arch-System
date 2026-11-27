'use client';

import { ARCH_LOGO_PATH, ARCH_LOGO_VIEWBOX } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { useId } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Colour comes from `currentColor`; pass a semantic token class such as `text-accent-gold`. */
  className?: string;
  isFluidWidth?: boolean;
  /** When provided the chart is exposed to assistive tech as `role="img"`. */
  ariaLabel?: string;
}

interface SparkPoint {
  readonly x: number;
  readonly y: number;
  readonly value: number;
}

const SPLINE_TENSION = 0.2;
const PADDING_Y_PX = 5;

function buildSmoothSparklinePath(points: readonly SparkPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const onlyPoint = points[0];
    return onlyPoint ? `M ${onlyPoint.x.toFixed(1)} ${onlyPoint.y.toFixed(1)}` : '';
  }

  const commands: string[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    if (!current) continue;
    if (index === 0) {
      commands.push(`M ${current.x.toFixed(1)} ${current.y.toFixed(1)}`);
      continue;
    }

    const prevPrev = points[Math.max(0, index - 2)] ?? current;
    const prev = points[index - 1] ?? current;
    const next = points[Math.min(points.length - 1, index + 1)] ?? current;

    const cp1x = prev.x + (current.x - prevPrev.x) * SPLINE_TENSION;
    const cp1y = prev.y + (current.y - prevPrev.y) * SPLINE_TENSION;
    const cp2x = current.x - (next.x - prev.x) * SPLINE_TENSION;
    const cp2y = current.y - (next.y - prev.y) * SPLINE_TENSION;

    commands.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${current.x.toFixed(1)} ${current.y.toFixed(1)}`
    );
  }
  return commands.join(' ');
}

function pickExtreme(coords: readonly SparkPoint[], mode: 'max' | 'min'): SparkPoint | null {
  return coords.reduce<SparkPoint | null>((best, candidate) => {
    if (!best) return candidate;
    return mode === 'max'
      ? candidate.value > best.value
        ? candidate
        : best
      : candidate.value < best.value
        ? candidate
        : best;
  }, null);
}

// AGENT-TRACE: Token-driven area sparkline. All colours resolve through `currentColor`
// (no raw hex/rgb), the first value is drawn as a dashed baseline so the delta badge has
// a visible reference, and high/low markers make the min–max scale legible.
export function Sparkline({
  data,
  width = 180,
  height = 40,
  strokeWidth = 2,
  className,
  isFluidWidth = false,
  ariaLabel,
}: SparklineProps) {
  const id = useId();

  if (data.length < 2) return null;

  const areaGradId = `sparkAreaGrad-${id}`;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const usableHeight = Math.max(height - PADDING_Y_PX * 2, 1);
  const toY = (value: number) => height - PADDING_Y_PX - ((value - min) / range) * usableHeight;

  const coords: SparkPoint[] = data.map((value, i) => ({
    x: (i / (data.length - 1)) * width,
    y: toY(value),
    value,
  }));

  const pathD = buildSmoothSparklinePath(coords);
  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];
  const areaPathD =
    firstCoord && lastCoord
      ? `${pathD} L ${lastCoord.x.toFixed(1)} ${height} L ${firstCoord.x.toFixed(1)} ${height} Z`
      : '';

  const peakCoord = pickExtreme(coords, 'max');
  const lowCoord = max === min ? null : pickExtreme(coords, 'min');

  return (
    <svg
      width={isFluidWidth ? undefined : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={isFluidWidth ? 'none' : undefined}
      className={cn(isFluidWidth ? 'block w-full' : 'shrink-0 overflow-visible', className)}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
      data-testid="sparkline-svg"
    >
      <defs>
        <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {firstCoord && (
        <line
          x1="0"
          y1={firstCoord.y}
          x2={width}
          y2={firstCoord.y}
          className="stroke-slate-400/60"
          strokeWidth="1"
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
          data-testid="sparkline-baseline"
        />
      )}

      {areaPathD && <path d={areaPathD} fill={`url(#${areaGradId})`} />}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        shapeRendering="geometricPrecision"
      />
      {lowCoord && (
        <circle
          cx={lowCoord.x}
          cy={lowCoord.y}
          r={2}
          className="fill-white stroke-slate-500"
          strokeWidth={1.25}
          data-testid="sparkline-low-marker"
        />
      )}
      {peakCoord && (
        <circle
          cx={peakCoord.x}
          cy={peakCoord.y}
          r={2.5}
          className="fill-white"
          stroke="currentColor"
          strokeWidth={1.5}
          data-testid="sparkline-high-marker"
        />
      )}
      {lastCoord && (
        <svg
          x={lastCoord.x - 5}
          y={lastCoord.y - 5}
          width={10}
          height={10}
          viewBox={ARCH_LOGO_VIEWBOX}
          aria-hidden="true"
          className="motion-safe:animate-pulse"
        >
          <path d={ARCH_LOGO_PATH} fill="currentColor" fillRule="evenodd" />
        </svg>
      )}
    </svg>
  );
}
