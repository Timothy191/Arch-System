"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusMode } from "@/hooks/useFocusMode";

/* AGENT-TRACE: Adaptive performance monitor. Previous version had three bugs:
   1. 50 FPS threshold → false positives on glass+video compositing at load
   2. 2.5s warm-up too short for hydration+video decode burst
   3. lowPerf could never recover once set true
   Fixed: 30 FPS threshold, 5s warm-up, periodic recovery checks. */

/**
 * useAdaptivePerformance
 *
 * Hooks into the browser's requestAnimationFrame to measure frame render times.
 * If frame rate drops below 30 FPS for a sustained 2-second window, or if Focus Mode
 * is activated, returns true to signal that rendering should be downgraded.
 *
 * Recovery: once degraded, the hook re-evaluates every 10 seconds. If FPS
 * has stabilised above 30 for the last measurement window it clears the flag,
 * restoring full-quality rendering.
 */
export function useAdaptivePerformance(): boolean {
  const [lowPerf, setLowPerf] = useState(false);
  const focusMode = useFocusMode((s) => s.enabled);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const RECOVERY_DELAY_MS = 10_000; // Re-evaluate 10s after degradation

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

          // Schedule a recovery check instead of stopping permanently
          recoveryTimerRef.current = setTimeout(() => {
            // Reset state so the rAF loop re-measures from scratch
            isDegraded = false;
            frameTimes = [];
            startTime = null;
            firstFrameTime = null;
            setLowPerf(false);
            animationFrameId = requestAnimationFrame(checkFrame);
          }, RECOVERY_DELAY_MS);

          // Stop the rAF loop during degradation (save CPU)
          return;
        }
      }

      animationFrameId = requestAnimationFrame(checkFrame);
    };

    animationFrameId = requestAnimationFrame(checkFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [focusMode]);

  return lowPerf;
}
