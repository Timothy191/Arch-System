"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Factory,
  FileText,
  HardHat,
  GraduationCap,
  Monitor,
  Pickaxe,
  Satellite,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { GlassCard } from "@repo/ui/GlassCard";
import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { Department } from "~/lib/departments";
import { Sparkline } from "./Sparkline";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Drill: Pickaxe,
  Factory,
  ShieldCheck,
  Wrench,
  Monitor,
  HardHat,
  GraduationCap,
  Satellite,
};

const COLOR_MAP: Record<string, { bg: string; glow: string; text: string }> = {
  amber: {
    bg: "border-[var(--mac-yellow)]/20 text-[var(--mac-yellow)] bg-[var(--mac-yellow)]/5",
    glow: "rgba(255, 189, 46, 0.15)",
    text: "text-[var(--mac-yellow)]",
  },
  emerald: {
    bg: "border-[var(--accent-green)]/20 text-[var(--accent-green)] bg-[var(--accent-green)]/5",
    glow: "rgba(52, 199, 89, 0.15)",
    text: "text-[var(--accent-green)]",
  },
  blue: {
    bg: "border-[var(--accent-blue)]/20 text-[var(--accent-blue)] bg-[var(--accent-blue)]/5",
    glow: "rgba(0, 122, 255, 0.15)",
    text: "text-[var(--accent-blue)]",
  },
  violet: {
    bg: "border-[var(--accent-blue)]/20 text-[var(--accent-blue)] bg-[var(--accent-blue)]/5",
    glow: "rgba(0, 122, 255, 0.15)",
    text: "text-[var(--accent-blue)]",
  },
  red: {
    bg: "border-[var(--accent-red)]/20 text-[var(--accent-red)] bg-[var(--accent-red)]/5",
    glow: "rgba(255, 59, 48, 0.15)",
    text: "text-[var(--accent-red)]",
  },
  orange: {
    bg: "border-[var(--mac-yellow)]/20 text-[var(--mac-yellow)] bg-[var(--mac-yellow)]/5",
    glow: "rgba(255, 189, 46, 0.15)",
    text: "text-[var(--mac-yellow)]",
  },
  cyan: {
    bg: "border-[var(--accent-blue)]/20 text-[var(--accent-blue)] bg-[var(--accent-blue)]/5",
    glow: "rgba(0, 122, 255, 0.15)",
    text: "text-[var(--accent-blue)]",
  },
  indigo: {
    bg: "border-[var(--accent-blue)]/20 text-[var(--accent-blue)] bg-[var(--accent-blue)]/5",
    glow: "rgba(0, 122, 255, 0.15)",
    text: "text-[var(--accent-blue)]",
  },
};

interface DepartmentCardProps {
  department: Department;
  index: number;
}

export function DepartmentCard({ department, index }: DepartmentCardProps) {
  const router = useRouter();
  const Icon = ICON_MAP[department.icon] || Factory;
  const config = COLOR_MAP[department.color] || {
    bg: "border-[var(--border-default)] text-[var(--text-heading)]",
    glow: "rgba(0,0,0,0.04)",
    text: "text-[var(--text-heading)]",
  };
  const cardContent = (
    <>
      <div className="flex items-center justify-between mb-6 liquid-shift-y">
        <div
          className={cn(
            "p-2.5 rounded-xl border backdrop-blur-md transition-[opacity,transform] duration-300 group-hover:scale-110 group-hover:shadow-glow-blue",
            config.bg,
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2">
          {department.status && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded-full border",
                department.status === "active" && "active-badge-liquid",
                department.status === "maintenance" &&
                  "bg-amber-50/70 border-amber-200/50 text-amber-700",
                department.status === "alert" &&
                  "bg-red-50/70 border-red-200/50 text-red-700",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    department.status === "active" &&
                      "badge-pulse-dot bg-emerald-500",
                    department.status === "maintenance" &&
                      "w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse",
                    department.status === "alert" &&
                      "w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse",
                  )}
                />
                {department.status}
              </span>
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 liquid-shift-y">
        <h3 className="text-arch-text-primary font-bold text-xl tracking-tighter group-hover:text-arch-accent-blue transition-colors duration-300">
          {department.displayName}
        </h3>
        <p className="text-arch-text-secondary antialiased text-sm mt-2 line-clamp-2 leading-relaxed">
          {department.description}
        </p>
      </div>

      {department.stats && (
        <div className="mt-6 pt-4 border-t border-black/[0.06] flex items-center justify-between group/stat">
          <div className="flex flex-col gap-1 liquid-shift-y">
            <span className="text-[10px] font-mono font-medium text-arch-text-tertiary uppercase tracking-widest transition-colors group-hover:text-arch-text-secondary">
              {department.stats.label}
            </span>
            {department.trend && (
              <div className="liquid-shift-y-delay">
                <Sparkline data={department.trend} width={72} height={20} />
              </div>
            )}
          </div>
          <span
            className={cn(
              "text-lg font-mono tabular-nums font-bold transition-all duration-300 group-hover:scale-110 liquid-shift-y",
              config.text,
            )}
          >
            {department.stats.value}
          </span>
        </div>
      )}

      {department.actions && department.actions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 liquid-shift-y-delay">
          {department.actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1 h-6 rounded-full glass-action-button text-[11px] font-semibold transition-all interactive-element"
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span>{action.label}</span>
              <ArrowUpRight className="w-3 h-3 opacity-50 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div
      style={
        {
          animation: `fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both`,
          ["--shimmer-delay" as string]: `${-(index * 1.5)}s`,
        } as React.CSSProperties
      }
      className={cn("h-full", department.gridSpan)}
    >
      <div
        onClick={() => router.push(`/${department.name}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`/${department.name}`);
          }
        }}
        tabIndex={0}
        className="block h-full outline-none group cursor-pointer active:scale-[0.99] transition-transform duration-200 will-change-backdrop-filter interactive-element"
      >
        <GlassCard
          variant="liquid"
          hover
          padding={false}
          className="h-full aurora-shadow"
        >
          <div className="p-5 flex flex-col h-full">{cardContent}</div>
        </GlassCard>
      </div>
    </div>
  );
}
