"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Play, Info, ArrowUpRight } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { Department } from "@repo/departments/data-access";
import { Marquee } from "@repo/ui/Marquee";
import { GlassCard } from "@repo/ui/GlassCard";

interface HeroRotatorProps {
  defaultTitle: string;
  defaultDescription: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  departments: Department[];
}

export function HeroRotator({
  defaultTitle,
  defaultDescription,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  departments,
}: HeroRotatorProps) {
  // AGENT-TRACE: Memoize panels array to avoid allocating objects and JSX elements every render
  const panels = useMemo(
    () => [
      {
        id: "default",
        title: defaultTitle,
        description: defaultDescription,
        primary: {
          href: primaryHref,
          label: primaryLabel,
          icon: <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />,
        },
        secondary: {
          href: secondaryHref,
          label: secondaryLabel,
          icon: <Info className="w-4 h-4 shrink-0" aria-hidden="true" />,
        },
      },
      ...departments.map((dept) => ({
        id: dept.name,
        title: dept.displayName,
        description: dept.description,
        primary: dept.actions?.[0]
          ? {
              href: dept.actions[0].href,
              label: dept.actions[0].label,
              icon: <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />,
            }
          : {
              href: `/${dept.name}`,
              label: `Go to ${dept.displayName}`,
              icon: <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />,
            },
        secondary: dept.actions?.[1]
          ? {
              href: dept.actions[1].href,
              label: dept.actions[1].label,
              icon: <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />,
            }
          : null,
      })),
    ],
    [
      defaultTitle,
      defaultDescription,
      primaryHref,
      primaryLabel,
      secondaryHref,
      secondaryLabel,
      departments,
    ],
  );

  const maskStyle = {
    maskImage: "linear-gradient(to right, transparent, white 5%, white 95%, transparent)",
    WebkitMaskImage: "linear-gradient(to right, transparent, white 5%, white 95%, transparent)",
  };

  return (
    <div className="relative overflow-hidden w-full" style={maskStyle}>
      <Marquee pauseOnHover className="[--duration:50s] gap-8 py-2">
        {panels.map((panel) => (
          <GlassCard
            key={panel.id}
            variant="spotlight"
            className="w-[450px] shrink-0 p-6 flex flex-col justify-between h-full border border-arch-border-primary hover:border-white/40 transition-all duration-300 bg-arch-surface-tertiary/40"
          >
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-arch-text-primary">
                {panel.title}
              </h1>
              <p className="text-arch-text-secondary text-sm sm:text-base leading-relaxed line-clamp-3">
                {panel.description}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-4 mt-auto">
              <Link
                href={panel.primary.href}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-blue)] text-white font-medium text-sm shadow-glow-primary transition-all hover:bg-[var(--accent-blue)]/90 active:bg-[var(--accent-blue)]/80 hover:scale-[1.02] active:scale-[0.97]"
              >
                {panel.primary.icon}
                {panel.primary.label}
              </Link>
              {panel.secondary && (
                <Link
                  href={panel.secondary.href}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-arch-surface-tertiary/60 text-arch-text-secondary font-medium text-sm border border-arch-border-subtle hover:bg-arch-surface-secondary hover:text-arch-text-primary hover:border-arch-border-emphasis active:bg-arch-surface-primary transition-all hover:scale-[1.02] active:scale-[0.97]"
                >
                  {panel.secondary.icon}
                  {panel.secondary.label}
                </Link>
              )}
            </div>
          </GlassCard>
        ))}
      </Marquee>
    </div>
  );
}
