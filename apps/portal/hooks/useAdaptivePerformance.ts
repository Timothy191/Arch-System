"use client";

import { useEffect, useState } from "react";
import { useFocusMode } from "@/hooks/useFocusMode";

/* AGENT-TRACE: Adaptive performance monitor.
   Removed periodic recovery checks to prevent infinite loops of the background 
   appearing and disappearing on slow devices. Once degraded, it stays degraded. */

/**
 * useAdaptivePerformance
 *
 * Hooks into the browser's requestAnimationFrame to measure frame render times.
 * If frame rate drops below 30 FPS for a sustained 2-second window, or if Focus Mode
 * is activated, returns true to signal that rendering should be downgraded.
 */
export function useAdaptivePerformance(): boolean {
  const [lowPerf, setLowPerf] = useState(false);
  const focusMode = useFocusMode((s) => s.enabled);

  useEffect(() => {
    // Focus Mode forces degraded rendering (dark atmospheric mode is lighter)
    if (focusMode) {
      setLowPerf(true);
      return;
    }

    // When focus mode is toggled OFF, clear the forced degradation so the
    // rAF loop below gets a fresh chance to measure real performance.
    setLowPerf(false);

    let frameTimes: number[] = [];
    let animationFrameId: number;
    let firstFrameTime: number | null = null;
    let startTime: number | null = null;
    let isDegraded = false;

    const WARMUP_MS = 5000; // 5 seconds — covers hydration, video decode, font swap
    const WINDOW_MS = 2000; // 2-second sliding measurement window
    const FPS_THRESHOLD = 30; // Only degrade on genuinely poor hardware

    const checkFrame = (timestamp: number) => {
      if (firstFrameTime === null) {
        firstFrameTime = timestamp;
      }

      // Warm-up: ignore frames during hydration + video decode burst
      if (timestamp - firstFrameTime < WARMUP_MS) {
        animationFrameId = requestAnimationFrame(checkFrame);
        return;
      }

      if (startTime === null) {
        startTime = timestamp;
      }

      const cutoff = timestamp - WINDOW_MS;
      frameTimes = frameTimes.filter((t) => t > cutoff);

      const lastFrameTime = frameTimes[frameTimes.length - 1];
      const delta = lastFrameTime ? timestamp - lastFrameTime : 0;

      // Discard abnormally large gaps (tab change, devtools pause, etc.)
      if (delta < 200) {
        frameTimes.push(timestamp);
      }

      // Need at least one full measurement window of data
      if (timestamp - startTime > WINDOW_MS) {
        const fps = (frameTimes.length / WINDOW_MS) * 1000;

        if (fps < FPS_THRESHOLD && !isDegraded) {
          isDegraded = true;
          setLowPerf(true);

          // Once degraded, stay degraded to prevent the UI from flickering
          // back and forth (background disappearing and appearing).
          return;
        }
      }

      animationFrameId = requestAnimationFrame(checkFrame);
    };

    animationFrameId = requestAnimationFrame(checkFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [focusMode]);

  return lowPerf;
}
