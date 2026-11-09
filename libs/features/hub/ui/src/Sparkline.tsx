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
}

export function Sparkline({
  data,
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  className,
  color,
}: SparklineProps) {
  const id = useId();

  if (data.length < 2) return null;

  const lineGradId = `sparkLineGrad-${id}`;
  const areaGradId = `sparkAreaGrad-${id}`;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(' L')}`;
  const trend = data[data.length - 1]! - data[0]!;

  // System Gold Branding (#d4af37) default for department card sparkline telemetry
  const strokeColor = color || (trend >= 0 ? '#d4af37' : '#e11d48');

  const endX = points[points.length - 1]?.split(',')[0] ?? '0';
  const endY = points[points.length - 1]?.split(',')[1] ?? '0';

  // Create an area path closed at the bottom of the svg
  const areaPathD = `${pathD} L${endX},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('shrink-0 overflow-visible', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.5} />
          <stop offset="85%" stopColor={strokeColor} stopOpacity={0.9} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={1} />
        </linearGradient>
        <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1={height - 0.5}
        x2={width}
        y2={height - 0.5}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="0.5"
        shapeRendering="crispEdges"
      />
      <line
        x1="0"
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="rgba(0,0,0,0.03)"
        strokeWidth="0.5"
        shapeRendering="crispEdges"
      />
      <line
        x1="0"
        y1={0.5}
        x2={width}
        y2={0.5}
        stroke="rgba(0,0,0,0.03)"
        strokeWidth="0.5"
        shapeRendering="crispEdges"
      />
      <line
        x1="0.5"
        y1="0"
        x2="0.5"
        y2={height}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="0.5"
        shapeRendering="crispEdges"
      />

      <path
        d={areaPathD}
        fill={`url(#${areaGradId})`}
        className="pointer-events-none"
        shapeRendering="auto"
      />
      <path
        d={pathD}
        fill="none"
        stroke={`url(#${lineGradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
        shapeRendering="geometricPrecision"
      />
      <svg
        x={Number(endX) - 4.5}
        y={Number(endY) - 4.5}
        width={9}
        height={9}
        viewBox={ARCH_LOGO_VIEWBOX}
        aria-hidden="true"
        className="motion-safe:animate-pulse"
      >
        <path d={ARCH_LOGO_PATH} fill={strokeColor} fillRule="evenodd" />
      </svg>
    </svg>
  );
}
