"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_HIDE_MS = 3000;
const IDLE_HIDE_MS = 4000;
const BOTTOM_REVEAL_ZONE_PX = 160;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isInBottomRevealZone(clientY: number): boolean {
  return clientY >= window.innerHeight - BOTTOM_REVEAL_ZONE_PX;
}

/**
 * Hides the bottom dock on auth surfaces after idle time.
 * The top taskbar remains visible. Reveals when the pointer enters the bottom edge zone.
 */
export function useChromeAutoHide() {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(hidden);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  hiddenRef.current = hidden;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(
    (delay = IDLE_HIDE_MS) => {
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        setHidden(true);
      }, delay);
    },
    [clearHideTimer],
  );

  const reveal = useCallback(() => {
    setHidden(false);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    scheduleHide(INITIAL_HIDE_MS);

    const onPointerMove = (event: PointerEvent) => {
      const inBottomRevealZone = isInBottomRevealZone(event.clientY);

      if (hiddenRef.current) {
        if (inBottomRevealZone) {
          reveal();
        }
        return;
      }

      if (inBottomRevealZone) {
        clearHideTimer();
        return;
      }

      scheduleHide();
    };

    const onKeyDown = () => {
      if (hiddenRef.current) {
        reveal();
        return;
      }
      scheduleHide();
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest("[data-chrome-ui]")) {
        reveal();
        return;
      }

      if (target.closest("#main-content")) {
        if (!hiddenRef.current) {
          scheduleHide(1000);
        }
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      clearHideTimer();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [clearHideTimer, reveal, scheduleHide]);

  useEffect(() => {
    document.body.classList.toggle("chrome-auto-hidden", hidden);
    document.documentElement.classList.toggle("chrome-auto-hidden", hidden);

    return () => {
      document.body.classList.remove("chrome-auto-hidden");
      document.documentElement.classList.remove("chrome-auto-hidden");
    };
  }, [hidden]);

  return { hidden, reveal };
}
