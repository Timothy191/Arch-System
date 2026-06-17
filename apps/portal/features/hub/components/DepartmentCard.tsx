"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CreditCard,
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
  CreditCard,
};

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  amber: {
    bg: "border-accent-amber/20 text-accent-amber bg-accent-amber/5",
    text: "text-accent-amber",
  },
  emerald: {
    bg: "border-accent-green/20 text-accent-green bg-accent-green/5",
    text: "text-accent-green",
  },
  blue: {
    bg: "border-accent-blue/20 text-accent-blue bg-accent-blue/5",
    text: "text-accent-blue",
  },
  violet: {
    bg: "border-accent-blue/20 text-accent-blue bg-accent-blue/5",
    text: "text-accent-blue",
  },
  red: {
    bg: "border-accent-red/20 text-accent-red bg-accent-red/5",
    text: "text-accent-red",
  },
  orange: {
    bg: "border-accent-amber/20 text-accent-amber bg-accent-amber/5",
    text: "text-accent-amber",
  },
  cyan: {
    bg: "border-accent-blue/20 text-accent-blue bg-accent-blue/5",
    text: "text-accent-blue",
  },
  indigo: {
    bg: "border-accent-blue/20 text-accent-blue bg-accent-blue/5",
    text: "text-accent-blue",
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
    bg: "border-arch-border-subtle text-arch-text-primary",
    glow: "rgba(0,0,0,0.04)",
    text: "text-arch-text-primary",
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
                "text-[9px] font-medium uppercase tracking-[0.05em] px-2 py-0.5 rounded-full border",
                department.status === "active" &&
                  "bg-accent-green/10 border-accent-green/20 text-accent-green",
                department.status === "maintenance" &&
                  "bg-accent-amber/10 border-accent-amber/20 text-accent-amber",
                department.status === "alert" &&
                  "bg-accent-red/10 border-accent-red/20 text-accent-red",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full animate-pulse",
                    department.status === "active" && "bg-accent-green",
                    department.status === "maintenance" && "bg-accent-amber",
                    department.status === "alert" && "bg-accent-red",
                  )}
                />
                {department.status}
              </span>
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 liquid-shift-y">
        <h3 className="text-arch-text-primary font-medium text-xl tracking-tighter group-hover:text-arch-accent-blue transition-colors duration-300">
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
              "text-lg font-mono tabular-nums font-medium transition-all duration-300 group-hover:scale-110 liquid-shift-y",
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
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1 h-6 rounded-full glass-action-button text-[11px] font-medium transition-all interactive-element"
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
          {/* Inner glass highlight ring for edge definition */}
          <div
            className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-arch-border-emphasis/30 pointer-events-none"
            aria-hidden="true"
          />

          <div className="p-5 flex flex-col h-full">{cardContent}</div>
        </GlassCard>
      </div>
    </div>
  );
}
