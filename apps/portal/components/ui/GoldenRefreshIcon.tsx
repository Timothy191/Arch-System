'use client';

import { cn } from '@repo/ui/lib/utils';
import type { SVGProps } from 'react';
import { useId } from 'react';

export interface GoldenRefreshIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /**
   * Whether the icon is currently in an active refreshing state.
   * When true, accelerates the rotation cycle to 750ms.
   */
  readonly isRefreshing?: boolean;
  /**
   * Continuous rotation cycle duration in milliseconds during idle state.
   * Defaults to 4000ms.
   */
  readonly cycleDurationMs?: number;
  /**
   * Optional custom CSS class name.
   */
  readonly className?: string;
}

const GOLDEN_REFRESH_CLASS = cn(
  'transform-gpu animate-spin transition-all duration-200 will-change-transform',
  'hover:drop-shadow-[0_0_6px_oklch(0.84_0.18_80/0.65)]',
  'active:drop-shadow-[0_0_10px_oklch(0.88_0.20_85/0.85)]'
);

/**
 * Animated Metallic Golden Refresh Icon.
 *
 * Renders a scalable dual-arrow SVG with multi-stop metallic gold OKLCH gradients,
 * hardware-accelerated continuous rotation, accelerated spin during refresh,
 * and luminous hover/active glow states. Fully adheres to strict light-mode OKLCH tokens.
 */
export function GoldenRefreshIcon({
  isRefreshing = false,
  cycleDurationMs = 4000,
  className,
  style,
  ...props
}: GoldenRefreshIconProps) {
  const gradientId = useId();
  const currentDurationMs = isRefreshing ? 750 : cycleDurationMs;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="golden-refresh-icon"
      aria-hidden="true"
      className={cn(GOLDEN_REFRESH_CLASS, className)}
      style={{
        animationDuration: `${currentDurationMs}ms`,
        ...style,
      }}
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.92 0.15 88)" />
          <stop offset="28%" stopColor="oklch(0.84 0.18 80)" />
          <stop offset="60%" stopColor="oklch(0.70 0.17 68)" />
          <stop offset="85%" stopColor="oklch(0.86 0.16 84)" />
          <stop offset="100%" stopColor="oklch(0.76 0.14 74)" />
        </linearGradient>
      </defs>
      <path
        d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 3v5h5"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 21v-5h-5"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
