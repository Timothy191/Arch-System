"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  type MotionValue,
  type PanInfo,
} from "framer-motion";
import {
  Play,
  Pause,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Power,
  Pickaxe,
  TrendingUp,
  ScanFace,
  CreditCard,
  TowerControl,
  HardHat,
  GraduationCap,
  Orbit,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Logo } from "@repo/ui/Logo";
import type { Department } from "@repo/departments/data-access";
import { TrustLogos } from "./TrustLogos";

// AGENT-TRACE: Elite-Tier 3D Carousel Implementation
// Uses continuous MotionValue physics for zero-reflow GPU compositing.
// Features InteractiveGlassCard with cursor-reactive specular sheen and 3D micro-tilt.
// AGENT-TRACE: 2026-08-24 — Per-slide useTransform hooks extracted into <HeroSlide>
// to satisfy Rules-of-Hooks (previously called inside panels.map). Hover-pause and
// manual-pause states are now separate so cursor movement cannot clobber the
// play/pause toggle. Carousel root now handles ArrowLeft/ArrowRight keyboard nav.

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

interface Panel {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  image: string;
  stats: { label: string; value: string };
  status: string;
  icon: React.ReactNode;
  iconBgColor: string;
  primary: { href: string; label: string; icon: React.ReactNode };
  secondary?: { href: string; label: string; icon: React.ReactNode };
}

/**
 * Centralized tuning constants for the carousel. Extracted so future editors
 * can reason about geometry/timing without hunting for magic numbers.
 */
const CONFIG = {
  cardWidth: "52%", // active card column width
  cardLeft: "24%", // left offset that centers the active card in the track
  perspective: "1200px",
  perspectiveOrigin: "50% 40%",
  minHeight: "clamp(380px, 48vw, 560px)",
  autoRotateMs: 6000, // interval between auto-advances
  panDivisor: 400, // px-to-index sensitivity for drag
  velocityThreshold: 300, // px/s above which a flick snaps to next/prev
  clickDragThresholdPx: 5, // pan distance above which the click handler is suppressed
} as const;

const DEPT_STYLE_MAP: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; iconColor: string; bgColor: string }
> = {
  drilling: { icon: Pickaxe, iconColor: "text-dept-drilling", bgColor: "bg-dept-drilling/10" },
  production: {
    icon: TrendingUp,
    iconColor: "text-dept-production",
    bgColor: "bg-dept-production/10",
  },
  "access-control": {
    icon: ScanFace,
    iconColor: "text-dept-access-control",
    bgColor: "bg-dept-access-control/10",
  },
  "access-card-actions": {
    icon: CreditCard,
    iconColor: "text-dept-access-card-actions",
    bgColor: "bg-dept-access-card-actions/10",
  },
  engineering: {
    icon: Wrench,
    iconColor: "text-dept-engineering",
    bgColor: "bg-dept-engineering/10",
  },
  "control-room": {
    icon: TowerControl,
    iconColor: "text-dept-control-room",
    bgColor: "bg-dept-control-room/10",
  },
  safety: { icon: HardHat, iconColor: "text-dept-safety", bgColor: "bg-dept-safety/10" },
  training: {
    icon: GraduationCap,
    iconColor: "text-dept-training",
    bgColor: "bg-dept-training/10",
  },
  "satellite-monitoring": {
    icon: Orbit,
    iconColor: "text-dept-satellite",
    bgColor: "bg-dept-satellite/10",
  },
};

function InteractiveGlassCard({
  children,
  isActive,
}: {
  children: React.ReactNode;
  isActive: boolean;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), {
    stiffness: 400,
    damping: 35,
    mass: 0.5,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 400,
    damping: 35,
    mass: 0.5,
  });

  const sheenX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const sheenY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  const background = useMotionTemplate`radial-gradient(600px circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.12), transparent 40%)`;

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: isActive ? rotateX : 0,
        rotateY: isActive ? rotateY : 0,
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "relative h-full w-full rounded-2xl overflow-hidden",
        "liquid-glass-light border border-black/80 shadow-window",
        "transition-shadow duration-300 group/card",
        isActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      {isActive && (
        <motion.div
          className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 z-50 mix-blend-overlay"
          style={{ background }}
        />
      )}
      {children}
    </motion.div>
  );
}

