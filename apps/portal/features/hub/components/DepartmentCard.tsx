"use client";

import Link from "next/link";
// eslint-disable-next-line no-redeclare
import Image from "next/image";
import { useRouter } from "next/navigation";
import { memo, useState, useEffect, useTransition } from "react";
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  CreditCard,
  Factory,
  FileText,
  HardHat,
  GraduationCap,
  Loader2,
  Monitor,
  Pickaxe,
  Satellite,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { Department } from "@repo/departments/data-access";
import { Sparkline } from "./Sparkline";
import { toast } from "sonner";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
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

function DepartmentCard({ department, index }: DepartmentCardProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [isPinned, setIsPinned] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const pinned = localStorage.getItem(`pinned_dept_${department.name}`);
    setIsPinned(pinned === "true");
  }, [department.name]);

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const nextState = !isPinned;
    localStorage.setItem(`pinned_dept_${department.name}`, String(nextState));
    setIsPinned(nextState);
    if (nextState) {
      toast.success(`Pinned ${department.displayName} to dashboard`);
    } else {
      toast.success(`Unpinned ${department.displayName}`);
    }
  };

  const Icon = ICON_MAP[department.icon] || Factory;
  const config = COLOR_MAP[department.color] || {
    bg: "border-arch-border-subtle text-arch-text-primary",
    text: "text-arch-text-primary",
  };

  const route = department.route || `/${department.name}`;

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
        className="uiverse-card group outline-none h-full interactive-element relative"
        data-testid={`dept-card-${department.name}`}
      >
        {/* Navigation Loading Overlay */}
        {isNavigating && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-arch-surface-primary/75 backdrop-blur-sm rounded-[24px] z-30 transition-all animate-fade-in"
            data-testid={`dept-loading-${department.name}`}
            aria-live="polite"
          >
            <Loader2 className="w-6 h-6 animate-spin text-arch-accent-blue" />
            <span className="text-xs font-medium text-arch-text-secondary">Loading...</span>
          </div>
        )}

        {/* Stretched client-side Link with proper useTransition */}
        <Link
          href={route}
          prefetch={true}
          onClick={(e) => {
            e.preventDefault();
            // Use useTransition for smoother navigation with loading state
            startTransition(() => {
              router.push(route);
            });
          }}
          className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue rounded-[24px]"
          aria-label={`Open ${department.displayName} department`}
          data-testid={`dept-link-${department.name}`}
        />

        {/* Banner area with photographic / terrain visual background */}
        <div
          className={cn(
            "uiverse-card-banner relative z-10 pointer-events-none overflow-hidden",
            `uiverse-card-banner-${department.name}`,
          )}
        >
          {/* Real industrial terrain visual background with liquid glass gradient overlay */}
          <div className="absolute inset-0 z-0">
            {!imageError && (
              <Image
                src={`/images/departments/${department.name}.jpg`}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover object-center opacity-90 transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
            )}
            {/* Glass gradient overlay to ensure icon bubble contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35 z-10" />
          </div>

          {/* Save/Pin Button */}
          <button
            type="button"
            onClick={togglePin}
            className="uiverse-card-pin hover:scale-110 active:scale-95 pointer-events-auto relative z-20"
            title={isPinned ? "Unpin department" : "Pin department"}
            aria-label={
              isPinned ? `Unpin ${department.displayName}` : `Pin ${department.displayName}`
            }
          >
            <Bookmark
              className={cn(
                "w-3.5 h-3.5 transition-all duration-200",
                isPinned
                  ? "fill-arch-accent-blue text-arch-accent-blue"
                  : "text-arch-text-tertiary",
              )}
            />
          </button>

          {/* Department Icon Bubble */}
          <div
            className={cn(
              "uiverse-card-icon-bubble border-arch-border-emphasis/25 relative z-20",
              config.bg,
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {/* Card Body */}
        <div className="uiverse-card-body relative z-10 pointer-events-none">
          <div className="space-y-2">
            <div className="uiverse-card-title-row">
              <h3 className="uiverse-card-title">{department.displayName}</h3>
              {department.status && (
                <span className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      department.status === "active" && "bg-accent-green",
                      department.status === "maintenance" && "bg-accent-amber",
                      department.status === "alert" && "bg-accent-red",
                    )}
                  />
                  <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-arch-text-tertiary">
                    {department.status}
                  </span>
                </span>
              )}
            </div>
            <p className="uiverse-card-subtitle">{department.description}</p>

            {department.actions && department.actions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1.5 pointer-events-auto">
                {department.actions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1 h-6 rounded-full glass-action-button text-[10.5px] font-medium text-arch-text-primary hover:text-arch-accent-blue bg-arch-surface-secondary/60 hover:bg-arch-surface-tertiary/90 border border-arch-border-subtle hover:border-arch-accent-blue/40 shadow-card hover:shadow-card-hover transition-all duration-200 ease-out hover:scale-105 active:scale-95 interactive-element relative z-20 group/action"
                    data-testid={`dept-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <FileText className="w-3 h-3 shrink-0 text-arch-accent-blue opacity-80 group-hover/action:opacity-100 transition-opacity" />
                    <span>{action.label}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-60 group-hover/action:opacity-100 group-hover/action:translate-x-0.5 group-hover/action:-translate-y-0.5 transition-transform duration-200 shrink-0 text-arch-accent-blue" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Tag / Stats row */}
          {department.stats && (
            <div className="uiverse-card-tag-row">
              <div className="flex items-center gap-2">
                <span className="uiverse-card-tag-row-text">{department.stats.label}</span>
                {department.trend && (
                  <div className="opacity-80">
                    <Sparkline data={department.trend} width={52} height={14} />
                  </div>
                )}
              </div>
              <span className="uiverse-card-tag-row-value">{department.stats.value}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// AGENT-TRACE: Memoize DepartmentCard to prevent re-renders when sibling cards
// or parent hub state changes. Props (department, index) are stable across renders.
const MemoizedDepartmentCard = memo(DepartmentCard);
export { MemoizedDepartmentCard as DepartmentCard };
export default MemoizedDepartmentCard;
