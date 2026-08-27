"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { cn } from "../lib/utils";
import { GlassCard } from "./GlassCard";

export type KPIColor = "default" | "green" | "blue" | "red" | "cyan" | "indigo" | "alert";

const colorMap: Record<KPIColor, string> = {
  default: "text-[var(--text-heading)]",
  green: "text-accent-green",
  blue: "text-dept-drilling",
  red: "text-[var(--accent-red)]",
  cyan: "text-[var(--accent-green)]",
  indigo: "text-dept-satellite",
  alert: "text-[var(--accent-red)]",
};

interface KPICardProps {
  label: string;
  value: string | number;
  color?: KPIColor;
  sub?: string;
  subColor?: KPIColor;
  icon?: React.ReactNode;
}

export function KPICard({
  label,
  value,
  color = "default",
  sub,
  subColor = "default",
  icon,
}: KPICardProps) {
  return (
    <GlassCard className="relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div>
          <p className="system-label">{label}</p>
          <p className={cn("text-fluid-2xl font-medium mt-1", colorMap[color])}>{value}</p>
        </div>
        {icon && (
          <div
            className={cn(
              "opacity-20 group-hover:opacity-40 transition-opacity duration-300",
              colorMap[color],
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {sub && <p className={cn("text-fluid-xs mt-1", colorMap[subColor])}>{sub}</p>}
    </GlassCard>
  );
}

interface KPIGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function KPIGrid({ children, cols = 4, className }: KPIGridProps) {
  const [parent] = useAutoAnimate({ duration: 300, easing: "ease-out" });
  const colClasses: Record<number, string> = {
    2: "grid grid-cols-2 gap-4",
    3: "grid grid-cols-1 md:grid-cols-3 gap-4",
    4: "grid grid-cols-2 md:grid-cols-4 gap-4",
  };

  return (
    <div ref={parent} className={cn(colClasses[cols], className)}>
      {children}
    </div>
  );
}
