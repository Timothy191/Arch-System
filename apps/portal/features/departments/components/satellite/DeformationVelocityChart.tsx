"use client";

import type { VelocityPoint, DeformationArea } from "@/lib/monitoring-api";
import { ALERT_THRESHOLDS } from "@/lib/monitoring-api";

interface DeformationVelocityChartProps {
  history: VelocityPoint[];
  area: DeformationArea;
  height?: number;
  label?: string;
}

const LEVEL_COLORS = {
  stable: "#3ecf8e",
  minor: "#71717a",
  moderate: "#3f3f46",
  critical: "#ef4444",
};

function getColor(v: number, area: DeformationArea): string {
  const t = ALERT_THRESHOLDS[area];
  const abs = Math.abs(v);
  if (abs >= t.critical) return LEVEL_COLORS.critical;
  if (abs >= t.moderate) return LEVEL_COLORS.moderate;
  if (abs >= t.minor) return LEVEL_COLORS.minor;
  return LEVEL_COLORS.stable;
}

export function DeformationVelocityChart({
  history,
  area,
  height = 80,
  label = "Velocity (mm/mo)",
}: DeformationVelocityChartProps) {
  if (!history.length) return null;

  const W = 280;
  const H = height;
  const PAD = { top: 6, right: 6, bottom: 18, left: 34 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = history.map((p) => p.velocityMmPerMonth);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  const t = ALERT_THRESHOLDS[area];
  const domainMin = Math.min(rawMin, -t.critical - 5);
  const domainMax = Math.max(rawMax, t.critical + 5);
  const domainRange = domainMax - domainMin || 1;

  function scaleX(i: number) {
    return PAD.left + (i / (history.length - 1)) * innerW;
  }
  function scaleY(v: number) {
    return PAD.top + ((domainMax - v) / domainRange) * innerH;
  }

  const zeroY = scaleY(0);
  const minorNegY = scaleY(-t.minor);
  const moderateNegY = scaleY(-t.moderate);
  const criticalNegY = scaleY(-t.critical);

  const polylinePoints = history
    .map((p, i) => `${scaleX(i)},${scaleY(p.velocityMmPerMonth)}`)
    .join(" ");

  return (
    <div>
      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">
        {label}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-label={label}>
        {/* threshold bands */}
        <rect
          x={PAD.left}
          y={criticalNegY}
          width={innerW}
          height={Math.max(0, moderateNegY - criticalNegY)}
          fill="#ef4444"
          opacity={0.07}
        />
        <rect
          x={PAD.left}
          y={moderateNegY}
          width={innerW}
          height={Math.max(0, minorNegY - moderateNegY)}
          fill={LEVEL_COLORS.moderate}
          opacity={0.07}
        />
        <rect
          x={PAD.left}
          y={minorNegY}
          width={innerW}
          height={Math.max(0, zeroY - minorNegY)}
          fill={LEVEL_COLORS.minor}
          opacity={0.07}
        />

        {/* threshold lines */}
        {[
          { y: criticalNegY, color: "#ef4444", label: `${t.critical}` },
          {
            y: moderateNegY,
            color: LEVEL_COLORS.moderate,
            label: `${t.moderate}`,
          },
          { y: minorNegY, color: LEVEL_COLORS.minor, label: `${t.minor}` },
        ].map(({ y, color, label: lbl }) => (
          <g key={lbl}>
            <line
              x1={PAD.left}
              y1={y}
              x2={PAD.left + innerW}
              y2={y}
              stroke={color}
              strokeDasharray="3 3"
              strokeWidth={0.8}
              opacity={0.6}
            />
            <text
              x={PAD.left - 3}
              y={y + 3}
              textAnchor="end"
              fontSize={7}
              fill={color}
              opacity={0.8}
            >
              -{lbl}
            </text>
          </g>
        ))}

        {/* zero line */}
        <line
          x1={PAD.left}
          y1={zeroY}
          x2={PAD.left + innerW}
          y2={zeroY}
          stroke="var(--border-emphasis)"
          strokeWidth={1}
        />
        <text
          x={PAD.left - 3}
          y={zeroY + 3}
          textAnchor="end"
          fontSize={7}
          fill="var(--text-secondary)"
        >
          0
        </text>

        {/* velocity polyline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#3ecf8e"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* data points */}
        {history.map((p, i) => {
          const cx = scaleX(i);
          const cy = scaleY(p.velocityMmPerMonth);
          const color = getColor(p.velocityMmPerMonth, area);
          return (
            <g key={p.month}>
              <circle
                cx={cx}
                cy={cy}
                r={3.5}
                fill={color}
                stroke="var(--text-heading)"
                strokeWidth={1}
              />
              <text
                x={cx}
                y={H - 3}
                textAnchor="middle"
                fontSize={7}
                fill="var(--text-secondary)"
              >
                {p.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
