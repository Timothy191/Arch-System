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
} from "framer-motion";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Power,
} from "lucide-react";
import { cn } from "../lib/utils";
import { TrustLogos } from "./TrustLogos";

export interface Panel {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  image: string;
  stats?: { label: string; value: string };
  status: string;
  icon: React.ReactNode;
  iconBgColor: string;
  primary: { href: string; label: string; icon: React.ReactNode };
  secondary?: { href: string; label: string; icon: React.ReactNode };
}

export interface HeroRotatorProps {
  panels: Panel[];
  incidentCount?: number;
  breakdownCount?: number;
  offlineMachineCount?: number;
}

const CONFIG = {
  // AGENT-TRACE: 3D Globe cylinder carousel configuration with sleek wide horizontal profile
  cardWidth: "min(720px, 60%)", // extended horizontal width
  cardLeft: "calc((100% - min(720px, 60%)) / 2)", // centered left offset
  perspective: "1800px",
  perspectiveOrigin: "50% 35%",
  minHeight: "clamp(440px, 46vw, 560px)", // slightly increased vertical profile for more breathing room
  autoRotateMs: 6000, // interval between auto-advances
  panDivisor: 400, // px-to-index sensitivity for drag
  velocityThreshold: 300, // px/s above which a flick snaps to next/prev
  clickDragThresholdPx: 5, // pan distance above which the click handler is suppressed
} as const;

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

  const background = useMotionTemplate`radial-gradient(800px circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.3), transparent 40%)`;
  const glow = useMotionTemplate`radial-gradient(400px circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.15), transparent 40%)`;

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
        "bg-white/90 backdrop-blur-3xl liquid-glass-light border border-black/[0.06] shadow-window",
        "transition-[shadow,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group/card",
        isActive && "hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)]",
        isActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none z-0" />
      {isActive && (
        <>
          <motion.div
            className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/card:opacity-100 z-50 mix-blend-overlay"
            style={{ background }}
          />
          <motion.div
            className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/card:opacity-100 z-40"
            style={{ background: glow }}
          />
        </>
      )}
      {children}
    </motion.div>
  );
}

import { HeroCardContent } from "./HeroCardContent";

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
  incidentCount: number;
  breakdownCount: number;
  offlineMachineCount: number;
}

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
  incidentCount,
  breakdownCount,
  offlineMachineCount,
}: HeroSlideProps) {
  const panMovedRef = useRef(false);

  const offset = useTransform(smoothIndex, (v) => {
    let diff = (((v - idx) % total) + total) % total;
    if (diff > total / 2) diff -= total;
    return diff;
  });

  // AGENT-TRACE: 3D Globe Ring cylinder geometry: cards arranged circularly in 3D space with subtle 10deg lean-back on side cards and expanded radius for distinct separation
  const angleStepDeg = 360 / Math.max(total, 1);
  const radius = 980; // px distance from center of 3D cylinder for clean separation
  const leanBackDeg = 10; // Subtle 10 degree lean back tilt

  const rotateY = useTransform(offset, (v) => v * -angleStepDeg);
  const rotateX = useTransform(offset, (v) => {
    // Active card faces viewer flat (0deg), while adjacent side & back cards lean back subtly by 10deg
    const distance = Math.min(Math.abs(v), 1);
    return distance * leanBackDeg;
  });

  const x = useTransform(offset, (v) => {
    const angleRad = (v * angleStepDeg * Math.PI) / 180;
    return `${Math.sin(angleRad) * radius}px`;
  });

  const z = useTransform(offset, (v) => {
    const angleRad = (v * angleStepDeg * Math.PI) / 180;
    return (Math.cos(angleRad) - 1) * radius;
  });

  const scale = useTransform(offset, (v) => {
    const angleRad = (v * angleStepDeg * Math.PI) / 180;
    const depthFactor = (Math.cos(angleRad) + 1) / 2; // 1 at front (0 rad), 0 at back (PI rad)
    return 0.72 + depthFactor * 0.26; // 0.98 at front, 0.72 at back
  });

  const opacity = useTransform(offset, (v) => {
    const absV = Math.abs(v);
    if (absV >= 2.5) return 0;
    const angleRad = (v * angleStepDeg * Math.PI) / 180;
    const depthFactor = (Math.cos(angleRad) + 1) / 2;
    const baseOpacity = 0.4 + depthFactor * 0.6;
    if (absV > 1.8) {
      // Smoothly fade out distant back-facing slides to prevent visual ghosting and clutter
      return baseOpacity * (1 - (absV - 1.8) / 0.7);
    }
    return baseOpacity;
  });

  const zIndex = useTransform(offset, (v) => {
    const angleRad = (v * angleStepDeg * Math.PI) / 180;
    return Math.round(50 + Math.cos(angleRad) * 40); // 90 at front, 10 at back
  });

  const pointerEvents = useTransform(offset, (v) => (Math.abs(v) < 0.5 ? "auto" : "none"));
  const blurValue = useTransform(offset, (v) => {
    const angleRad = (v * angleStepDeg * Math.PI) / 180;
    const depthFactor = (Math.cos(angleRad) + 1) / 2;
    return (1 - depthFactor) * 2; // 0px blur at front, 2px slight atmospheric blur at far back
  });
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
        <HeroCardContent
          panel={panel}
          idx={idx}
          isActive={isActive}
          failedImages={failedImages}
          onImageError={onImageError}
          incidentCount={incidentCount}
          breakdownCount={breakdownCount}
          offlineMachineCount={offlineMachineCount}
        />
      </InteractiveGlassCard>
    </motion.div>
  );
}

export function HeroRotator({
  panels,
  incidentCount = 0,
  breakdownCount = 0,
  offlineMachineCount = 0,
}: HeroRotatorProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const carouselIndex = useMotionValue(0);
  const smoothIndex = useSpring(carouselIndex, { stiffness: 280, damping: 32, mass: 0.8 });

  const activeIndexRef = useRef(0);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

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
              incidentCount={incidentCount}
              breakdownCount={breakdownCount}
              offlineMachineCount={offlineMachineCount}
            />
          ))}
        </div>
      </div>

      {total > 1 && (
        <div className="mt-5 flex items-center justify-between px-1">
          <div className="flex items-center gap-1 liquid-glass-light border border-black/10 shadow-window p-1 rounded-full">
            <button
              onClick={prevSlide}
              aria-label="Previous highlight"
              className="p-1.5 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next highlight"
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
