'use client';

import { ARCH_LOGO_PATH, ARCH_LOGO_VIEWBOX } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { useId } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  isFluidWidth?: boolean;
}

interface SparkPoint {
  readonly x: number;
  readonly y: number;
  readonly value: number;
}

const SPLINE_TENSION = 0.2;
const PADDING_Y_PX = 4;

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

export function Sparkline({
  data,
  width = 180,
  height = 40,
  strokeWidth = 2,
  className,
  color,
  isFluidWidth = false,
}: SparklineProps) {
  const id = useId();

  if (data.length < 2) return null;

  const lineGradId = `sparkLineGrad-${id}`;
  const areaGradId = `sparkAreaGrad-${id}`;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const usableHeight = Math.max(height - PADDING_Y_PX * 2, 1);

  const coords: SparkPoint[] = data.map((value, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - PADDING_Y_PX - ((value - min) / range) * usableHeight,
    value,
  }));

  const pathD = buildSmoothSparklinePath(coords);
  const trend = data[data.length - 1]! - data[0]!;
  const strokeColor = color || (trend >= 0 ? '#d4af37' : '#e11d48');

  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];
  const areaPathD =
    firstCoord && lastCoord
      ? `${pathD} L ${lastCoord.x.toFixed(1)} ${height} L ${firstCoord.x.toFixed(1)} ${height} Z`
      : '';

  const peakCoord = coords.reduce<SparkPoint | null>(
    (best, candidate) => (!best || candidate.value > best.value ? candidate : best),
    null
  );

  return (
    <svg
      width={isFluidWidth ? undefined : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={isFluidWidth ? 'none' : undefined}
      className={cn(isFluidWidth ? 'block w-full' : 'shrink-0 overflow-visible', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.6} />
          <stop offset="80%" stopColor={strokeColor} stopOpacity={0.95} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={1} />
        </linearGradient>
        <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1="0"
          y1={height * ratio}
          x2={width}
          y2={height * ratio}
          stroke="rgba(148, 163, 184, 0.25)"
          strokeWidth="0.75"
          strokeDasharray="3 3"
          shapeRendering="crispEdges"
        />
      ))}

      {areaPathD && (
        <path
          d={areaPathD}
          fill={`url(#${areaGradId})`}
          className="pointer-events-none"
          shapeRendering="auto"
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={`url(#${lineGradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.96}
        shapeRendering="geometricPrecision"
      />
      {peakCoord && (
        <circle
          cx={peakCoord.x}
          cy={peakCoord.y}
          r={2.5}
          fill="#ffffff"
          stroke={strokeColor}
          strokeWidth={1.5}
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
          <path d={ARCH_LOGO_PATH} fill={strokeColor} fillRule="evenodd" />
        </svg>
      )}
    </svg>
  );
}
