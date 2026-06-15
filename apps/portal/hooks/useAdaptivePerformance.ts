"use client";

import { useEffect, useState } from "react";
import { useFocusMode } from "@/hooks/useFocusMode";

/**
 * useAdaptivePerformance
 *
 * Hooks into the browser's requestAnimationFrame to measure frame render times.
 * If frame rate drops below 45 FPS for a sustained 3-second window, or if Focus Mode
 * is activated, returns true to signal that rendering should be downgraded.
 */
export function useAdaptivePerformance(): boolean {
  const [lowPerf, setLowPerf] = useState(false);
  const focusMode = useFocusMode((s) => s.enabled);

  useEffect(() => {
    // If Focus Mode is enabled, immediately trigger the performance fallback
    if (focusMode) {
      setLowPerf(true);
      return;
    }

    let frameTimes: number[] = [];
    let animationFrameId: number;
    let firstFrameTime: number | null = null;
    let startTime: number | null = null;
    let isDegraded = false;

    const checkFrame = (timestamp: number) => {
      if (firstFrameTime === null) {
        firstFrameTime = timestamp;
      }

      // Warm up period of 2.5 seconds to ignore hydration lag
      if (timestamp - firstFrameTime < 2500) {
        animationFrameId = requestAnimationFrame(checkFrame);
        return;
      }

      if (startTime === null) {
        startTime = timestamp;
      }
      const cutoff = timestamp - 1500;
      // Filter out frames older than 1.5 seconds
      frameTimes = frameTimes.filter((t) => t > cutoff);

      const lastFrameTime = frameTimes[frameTimes.length - 1];
      const delta = lastFrameTime ? timestamp - lastFrameTime : 0;

      // Only record the frame if the delta isn't abnormally large
      // (large deltas occur during tab changes or initial page load)
      if (delta < 200) {
        frameTimes.push(timestamp);
      }

      // Check performance only after collecting data for at least 1.5 seconds (1500ms)
      if (timestamp - startTime > 1500 && !isDegraded) {
        // Average FPS in the 1.5-second window
        // FPS = (number of frames in 1.5s) / 1.5
        const fps = frameTimes.length / 1.5;

        if (fps < 50) {
          isDegraded = true;
          setLowPerf(true);
          // Stop looping once performance fallback is engaged
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
