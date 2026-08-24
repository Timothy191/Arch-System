"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@repo/ui/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const id = useId();

  // AGENT-TRACE: gate the end-node pulse behind prefers-reduced-motion. The
  // infinite r/opacity animation was running on every sparkline regardless of
  // user preference.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
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

  const pathD = `M${points.join(" L")}`;
  const trend = data[data.length - 1]! - data[0]!;

  // Neon cyan for steady metrics, high-saturation neon coral for alerts
  const strokeColor = trend >= 0 ? "#00f0ff" : "#ff4b5c";

  const endX = points[points.length - 1]?.split(",")[0] ?? "0";
  const endY = points[points.length - 1]?.split(",")[1] ?? "0";

  // Create an area path closed at the bottom of the svg
  const areaPathD = `${pathD} L${endX},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
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
      {/* Hardware-like glowing end node — static halo + animated core */}
      <circle cx={endX} cy={endY} r={3} fill={strokeColor} opacity={0.25} />
      <circle
        cx={endX}
        cy={endY}
        r={1.5}
        fill={strokeColor}
        opacity={0.9}
        style={
          prefersReducedMotion
            ? undefined
            : {
                animation: `spark-pulse-${id} 2s ease-in-out infinite`,
                transformOrigin: `${endX}px ${endY}px`,
              }
        }
      />
    </svg>
  );
}
