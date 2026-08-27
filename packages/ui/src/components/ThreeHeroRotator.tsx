"use client";

import { useRef, useState, useEffect, useCallback, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Panel, HeroRotatorProps } from "./HeroRotator";
import { HeroCardContent } from "./HeroCardContent";
import { cn } from "../lib/utils";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";

// AGENT-TRACE: 3D Cylinder configuration for React Three Fiber hero carousel
const R3F_CONFIG = {
  radius: 6.8,
  cardWidthPx: 640,
  cardHeightPx: 380,
  fov: 42,
  cameraZ: 11.5,
  autoRotateMs: 6000,
  rotDamping: 0.08,
  swipeThresholdPx: 45,
} as const;

interface ThreeCardProps {
  panel: Panel;
  idx: number;
  total: number;
  targetIndex: number;
  failedImages: Set<string>;
  onImageError: (src: string) => void;
  onSelect: (idx: number) => void;
  incidentCount: number;
  breakdownCount: number;
  offlineMachineCount: number;
}

function ThreeCardItem({
  panel,
  idx,
  total,
  targetIndex,
  failedImages,
  onImageError,
  onSelect,
  incidentCount,
  breakdownCount,
  offlineMachineCount,
}: ThreeCardProps) {
  const angleStep = (2 * Math.PI) / total;
  const cardAngle = idx * angleStep;

  // Position on circle in XZ plane
  const x = R3F_CONFIG.radius * Math.sin(cardAngle);
  const z = R3F_CONFIG.radius * Math.cos(cardAngle);
  const rotY = cardAngle;

  const normalizedActive = ((Math.round(targetIndex) % total) + total) % total;
  const isActive = idx === normalizedActive;

  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Html
        transform
        distanceFactor={7.5}
        position={[0, 0, 0]}
        style={{
          width: `${R3F_CONFIG.cardWidthPx}px`,
          height: `${R3F_CONFIG.cardHeightPx}px`,
          userSelect: "none",
        }}
        className={cn(
          "transition-opacity duration-500",
          isActive ? "opacity-100" : "opacity-40 hover:opacity-75 cursor-pointer",
        )}
      >
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`${idx + 1} of ${total}: ${panel.title}`}
          aria-hidden={!isActive}
          onClick={() => {
            if (!isActive) onSelect(idx);
          }}
          className={cn(
            "relative h-full w-full rounded-2xl overflow-hidden select-none",
            "bg-white/90 backdrop-blur-3xl liquid-glass-light border border-black/[0.06] shadow-window",
            "transition-[shadow,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isActive && "hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)]",
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none z-0" />
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
        </div>
      </Html>
    </group>
  );
}

