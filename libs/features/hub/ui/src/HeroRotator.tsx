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

import { GlassCard } from "@repo/ui/GlassCard";
import { AlertTriangle, Wrench, Power } from "lucide-react";
import { TrustLogos } from "./TrustLogos";

interface HeroRotatorProps {
  defaultTitle: string;
  defaultDescription: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  departments: Department[];
  incidentCount?: number;
  breakdownCount?: number;
  offlineMachineCount?: number;
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
  incidentCount = 0,
  breakdownCount = 0,
  offlineMachineCount = 0,
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
      className="relative w-full overflow-visible select-none py-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="Department Hero Highlights"
    >
      {/* 3D Orb Slideshow Container with Perspective */}
      <div className="relative w-full overflow-visible" style={{ perspective: "1400px" }}>
        <div className="relative w-full flex items-center justify-center min-h-[160px]">
          {panels.map((panel, idx) => {
            const total = panels.length;
            let diff = (idx - activeIndex) % total;
            if (diff > total / 2) diff -= total;
            if (diff < -total / 2) diff += total;

            const isActive = diff === 0;
            const isPrev = diff === -1;
            const isNext = diff === 1;
            const isVisible = isActive || isPrev || isNext;

            if (!isVisible) return null;

            return (
              <div
                key={panel.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${idx + 1} of ${panels.length}: ${panel.title}`}
                inert={!isActive}
                aria-hidden={!isActive}
                onClick={() => {
                  if (isPrev) prevSlide();
                  if (isNext) nextSlide();
                }}
                className={cn(
                  "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-full select-none",
                  isActive && "relative z-20 opacity-100 scale-100",
                  isPrev &&
                    "absolute left-0 z-10 opacity-40 scale-[0.78] blur-[0.2px] hover:opacity-85 cursor-pointer pointer-events-auto",
                  isNext &&
                    "absolute right-0 z-10 opacity-40 scale-[0.78] blur-[0.2px] hover:opacity-85 cursor-pointer pointer-events-auto",
                )}
                style={{
                  transformStyle: "preserve-3d",
                  transform: isActive
                    ? "none"
                    : isPrev
                      ? "translateX(-32%) rotateY(45deg) translateZ(-80px)"
                      : "translateX(32%) rotateY(-45deg) translateZ(-80px)",
                }}
              >
                <GlassCard
                  variant="liquid"
                  hover={false}
                  padding={false}
                  className="rounded-xl shadow-card overflow-hidden border border-arch-border-subtle"
                >
                  {/* Inner glass highlight ring */}
                  <div
                    className="absolute inset-0 rounded-xl ring-1 ring-inset ring-arch-border-emphasis/40 pointer-events-none"
                    aria-hidden="true"
                  />

                  <div className="px-3 py-2 sm:px-4 sm:py-2.5 w-full space-y-2 relative">
                    {/* Eyebrow badge row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-arch-border-subtle bg-arch-surface-secondary/80 backdrop-blur-sm text-[10px] font-medium tracking-wide text-arch-text-secondary">
                        <span className="w-1 h-1 rounded-full bg-accent-green" aria-hidden="true" />
                        Sector-01 Active
                      </span>
                      <span className="text-[10px] font-mono text-arch-text-tertiary tracking-wider">
                        PORTAL v1.5.1
                      </span>
                      {incidentCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-red/10 text-accent-red text-[10px] font-medium tracking-wide"
                          title={`${incidentCount} open safety incidents`}
                        >
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          {incidentCount} Open
                        </span>
                      )}
                      {breakdownCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-amber/10 text-accent-amber text-[10px] font-medium tracking-wide"
                          title={`${breakdownCount} active breakdowns`}
                        >
                          <Wrench className="w-3 h-3" aria-hidden="true" />
                          {breakdownCount} Breakdown
                        </span>
                      )}
                      {offlineMachineCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-arch-surface-tertiary text-arch-text-secondary text-[10px] font-medium tracking-wide"
                          title={`${offlineMachineCount} machines offline`}
                        >
                          <Power className="w-3 h-3" aria-hidden="true" />
                          {offlineMachineCount} Offline
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-center">
                      {/* Left Content Area (9 Cols) */}
                      <div className="lg:col-span-9 space-y-1.5 flex flex-col justify-between z-10">
                        <div className="space-y-1">
                          {/* Category & Status Pill */}
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-arch-surface-secondary border border-arch-border-subtle text-[9px] font-medium text-arch-text-secondary tracking-wide">
                              <Layers className="w-2 h-2 text-arch-accent-blue" />
                              {panel.category}
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-[8.5px] font-semibold uppercase tracking-wider">
                              <span className="w-1 h-1 rounded-full bg-accent-green" />
                              {panel.status}
                            </span>
                          </div>

                          {/* Title */}
                          <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-arch-text-primary text-balance leading-snug">
                            {panel.title}
                          </h1>

                          {/* Description */}
                          <p className="text-arch-text-secondary text-[11px] leading-tight line-clamp-1 text-pretty max-w-lg">
                            {panel.description}
                          </p>
                        </div>

                        {/* Operational Stat & CTAs Row */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {/* Stat Pill */}
                          {panel.stats && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-arch-surface-secondary/70 border border-arch-border-subtle">
                              <div className="w-4 h-4 rounded bg-arch-surface-tertiary flex items-center justify-center text-arch-accent-blue">
                                <Activity className="w-2.5 h-2.5" />
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <span className="text-[9px] font-medium text-arch-text-tertiary uppercase">
                                  {panel.stats.label}:
                                </span>
                                <span className="font-semibold text-arch-text-primary">
                                  {panel.stats.value}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              href={panel.primary.href}
                              data-cta="primary-hero"
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-arch-brand-blue text-white font-medium text-[10.5px] shadow-card hover:bg-black transition-all hover:scale-[1.01] active:scale-[0.99] min-h-[24px]"
                            >
                              {panel.primary.icon}
                              <span>{panel.primary.label}</span>
                            </Link>
                            {panel.secondary && (
                              <Link
                                href={panel.secondary.href}
                                data-cta="secondary-hero"
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-arch-surface-secondary text-arch-text-primary font-medium text-[10.5px] border border-arch-border-subtle hover:bg-arch-surface-tertiary transition-all min-h-[24px]"
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
                        <div className="relative aspect-[16/9] max-h-[44px] sm:max-h-[48px] rounded-lg overflow-hidden shadow-card border border-arch-border-subtle bg-arch-surface-tertiary">
                          {/* Visual Terrain / Industrial Image */}
                          <img
                            src={
                              failedImages.has(panel.image)
                                ? "/images/departments/overview.jpg"
                                : panel.image
                            }
                            alt={`${panel.title} visual`}
                            className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover/image:scale-102"
                            loading={isActive ? "eager" : "lazy"}
                            fetchPriority={isActive ? "high" : "low"}
                            onError={() =>
                              setFailedImages((prev) => new Set(prev).add(panel.image))
                            }
                          />

                          {/* Subtle Gradient Vignette */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

                          {/* Live Indicator Pill on Image */}
                          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-black/60 backdrop-blur-sm text-white text-[8px] font-medium border border-white/20">
                              <CheckCircle2 className="w-2 h-2 text-accent-green" />
                              {panel.name.toUpperCase()}
                            </span>
                            <span className="text-[7.5px] font-mono text-white/80 bg-black/40 px-1 py-0.2 rounded backdrop-blur-sm">
                              CAM-0{idx + 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Trust Logos section inside card */}
                    {isActive && <TrustLogos />}
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Controls & Carousel Indicator Dots */}
      {panels.length > 1 && (
        <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-arch-border-subtle/40">
          {/* Left / Right Step Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevSlide}
              aria-label="Previous department highlight"
              className="w-5 h-5 rounded-full bg-arch-surface-secondary border border-arch-border-subtle flex items-center justify-center text-arch-text-secondary hover:text-arch-text-primary hover:bg-white transition-all shadow-card active:scale-95"
            >
              <ChevronLeft className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next department highlight"
              className="w-5 h-5 rounded-full bg-arch-surface-secondary border border-arch-border-subtle flex items-center justify-center text-arch-text-secondary hover:text-arch-text-primary hover:bg-white transition-all shadow-card active:scale-95"
            >
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? "Resume auto rotation" : "Pause auto rotation"}
              className="w-5 h-5 rounded-full bg-arch-surface-secondary border border-arch-border-subtle flex items-center justify-center text-arch-text-secondary hover:text-arch-text-primary hover:bg-white transition-all shadow-sm active:scale-95 ml-0.5"
              title={isPaused ? "Resume auto-rotation" : "Pause auto-rotation"}
            >
              {isPaused ? (
                <Play className="w-2 h-2 fill-current" />
              ) : (
                <Pause className="w-2 h-2 fill-current" />
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
                  "h-0.5 rounded-full transition-all duration-300",
                  idx === activeIndex
                    ? "w-3 bg-arch-text-primary"
                    : "w-0.5 bg-arch-border-emphasis hover:bg-arch-text-secondary",
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
