import React from "react";
import { cn } from "../../lib/utils";

export interface GaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
}

export function Gauge({
  value,
  max = 100,
  size = 100,
  strokeWidth = 10,
  showValue = true,
  className,
  ...props
}: GaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Clamp value between 0 and max
  const clampedValue = Math.min(Math.max(value, 0), max);
  const percent = clampedValue / max;
  const offset = circumference - percent * circumference;

  let colorClass = "text-green-500";
  if (percent < 0.5) colorClass = "text-red-500";
  else if (percent < 0.8) colorClass = "text-amber-500";

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg className="rotate-[-90deg]" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="text-muted/20"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn("transition-all duration-1000 ease-in-out", colorClass)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center font-medium">
          {clampedValue}
        </div>
      )}
    </div>
  );
}
