"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const lenis = new Lenis({
      duration: 0.6,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    let rafId: number;
    let ticking = true;

    function raf(time: number) {
      if (!ticking) return;
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    function onVisibilityChange() {
      ticking = !document.hidden;
      if (ticking) {
        rafId = requestAnimationFrame(raf);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