interface HeroSlideProps {
  panel: Panel;
  idx: number;
  total: number;
  smoothIndex: MotionValue<number>;
  carouselIndex: MotionValue<number>;
  isActive: boolean;
  failedImages: Set<string>;
  onImageError: (src: string) => void;
  onJumpTo: (idx: number) => void;
  arrowIcon: React.ReactNode;
  incidentCount: number;
  breakdownCount: number;
  offlineMachineCount: number;
}

/**
 * Single carousel slide. Owns its per-panel useTransform hooks at the top
 * level of a real component so the Rules of Hooks are satisfied (previously
 * these hooks were called inside HeroRotator's panels.map, which only worked
 * while the panel count/order never changed between renders).
 */
function HeroSlide({
  panel,
  idx,
  total,
  smoothIndex,
  carouselIndex,
  isActive,
  failedImages,
  onImageError,
  onJumpTo,
  arrowIcon,
  incidentCount,
  breakdownCount,
  offlineMachineCount,
}: HeroSlideProps) {
  // AGENT-TRACE: drag-distance guard so a pan-release click does not also fire
  // jumpToSlide and double-advance the carousel.
  const panMovedRef = useRef(false);

  const offset = useTransform(smoothIndex, (v) => {
    let diff = (((v - idx) % total) + total) % total;
    if (diff > total / 2) diff -= total;
    return diff;
  });

  const rotateY = useTransform(offset, [-2, -1, 0, 1, 2], [0, -42, 0, 42, 0]);
  const rotateX = useTransform(offset, [-2, -1, 0, 1, 2], [12, 6, 0, 6, 12]);
  const x = useTransform(offset, [-2, -1, 0, 1, 2], ["0%", "-100%", "0%", "100%", "0%"]);
  const z = useTransform(offset, [-2, -1, 0, 1, 2], [-250, -120, 0, -120, -250]);
  const imageX = useTransform(offset, [-2, -1, 0, 1, 2], ["25%", "12%", "0%", "-12%", "-25%"]);
  const scale = useTransform(offset, [-2, -1, 0, 1, 2], [0.7, 0.88, 1, 0.88, 0.7]);
  const opacity = useTransform(offset, [-2, -1, 0, 1, 2], [0, 0.65, 1, 0.65, 0]);
  const zIndex = useTransform(offset, (v) => Math.round(20 - Math.abs(v) * 10));
  const pointerEvents = useTransform(offset, (v) => (Math.abs(v) < 0.1 ? "auto" : "none"));
  const blurValue = useTransform(offset, [-2, -1, 0, 1, 2], [8, 4, 0, 4, 8]);
  const filter = useMotionTemplate`blur(${blurValue}px)`;

  return (
    <motion.div
      key={panel.id}
      role="group"
      aria-roledescription="slide"
      aria-label={`${idx + 1} of ${total}: ${panel.title}`}
      inert={!isActive}
      aria-hidden={!isActive}
      onPan={(_e, info) => {
        if (Math.abs(info.delta.x) > 0) {
          panMovedRef.current = true;
          carouselIndex.set(carouselIndex.get() - info.delta.x / CONFIG.panDivisor);
        }
      }}
      onPanEnd={(_e, info) => {
        const current = carouselIndex.get();
        const velocity = info.velocity.x;
        let target = Math.round(current);
        if (velocity < -CONFIG.velocityThreshold) target = Math.ceil(current);
        if (velocity > CONFIG.velocityThreshold) target = Math.floor(current);
        carouselIndex.set(target);
      }}
      onClick={() => {
        // Suppress the click that follows a drag so pan-release doesn't also
        // jump to the clicked (possibly inactive) slide.
        if (panMovedRef.current) {
          panMovedRef.current = false;
          return;
        }
        if (!isActive) {
          onJumpTo(idx);
        }
      }}
      style={{
        width: CONFIG.cardWidth,
        left: CONFIG.cardLeft,
        transformStyle: "preserve-3d",
        transformOrigin: "center center",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        rotateY,
        rotateX,
        x,
        scale,
        opacity,
        zIndex,
        pointerEvents,
        z,
        filter,
      }}
      className="absolute top-0 bottom-0 will-change-transform transform-gpu"
    >
      <InteractiveGlassCard isActive={isActive}>
        <div className="relative h-full flex flex-col px-5 py-5 sm:px-7 sm:py-6 z-10">
          {/* ── Eyebrow row ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-black/10 bg-black/[0.04] backdrop-blur-sm font-medium tracking-wide text-[var(--text-secondary)]">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"
                  aria-hidden="true"
                />
                Sector-01 Active
              </span>
              <span className="text-[var(--text-muted)] tracking-wider">PORTAL v1.5.1</span>
            </div>

            <div className="flex items-center gap-1.5">
              {incidentCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-red/10 text-accent-red border border-accent-red/20 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {incidentCount} Open
                </span>
              )}
              {breakdownCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-amber/10 text-accent-amber border border-accent-amber/20 font-medium">
                  <Wrench className="w-3 h-3" />
                  {breakdownCount} Breakdown{breakdownCount !== 1 ? "s" : ""}
                </span>
              )}
              {offlineMachineCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/[0.04] text-[var(--text-secondary)] border border-black/10 font-medium">
                  <Power className="w-3 h-3" />
                  {offlineMachineCount} Offline
                </span>
              )}
              {incidentCount === 0 && breakdownCount === 0 && offlineMachineCount === 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20 font-medium">
                  Nominal
                </span>
              )}
            </div>
          </div>

          {/* ── Title & Department Icon Badge ── */}
          <div className="mt-4 space-y-1.5 flex-grow">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border border-black/5 shadow-sm transition-transform",
                  panel.iconBgColor,
                )}
              >
                {panel.icon}
              </div>
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                {panel.category}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-heading)] leading-snug text-balance">
              {panel.title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2 max-w-lg">
              {panel.description}
            </p>
          </div>

          {/* ── Stat + CTAs (Styled after Mac Taskbar controls) ── */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {panel.stats && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.03] border border-black/10 text-xs">
                <Activity className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0" />
                <span className="text-[var(--text-muted)] uppercase text-[10px] font-medium">
                  {panel.stats.label}:
                </span>
                <span className="font-semibold text-[var(--text-heading)]">
                  {panel.stats.value}
                </span>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 ml-auto">
              <Link
                href={panel.primary.href}
                data-cta="primary-hero"
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white font-medium text-xs shadow-card border border-black/80 hover:bg-[var(--accent-blue)]/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                tabIndex={isActive ? 0 : -1}
              >
                {panel.primary.icon}
                {panel.primary.label}
              </Link>
              {panel.secondary && (
                <Link
                  href={panel.secondary.href}
                  data-cta="secondary-hero"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.07] text-[var(--text-heading)] font-medium text-xs border border-black/80 transition-all active:scale-95"
                  tabIndex={isActive ? 0 : -1}
                >
                  {panel.secondary.icon}
                  {panel.secondary.label}
                </Link>
              )}
            </div>
          </div>

          {/* ── Scoped image strip ── */}
          <div className="relative mt-4 flex-shrink-0 h-28 sm:h-36 w-full overflow-hidden rounded-xl border border-black/80 bg-black/[0.02] shadow-sm group/img">
            <motion.img
              style={{ x: imageX }}
              src={failedImages.has(panel.image) ? "/images/departments/overview.jpg" : panel.image}
              alt={`${panel.title} visual`}
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover/img:scale-105"
              loading={isActive ? "eager" : "lazy"}
              fetchPriority={isActive ? "high" : "low"}
              onError={() => onImageError(panel.image)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[9px] font-medium border border-white/20">
                <CheckCircle2 className="w-2.5 h-2.5 text-accent-green" />
                {panel.name.toUpperCase()}
              </span>
              <span className="text-[8px] font-mono text-white/90 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-md border border-white/20">
                CAM-{String(idx + 1).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* ── Trust logos (active card only) ── */}
          {isActive && (
            <div className="mt-3 opacity-70">
              <TrustLogos />
            </div>
          )}
        </div>
      </InteractiveGlassCard>
    </motion.div>
  );
}

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
  // AGENT-TRACE: hover-pause and manual-pause are separate so moving the cursor
  // no longer clobbers the user's play/pause toggle.
  const [isHovering, setIsHovering] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const carouselIndex = useMotionValue(0);
  const smoothIndex = useSpring(carouselIndex, { stiffness: 280, damping: 32, mass: 0.8 });

  // AGENT-TRACE: ref mirror of activeIndex so the carouselIndex.onChange
  // subscription can bind once without resubscribing on every index change.
  const activeIndexRef = useRef(0);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const arrowIcon = <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />;

  const panels: Panel[] = [
    {
      id: "overview",
      name: "overview",
      title: defaultTitle,
      description: defaultDescription,
      category: "Central Command",
      image: "/images/departments/overview.jpg",
      stats: { label: "System Health", value: "100% Optimal" },
      status: "active",
      icon: <Logo className="w-4 h-4 text-[var(--accent-blue)]" />,
      iconBgColor: "bg-[var(--accent-blue)]/10",
      primary: { href: primaryHref, label: primaryLabel, icon: arrowIcon },
      secondary: { href: secondaryHref, label: secondaryLabel, icon: arrowIcon },
    },
    ...departments.map((dept): Panel => {
      const style = DEPT_STYLE_MAP[dept.name] || {
        icon: Layers,
        iconColor: "text-[var(--accent-blue)]",
        bgColor: "bg-[var(--accent-blue)]/10",
      };
      const DeptIcon = style.icon;

      return {
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
        icon: <DeptIcon className={cn("w-4 h-4", style.iconColor)} />,
        iconBgColor: style.bgColor,
        primary: dept.actions?.[0]
          ? { href: dept.actions[0].href, label: dept.actions[0].label, icon: arrowIcon }
          : { href: `/${dept.name}`, label: `Launch ${dept.displayName}`, icon: arrowIcon },
        secondary: dept.actions?.[1]
          ? { href: dept.actions[1].href, label: dept.actions[1].label, icon: arrowIcon }
          : undefined,
      };
    }),
  ];

  const total = panels.length;

  useEffect(() => {
    return carouselIndex.onChange((v) => {
      const normalized = ((Math.round(v) % total) + total) % total;
      if (normalized !== activeIndexRef.current) {
        setActiveIndex(normalized);
      }
    });
  }, [carouselIndex, total]);

  const nextSlide = useCallback(() => {
    carouselIndex.set(Math.round(carouselIndex.get()) + 1);
  }, [carouselIndex]);

  const prevSlide = useCallback(() => {
    carouselIndex.set(Math.round(carouselIndex.get()) - 1);
  }, [carouselIndex]);

  const jumpToSlide = useCallback(
    (targetIdx: number) => {
      const current = Math.round(carouselIndex.get());
      const currentIdx = ((current % total) + total) % total;
      let diff = (targetIdx - currentIdx) % total;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;
      carouselIndex.set(current + diff);
    },
    [carouselIndex, total],
  );

  const handleImageError = useCallback((src: string) => {
    setFailedImages((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  useEffect(() => {
    if (total <= 1 || isHovering || isManuallyPaused) return;
    const id = setInterval(nextSlide, CONFIG.autoRotateMs);
    return () => clearInterval(id);
  }, [total, isHovering, isManuallyPaused, nextSlide]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (total <= 1) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevSlide();
      }
    },
    [total, nextSlide, prevSlide],
  );

  return (
    <div
      className="relative w-full select-none py-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40 rounded-2xl"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Department Hero Highlights"
    >
      <div
        className="relative w-full"
        style={{ perspective: CONFIG.perspective, perspectiveOrigin: CONFIG.perspectiveOrigin }}
      >
        <div
          className="relative w-full overflow-hidden"
          style={{ height: CONFIG.minHeight, touchAction: "pan-y" }}
        >
          {panels.map((panel, idx) => (
            <HeroSlide
              key={panel.id}
              panel={panel}
              idx={idx}
              total={total}
              smoothIndex={smoothIndex}
              carouselIndex={carouselIndex}
              isActive={idx === activeIndex}
              failedImages={failedImages}
              onImageError={handleImageError}
              onJumpTo={jumpToSlide}
              arrowIcon={arrowIcon}
              incidentCount={incidentCount}
              breakdownCount={breakdownCount}
              offlineMachineCount={offlineMachineCount}
            />
          ))}
        </div>
      </div>

      {/* ── Floating control HUD ─────────── */}
      {total > 1 && (
        <div className="mt-5 flex items-center justify-between px-1">
          <div className="flex items-center gap-1 liquid-glass-light border border-black/10 shadow-window p-1 rounded-full">
            <button
              onClick={prevSlide}
              aria-label="Previous department highlight"
              className="p-1.5 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next department highlight"
              className="p-1.5 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-3.5 bg-black/10 mx-0.5" />
            <button
              onClick={() => setIsManuallyPaused((p) => !p)}
              aria-label={isManuallyPaused ? "Resume auto rotation" : "Pause auto rotation"}
              className="p-1.5 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              {isManuallyPaused ? (
                <Play className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Pause className="w-3.5 h-3.5 fill-current" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {panels.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => jumpToSlide(idx)}
                aria-label={`Jump to ${p.title}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === activeIndex
                    ? "w-6 bg-[var(--accent-blue)]"
                    : "w-1.5 bg-black/20 hover:bg-black/40",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
