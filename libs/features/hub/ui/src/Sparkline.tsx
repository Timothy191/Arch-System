'use client';

import { cn } from '@repo/ui/lib/utils';
import { useEffect, useId, useState } from 'react';

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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const id = useId();

  // AGENT-TRACE: gate the end-node pulse behind prefers-reduced-motion. The
  // infinite r/opacity animation was running on every sparkline regardless of
  // user preference.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
        {/* Horizontal gradient for line path */}
        <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.5} />
          <stop offset="85%" stopColor={strokeColor} stopOpacity={0.9} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={1} />
        </linearGradient>
        {/* Vertical gradient for area fill */}
        <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
        {/* AGENT-TRACE: feDropShadow/feGaussianBlur filters removed — SVG filters
            on animated elements force a filter re-evaluation every frame. The
            halo circle + gradient stroke replace them at zero filter cost. */}
        <style>{`
          @keyframes spark-pulse-${id} {
            0%, 100% { r: 1.5; opacity: 0.9; }
            50% { r: 3; opacity: 0.4; }
          }
        `}</style>
      </defs>
      {/* Crisp high-precision telemetry grid lines */}
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

      {/* Vertical gradient area under the line */}
      <path
        d={areaPathD}
        fill={`url(#${areaGradId})`}
        className="pointer-events-none"
        shapeRendering="auto"
      />
      {/* Ultra-thin sparkline with refracted glow */}
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
      {/* Small Arch-System logo icon end node */}
      <svg
        x={Number(endX) - 4.5}
        y={Number(endY) - 4.5}
        width={9}
        height={9}
        viewBox="22.75 16.625 166.16 166.19"
        aria-hidden="true"
        style={
          prefersReducedMotion
            ? undefined
            : {
                animation: `spark-pulse-${id} 2s ease-in-out infinite`,
                transformOrigin: 'center',
              }
        }
      >
        <path
          d="m 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z"
          fill={strokeColor}
          fillRule="evenodd"
        />
      </svg>
    </svg>
  );
}
