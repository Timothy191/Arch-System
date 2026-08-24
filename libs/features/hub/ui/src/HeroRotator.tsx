"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
// eslint-disable-next-line no-redeclare
import Image from "next/image";
import {
  Play,
  Pause,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { Department } from "@repo/departments/data-access";

interface HeroRotatorProps {
  defaultTitle: string;
  defaultDescription: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  departments: Department[];
}

// AGENT-TRACE: Production-grade HeroRotator displaying one dedicated card per department with real industrial terrain visual imagery, status badges, operational telemetry stats, and auto-rotation controls.
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
  const [isPaused, setIsPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Construct panels array: Overview first, followed by each department
  const panels = useMemo(
    () => [
      {
        id: "overview",
        name: "overview",
        title: defaultTitle,
        description: defaultDescription,
        category: "Central Command",
        image: "/images/departments/overview.jpg",
        stats: { label: "System Health", value: "100% Optimal" },
        status: "active" as const,
        primary: {
          href: primaryHref,
          label: primaryLabel,
          icon: <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />,
        },
        secondary: {
          href: secondaryHref,
          label: secondaryLabel,
          icon: <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />,
        },
      },
      ...departments.map((dept) => ({
        id: dept.name,
        name: dept.name,
        title: dept.displayName,
        description: dept.description,
        category:
          dept.type === "control_room"
            ? "SCADA & Telemetry"
            : dept.type === "satellite"
              ? "Orbital Intelligence"
              : "Field Operations",
        image: `/images/departments/${dept.name}.jpg`,
        stats: dept.stats || { label: "Telemetry", value: "Online" },
        status: dept.status || "active",
        primary: dept.actions?.[0]
          ? {
              href: dept.actions[0].href,
              label: dept.actions[0].label,
              icon: <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />,
            }
          : {
              href: `/${dept.name}`,
              label: `Launch ${dept.displayName}`,
              icon: <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />,
            },
        secondary: dept.actions?.[1]
          ? {
              href: dept.actions[1].href,
              label: dept.actions[1].label,
              icon: <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />,
            }
          : {
              href: `/${dept.name}`,
              label: "Explore Module",
              icon: <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />,
            },
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

  // AGENT-TRACE: circular distance from the active slide. Panels 2+ slides away
  // are fully off-screen and get content-visibility: auto so the browser skips
  // their layout/paint. Adjacent panels stay fully rendered so the 500ms slide
  // transition never shows a blank pop.
  const distanceFromActive = useCallback(
    (idx: number) => {
      const d = Math.abs(idx - activeIndex);
      return Math.min(d, panels.length - d);
    },
    [activeIndex, panels.length],
  );

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev >= panels.length - 1 ? 0 : prev + 1));
  }, [panels.length]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev <= 0 ? panels.length - 1 : prev - 1));
  }, [panels.length]);

  // Auto-rotation effect (every 6 seconds, pauseable on hover)
  useEffect(() => {
    if (panels.length <= 1 || isPaused) return;

    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [panels.length, isPaused, nextSlide]);

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="Department Hero Highlights"
    >
      {/* Hardware-accelerated slide track */}
      <div
        className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
        style={{
          transform: `translate3d(-${activeIndex * 100}%, 0, 0)`,
        }}
      >
        {panels.map((panel, idx) => (
          <div
            key={panel.id}
            className={cn(
              "w-full shrink-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center",
              // AGENT-TRACE: skip layout/paint for panels 2+ slides away. The
              // slide track still needs them in the DOM for the translate3d math;
              // contain-intrinsic-size: auto remembers each panel's real height
              // after first render so the track never collapses.
              distanceFromActive(idx) > 1 &&
                "[content-visibility:auto] [contain-intrinsic-size:auto_200px]",
            )}
            role="group"
            aria-roledescription="slide"
            aria-label={`${idx + 1} of ${panels.length}: ${panel.title}`}
            // AGENT-TRACE: non-active panels are inert + aria-hidden so their
            // links/buttons are not tabbable and they leave the a11y tree —
            // previously all 9 panels' controls were reachable by keyboard.
            inert={idx !== activeIndex}
            aria-hidden={idx !== activeIndex}
          >
            {/* Left Content Area (9 Cols) */}
            <div className="lg:col-span-9 space-y-3 flex flex-col justify-between z-10">
              <div className="space-y-1.5 sm:space-y-2">
                {/* Category & Status Pill */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-arch-surface-secondary border border-arch-border-subtle text-[10.5px] font-medium text-arch-text-secondary tracking-wide">
                    <Layers className="w-2.5 h-2.5 text-arch-accent-blue" />
                    {panel.category}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-[9.5px] font-semibold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                    {panel.status}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-arch-text-primary text-balance">
                  {panel.title}
                </h1>

                {/* Description */}
                <p className="text-arch-text-secondary text-xs sm:text-sm leading-relaxed line-clamp-2 text-pretty max-w-xl">
                  {panel.description}
                </p>
              </div>

              {/* Operational Stat & CTAs Row */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Stat Pill */}
                {panel.stats && (
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-arch-surface-secondary/70 border border-arch-border-subtle">
                    <div className="w-5 h-5 rounded-md bg-arch-surface-tertiary flex items-center justify-center text-arch-accent-blue">
                      <Activity className="w-3 h-3" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[10px] font-medium text-arch-text-tertiary uppercase">
                        {panel.stats.label}:
                      </span>
                      <span className="font-semibold text-arch-text-primary">
                        {panel.stats.value}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="inline-flex items-center gap-2">
                  <Link
                    href={panel.primary.href}
                    data-cta="primary-hero"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-arch-brand-blue text-white font-medium text-xs shadow-card hover:bg-black transition-all hover:scale-[1.01] active:scale-[0.99] min-h-[32px]"
                  >
                    {panel.primary.icon}
                    <span>{panel.primary.label}</span>
                  </Link>
                  {panel.secondary && (
                    <Link
                      href={panel.secondary.href}
                      data-cta="secondary-hero"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-arch-surface-secondary text-arch-text-primary font-medium text-xs border border-arch-border-subtle hover:bg-arch-surface-tertiary transition-all min-h-[32px]"
                    >
                      {panel.secondary.icon}
                      <span>{panel.secondary.label}</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Right Visual Image Card (3 Cols) */}
            <div className="lg:col-span-3 relative group/image">
              <div className="relative aspect-[16/9] max-h-[80px] sm:max-h-[88px] rounded-xl overflow-hidden shadow-card border border-arch-border-subtle bg-arch-surface-tertiary">
                {/* Visual Terrain / Industrial Image */}
                <img
                  src={
                    failedImages.has(panel.image) ? "/images/departments/overview.jpg" : panel.image
                  }
                  alt={`${panel.title} visual`}
                  className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover/image:scale-102"
                  loading={idx === activeIndex ? "eager" : "lazy"}
                  fetchPriority={idx === activeIndex ? "high" : "low"}
                  onError={() => setFailedImages((prev) => new Set(prev).add(panel.image))}
                />

                {/* Subtle Gradient Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

                {/* Live Indicator Pill on Image */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[9.5px] font-medium border border-white/20">
                    <CheckCircle2 className="w-2.5 h-2.5 text-accent-green" />
                    {panel.name.toUpperCase()} FEED
                  </span>
                  <span className="text-[9px] font-mono text-white/80 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    CAM-0{idx + 1}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Controls & Carousel Indicator Dots */}
      {panels.length > 1 && (
        <div className="flex items-center justify-between pt-3 mt-2.5 border-t border-arch-border-subtle/40">
          {/* Left / Right Step Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevSlide}
              aria-label="Previous department highlight"
              className="w-6 h-6 rounded-full bg-arch-surface-secondary border border-arch-border-subtle flex items-center justify-center text-arch-text-secondary hover:text-arch-text-primary hover:bg-white transition-all shadow-card active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next department highlight"
              className="w-6 h-6 rounded-full bg-arch-surface-secondary border border-arch-border-subtle flex items-center justify-center text-arch-text-secondary hover:text-arch-text-primary hover:bg-white transition-all shadow-card active:scale-95"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? "Resume auto rotation" : "Pause auto rotation"}
              className="w-6 h-6 rounded-full bg-arch-surface-secondary border border-arch-border-subtle flex items-center justify-center text-arch-text-secondary hover:text-arch-text-primary hover:bg-white transition-all shadow-sm active:scale-95 ml-0.5"
              title={isPaused ? "Resume auto-rotation" : "Pause auto-rotation"}
            >
              {isPaused ? (
                <Play className="w-2.5 h-2.5 fill-current" />
              ) : (
                <Pause className="w-2.5 h-2.5 fill-current" />
              )}
            </button>
          </div>

          {/* Dot Indicators */}
          <div className="flex items-center gap-1">
            {panels.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Jump to ${p.title}`}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  idx === activeIndex
                    ? "w-4 bg-arch-text-primary"
                    : "w-1 bg-arch-border-emphasis hover:bg-arch-text-secondary",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export default HeroRotator;
