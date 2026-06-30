/**
 * Randomized specular shine orchestration — recursive setTimeout (no fixed intervals).
 */

const SHINE_DURATION_MS = 1500;
const MIN_DELAY_MS = 6000;
const MAX_DELAY_MS = 15000;
const SHINE_TARGET_SELECTOR = ".glass-shine-target";

function randomDelayMs(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getTargets(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SHINE_TARGET_SELECTOR));
}

function stripShineClass(targets: HTMLElement[]): void {
  targets.forEach((el) => el.classList.remove("animate-shine"));
}

/**
 * Schedules unpredictable glass shine sweeps on all `.glass-shine-target` nodes.
 * Returns a dispose function for route unmount / effect cleanup.
 */
export function triggerShineRandomly(): () => void {
  if (prefersReducedMotion()) {
    return () => undefined;
  }

  let cancelled = false;
  let scheduleId: ReturnType<typeof setTimeout> | null = null;
  let stripId: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = () => {
    if (cancelled) return;

    scheduleId = setTimeout(() => {
      if (cancelled) return;

      const targets = getTargets();
      if (targets.length === 0) {
        scheduleNext();
        return;
      }

      targets.forEach((el) => el.classList.add("animate-shine"));

      stripId = setTimeout(() => {
        stripShineClass(targets);
        scheduleNext();
      }, SHINE_DURATION_MS);
    }, randomDelayMs());
  };

  scheduleNext();

  return () => {
    cancelled = true;
    if (scheduleId !== null) clearTimeout(scheduleId);
    if (stripId !== null) clearTimeout(stripId);
    stripShineClass(getTargets());
  };
}
