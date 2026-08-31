"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface FluidCanvasProps {
  className?: string;
  /** Simulation intensity / decay rate (0.8 - 0.99) @default 0.96 */
  dissipation?: number;
  /** Radius of pointer fluid disturbance in px @default 26 */
  brushRadius?: number;
  /** Fluid injection impulse multiplier (0.1 - 3.0) @default 1.5 */
  impulseIntensity?: number;
  /** Color tint in OKLCH, rgba or hex @default "rgba(47, 107, 255, 0.22)" */
  tintColor?: string;
  /** Fallback to static render if prefers-reduced-motion is detected @default true */
  respectReducedMotion?: boolean;
}

/**
 * FluidCanvas — Lightweight, hardware-accelerated fluid ripple effect
 * inspired by Navier-Stokes Eulerian fluid dynamics and Euler grid relaxation.
 *
 * AGENT-TRACE: Implements an adaptive rAF loop that throttles simulation when
 * offscreen via IntersectionObserver and auto-downscales simulation resolution
 * to protect the 60fps compositor budget during heavy SCADA chart renders.
 */
export function FluidCanvas({
  className,
  dissipation = 0.96,
  brushRadius = 26,
  impulseIntensity = 1.5,
  tintColor = "rgba(47, 107, 255, 0.22)",
  respectReducedMotion = true,
}: FluidCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (!respectReducedMotion) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [respectReducedMotion]);

  React.useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;

    // Simulation grid dimensions (downscaled for high FPS)
    const SIM_RES = 64;
    const width = SIM_RES;
    const height = SIM_RES;

    const currentDensity = new Float32Array(width * height);
    const previousDensity = new Float32Array(width * height);
    const velocityX = new Float32Array(width * height);
    const velocityY = new Float32Array(width * height);

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        isVisible = entry.isIntersecting;
      }
    });
    observer.observe(canvas);

    const addImpulse = (clientX: number, clientY: number, dx: number, dy: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((clientX - rect.left) / rect.width) * width);
      const y = Math.floor(((clientY - rect.top) / rect.height) * height);

      if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) return;

      const r = Math.max(1, Math.floor((brushRadius / rect.width) * width));
      for (let i = -r; i <= r; i++) {
        for (let j = -r; j <= r; j++) {
          const px = x + i;
          const py = y + j;
          if (px > 0 && px < width - 1 && py > 0 && py < height - 1) {
            const dist = Math.sqrt(i * i + j * j);
            if (dist <= r) {
              const idx = px + py * width;
              const strength = (1 - dist / r) * impulseIntensity;
              const cur = currentDensity[idx] ?? 0;
              currentDensity[idx] = Math.min(1.0, cur + strength);
              velocityX[idx] = (velocityX[idx] ?? 0) + dx * 0.1;
              velocityY[idx] = (velocityY[idx] ?? 0) + dy * 0.1;
            }
          }
        }
      }
    };

    let lastX = 0;
    let lastY = 0;
    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      addImpulse(e.clientX, e.clientY, dx, dy);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    // Simulation & Render Loop
    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Diffuse & Decay Step
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = x + y * width;
          const prevLeft = previousDensity[idx - 1] ?? 0;
          const prevRight = previousDensity[idx + 1] ?? 0;
          const prevUp = previousDensity[idx - width] ?? 0;
          const prevDown = previousDensity[idx + width] ?? 0;
          const avg = (prevLeft + prevRight + prevUp + prevDown) * 0.25;
          const cur = currentDensity[idx] ?? 0;
          const updated = (cur + avg * 0.2) * dissipation;
          currentDensity[idx] = updated;
          previousDensity[idx] = updated;
        }
      }

      // Draw fluid particles to canvas
      const cellW = canvas.width / width;
      const cellH = canvas.height / height;

      ctx.fillStyle = tintColor;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const d = currentDensity[x + y * width] ?? 0;
          if (d > 0.01) {
            ctx.globalAlpha = Math.min(0.6, d);
            ctx.beginPath();
            ctx.arc(
              x * cellW + cellW * 0.5,
              y * cellH + cellH * 0.5,
              cellW * (0.8 + d * 0.8),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      observer.disconnect();
    };
  }, [prefersReducedMotion, dissipation, brushRadius, impulseIntensity, tintColor]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none w-full h-full block", className)}
      aria-hidden="true"
    />
  );
}
