'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ArchBreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const BP_XS_PX = 0;
const BP_SM_PX = 640;
const BP_MD_PX = 768;
const BP_LG_PX = 1024;
const BP_XL_PX = 1280;
const BP_2XL_PX = 1536;
const MAX_WIDTH_PRECISION_OFFSET_PX = 0.02;
const DECIMAL_PRECISION_DIGITS = 2;

/**
 * Canonical Tailwind CSS viewport breakpoints in pixels.
 */
export const ARCH_BREAKPOINTS_PX: Readonly<Record<ArchBreakpointKey, number>> = {
  xs: BP_XS_PX,
  sm: BP_SM_PX,
  md: BP_MD_PX,
  lg: BP_LG_PX,
  xl: BP_XL_PX,
  '2xl': BP_2XL_PX,
};

const ARCH_BREAKPOINT_ORDER: readonly ArchBreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];

function formatMaxBoundPx(breakpointKey: ArchBreakpointKey): string {
  const rawMaxPx = Math.max(
    BP_XS_PX,
    ARCH_BREAKPOINTS_PX[breakpointKey] - MAX_WIDTH_PRECISION_OFFSET_PX
  );
  return rawMaxPx.toFixed(DECIMAL_PRECISION_DIGITS);
}

/**
 * Zero-CSS-in-JS media query builders distilled from `mg901/styled-breakpoints`.
 * Uses `-0.02px` upper-bound precision so `up('md')` and `down('md')` never overlap at 768px.
 */
export const breakpoints = {
  up(minKey: ArchBreakpointKey): string {
    return `(min-width: ${ARCH_BREAKPOINTS_PX[minKey]}px)`;
  },
  down(maxKey: ArchBreakpointKey): string {
    return `(max-width: ${formatMaxBoundPx(maxKey)}px)`;
  },
  between(minKey: ArchBreakpointKey, maxKey: ArchBreakpointKey): string {
    return `(min-width: ${ARCH_BREAKPOINTS_PX[minKey]}px) and (max-width: ${formatMaxBoundPx(maxKey)}px)`;
  },
  only(targetKey: ArchBreakpointKey): string {
    const currentIndex = ARCH_BREAKPOINT_ORDER.indexOf(targetKey);
    const nextKey = ARCH_BREAKPOINT_ORDER[currentIndex + 1];
    if (!nextKey) {
      return breakpoints.up(targetKey);
    }
    return breakpoints.between(targetKey, nextKey);
  },
} as const;

/**
 * Hook to reactively evaluate media query strings using useSyncExternalStore.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => {};
      }
      const matchMedia = window.matchMedia(query);
      matchMedia.addEventListener('change', onChange);
      return () => matchMedia.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Reactive hook for `min-width` breakpoint matching (`mg901/styled-breakpoints` pattern).
 */
export function useBreakpointUp(minKey: ArchBreakpointKey): boolean {
  return useMediaQuery(breakpoints.up(minKey));
}

/**
 * Reactive hook for exclusive `max-width` breakpoint matching (`-0.02px` boundary precision).
 */
export function useBreakpointDown(maxKey: ArchBreakpointKey): boolean {
  return useMediaQuery(breakpoints.down(maxKey));
}

/**
 * Reactive hook for matching a viewport range `[minKey, maxKey - 0.02px]`.
 */
export function useBreakpointBetween(
  minKey: ArchBreakpointKey,
  maxKey: ArchBreakpointKey
): boolean {
  return useMediaQuery(breakpoints.between(minKey, maxKey));
}
