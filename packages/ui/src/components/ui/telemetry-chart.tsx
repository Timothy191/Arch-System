"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "../GlassCard";
import { FreezeToggle } from "./freeze-toggle";
import { cn } from "@repo/ui/lib/utils";

interface TelemetryPoint {
  timestamp: string | number;
  value: number;
}

interface TelemetryChartProps {
  data: TelemetryPoint[];
  title: string;
  unit?: string;
  color?: string;
  className?: string;
  height?: number;
  allowFreeze?: boolean;
}

/**
 * A standardized telemetry chart for industrial data.
 * Supports "Freeze Mode" to stop real-time updates for manual inspection.
 */
export function TelemetryChart({
  data,
  title,
  unit = "",
  color = "var(--accent-green)",
  className,
  height = 300,
  allowFreeze = true,
}: TelemetryChartProps) {
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenData, setFrozenData] = useState<TelemetryPoint[]>([]);
  const lastActiveData = useRef<TelemetryPoint[]>(data);

  // Update lastActiveData whenever data changes AND we are not frozen
  useEffect(() => {
    if (!isFrozen) {
      lastActiveData.current = data;
    }
  }, [data, isFrozen]);

  const toggleFreeze = (frozen: boolean) => {
    if (frozen) {
      // Capture the current data state when freezing
      setFrozenData([...lastActiveData.current]);
    }
    setIsFrozen(frozen);
  };

  const chartData = isFrozen ? frozenData : data;

  return (
    <GlassCard className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-heading)] uppercase tracking-wider">
            {title}
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] font-mono">
            {unit && `Unit: ${unit}`}
          </p>
        </div>
        {allowFreeze && (
          <FreezeToggle isFrozen={isFrozen} onToggle={toggleFreeze} />
        )}
      </div>

      <div style={{ height: `${height}px` }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`gradient-${title}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-default)"
              vertical={false}
              opacity={0.5}
            />
            <XAxis dataKey="timestamp" hide axisLine={false} tickLine={false} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--text-heading)",
              }}
              itemStyle={{ color: color }}
              labelStyle={{ display: "none" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${title})`}
              isAnimationActive={!isFrozen} // Disable animation when frozen for better performance/feel
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
