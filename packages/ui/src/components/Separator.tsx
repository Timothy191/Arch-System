'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { ArchLogoBadge } from './Logo';

export type ArchSeparatorVariant = 'hairline' | 'gold' | 'gold-emblem' | 'pipe';
export type ArchSeparatorOrientation = 'horizontal' | 'vertical';

export interface ArchSeparatorProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual style. Defaults to a neutral hairline divider. */
  variant?: ArchSeparatorVariant;
  /** Orientation of hairline separators. Golden variants are always horizontal. */
  orientation?: ArchSeparatorOrientation;
  /** Hide from assistive tech. Defaults to true for the taskbar pipe glyph. */
  decorative?: boolean;
  /** Add the gold bloom to the golden separator lines. */
  glow?: boolean;
  /** Rendered as `data-testid` on the root element. */
  testId?: string;
}

/**
 * Arch separator standard — the single approved way to divide content.
 *
 * Variants: `hairline` (neutral 1px rule), `gold` (gradient gold rule with a
 * diamond ornament), `gold-emblem` (the same with the Arch mark at the
 * centre), and `pipe` (vertical gold pipe used inside the taskbar).
 *
 * Styling lives in `@repo/theme` (`.separator-arch-*`) and is driven by the
 * `separator` token group in `packages/theme/tokens.json`.
 */
export function ArchSeparator({
  variant = 'hairline',
  orientation = 'horizontal',
  decorative = variant === 'pipe',
  glow = false,
  testId,
  className,
  ...props
}: ArchSeparatorProps) {
  const semantics = decorative
    ? { 'aria-hidden': true as const }
    : { 'aria-orientation': orientation, role: 'separator' as const };

  if (variant === 'pipe') {
    return (
      <span
        data-testid={testId}
        {...semantics}
        className={cn(
          'separator-arch-pipe inline-flex select-none items-center text-accent-gold',
          className
        )}
        {...props}
      >
        |
      </span>
    );
  }

  if (variant === 'hairline') {
    return (
      <div
        data-testid={testId}
        {...semantics}
        className={cn(
          orientation === 'horizontal' ? 'separator-arch-line' : 'separator-arch-line-v',
          className
        )}
        {...props}
      />
    );
  }

  const lineClass = cn('separator-arch-line-gold', glow && 'separator-arch-glow');

  return (
    <div data-testid={testId} {...semantics} className={cn('separator-arch', className)} {...props}>
      <span aria-hidden="true" className={lineClass} />
      <span aria-hidden="true" className="separator-arch-mark" />
      {variant === 'gold-emblem' ? <ArchLogoBadge size="xs" /> : null}
      <span aria-hidden="true" className="separator-arch-mark" />
      <span aria-hidden="true" className={cn(lineClass, 'separator-arch-line-gold-flip')} />
    </div>
  );
}