function CarouselCylinder({
  panels,
  targetIndex,
  failedImages,
  onImageError,
  onSelect,
  incidentCount,
  breakdownCount,
  offlineMachineCount,
}: {
  panels: Panel[];
  targetIndex: number;
  failedImages: Set<string>;
  onImageError: (src: string) => void;
  onSelect: (idx: number) => void;
  incidentCount: number;
  breakdownCount: number;
  offlineMachineCount: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const currentAngleRef = useRef(0);
  const total = panels.length;
  const angleStep = (2 * Math.PI) / total;

  useFrame(() => {
    if (!groupRef.current) return;
    const targetAngle = -targetIndex * angleStep;
    // Smooth lerp towards target angle
    currentAngleRef.current = THREE.MathUtils.lerp(
      currentAngleRef.current,
      targetAngle,
      R3F_CONFIG.rotDamping,
    );
    groupRef.current.rotation.y = currentAngleRef.current;
  });

  return (
    <group ref={groupRef}>
      {panels.map((panel, idx) => (
        <ThreeCardItem
          key={panel.id}
          panel={panel}
          idx={idx}
          total={total}
          targetIndex={targetIndex}
          failedImages={failedImages}
          onImageError={onImageError}
          onSelect={onSelect}
          incidentCount={incidentCount}
          breakdownCount={breakdownCount}
          offlineMachineCount={offlineMachineCount}
        />
      ))}
    </group>
  );
}

export function ThreeHeroRotator({
  panels,
  incidentCount = 0,
  breakdownCount = 0,
  offlineMachineCount = 0,
}: HeroRotatorProps) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Pointer event gesture tracking
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = panels.length;

  const nextSlide = useCallback(() => {
    setTargetIndex((prev) => prev + 1);
  }, []);

  const prevSlide = useCallback(() => {
    setTargetIndex((prev) => prev - 1);
  }, []);

  const jumpToSlide = useCallback(
    (targetIdx: number) => {
      const currentIdx = ((Math.round(targetIndex) % total) + total) % total;
      let diff = (targetIdx - currentIdx) % total;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;
      setTargetIndex((prev) => prev + diff);
    },
    [targetIndex, total],
  );

  const handleImageError = useCallback((src: string) => {
    setFailedImages((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsManuallyPaused((p) => !p);
      }
    },
    [nextSlide, prevSlide],
  );

  // Pointer swipe handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const anyE = e as unknown as Record<string, unknown>;
    const nativeE = (e.nativeEvent || {}) as unknown as Record<string, unknown>;
    const cx =
      typeof anyE.clientX === "number"
        ? anyE.clientX
        : typeof nativeE.clientX === "number"
          ? nativeE.clientX
          : typeof anyE.pageX === "number"
            ? anyE.pageX
            : null;
    const cy =
      typeof anyE.clientY === "number"
        ? anyE.clientY
        : typeof nativeE.clientY === "number"
          ? nativeE.clientY
          : typeof anyE.pageY === "number"
            ? anyE.pageY
            : null;
    pointerStartX.current = cx;
    pointerStartY.current = cy;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null || pointerStartY.current === null) return;
    const anyE = e as unknown as Record<string, unknown>;
    const nativeE = (e.nativeEvent || {}) as unknown as Record<string, unknown>;
    const cx =
      typeof anyE.clientX === "number"
        ? anyE.clientX
        : typeof nativeE.clientX === "number"
          ? nativeE.clientX
          : typeof anyE.pageX === "number"
            ? anyE.pageX
            : null;
    const cy =
      typeof anyE.clientY === "number"
        ? anyE.clientY
        : typeof nativeE.clientY === "number"
          ? nativeE.clientY
          : typeof anyE.pageY === "number"
            ? anyE.pageY
            : null;

    if (cx !== null && cy !== null) {
      const deltaX = cx - pointerStartX.current;
      const deltaY = cy - pointerStartY.current;

      // Only fire horizontal swipe if horizontal displacement exceeds vertical and passes threshold
      if (Math.abs(deltaX) > R3F_CONFIG.swipeThresholdPx && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }
    pointerStartX.current = null;
    pointerStartY.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches[0]) {
      pointerStartX.current = e.touches[0].clientX;
      pointerStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null || pointerStartY.current === null) return;
    const touch = e.changedTouches[0];
    if (touch) {
      const deltaX = touch.clientX - pointerStartX.current;
      const deltaY = touch.clientY - pointerStartY.current;

      if (Math.abs(deltaX) > R3F_CONFIG.swipeThresholdPx && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }
    pointerStartX.current = null;
    pointerStartY.current = null;
  };

  useEffect(() => {
    if (total <= 1 || isHovering || isManuallyPaused) return;
    const id = setInterval(nextSlide, R3F_CONFIG.autoRotateMs);
    return () => clearInterval(id);
  }, [total, isHovering, isManuallyPaused, nextSlide]);

  const activeIndex = ((Math.round(targetIndex) % total) + total) % total;

  if (!mounted) {
    return (
      <div
        className="relative w-full rounded-2xl bg-black/[0.02] border border-black/5 flex items-center justify-center"
        style={{ height: "480px" }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="relative w-full select-none py-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40 rounded-2xl"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Department Hero Highlights"
      aria-live="polite"
    >
      {/* Screen reader live announcement */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {total > 0 && panels[activeIndex]
          ? `Showing slide ${activeIndex + 1} of ${total}: ${panels[activeIndex].title}`
          : ""}
      </span>

      <div
        className="relative w-full overflow-hidden touch-pan-y cursor-grab active:cursor-grabbing"
        style={{ height: "520px" }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Canvas
          camera={{ position: [0, 0, R3F_CONFIG.cameraZ], fov: R3F_CONFIG.fov }}
          style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[5, 10, 5]} intensity={1.2} />
          <Suspense fallback={null}>
            <CarouselCylinder
              panels={panels}
              targetIndex={targetIndex}
              failedImages={failedImages}
              onImageError={handleImageError}
              onSelect={jumpToSlide}
              incidentCount={incidentCount}
              breakdownCount={breakdownCount}
              offlineMachineCount={offlineMachineCount}
            />
          </Suspense>
        </Canvas>
      </div>

      {total > 1 && (
        <div className="mt-4 flex items-center justify-between px-2">
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
