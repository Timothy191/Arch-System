"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Info, ArrowUpRight } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { Department } from "~/lib/departments";

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
  const [activeIndex, setActiveIndex] = useState(0);

  const panels = [
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
  ];

  useEffect(() => {
    if (panels.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev >= panels.length - 1 ? 0 : prev + 1));
    }, 6000); // Rotate every 6 seconds

    return () => clearInterval(interval);
  }, [panels.length]);

  return (
    <div className="relative overflow-hidden w-full">
      <div
        className="flex transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {panels.map((panel, idx) => (
          <div
            key={panel.id}
            className={cn(
              "w-full shrink-0 flex flex-col justify-start transition-opacity duration-700",
              Math.abs(activeIndex - idx) <= 1 ? "opacity-100" : "opacity-0",
            )}
          >
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight text-arch-text-primary text-balance">
                {panel.title}
              </h1>
              <p className="text-arch-text-secondary text-base sm:text-lg md:text-xl leading-relaxed max-w-xl text-pretty">
                {panel.description}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-2 mt-5">
              <Link
                href={panel.primary.href}
                data-cta="primary-hero"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent-blue)] text-white font-medium text-sm shadow-glow-primary transition-all hover:bg-[var(--accent-blue)]/90 active:bg-[var(--accent-blue)]/80 hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--accent-blue)] focus-visible:outline-offset-2 min-h-[44px]"
              >
                {panel.primary.icon}
                {panel.primary.label}
              </Link>
              {panel.secondary && (
                <Link
                  href={panel.secondary.href}
                  data-cta="secondary-hero"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-arch-surface-tertiary/60 text-arch-text-secondary font-medium text-sm border border-arch-border-subtle hover:bg-arch-surface-secondary hover:text-arch-text-primary hover:border-arch-border-emphasis active:bg-arch-surface-primary transition-all hover:scale-[1.02] active:scale-[0.97] backdrop-blur-md focus-visible:outline-2 focus-visible:outline-[var(--text-secondary)] focus-visible:outline-offset-2 min-h-[44px]"
                >
                  {panel.secondary.icon}
                  {panel.secondary.label}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Optional: Indicator dots for the carousel */}
      {panels.length > 1 && (
        <div className="absolute bottom-0 right-0 flex gap-2">
          {panels.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                idx === activeIndex ? "bg-[var(--accent-blue)] w-4" : "bg-arch-border-emphasis",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
