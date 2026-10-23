'use client';

import type React from 'react';
import { cn } from '../lib/utils';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'dotted' | 'fading' | 'double' | 'dashed';
  orientation?: 'horizontal' | 'vertical';
  label?: React.ReactNode;
}

/**
 * Divider Component
 *
 * Implements accessible, theme-compliant dividers supporting:
 * - Solid / Default
 * - Dotted Divider (.divider-arch-dotted)
 * - Fading Divider (.divider-arch-fading)
 * - Double Divider
 * - Dashed Divider
 */
export function Divider({
  variant = 'default',
  orientation = 'horizontal',
  label,
  className,
  children,
  ...props
}: DividerProps) {
  const content = label || children;
  const isHorizontal = orientation === 'horizontal';

  if (!content) {
    if (!isHorizontal) {
      return (
        <div
          role="separator"
          aria-orientation="vertical"
          className={cn(
            'inline-block self-stretch',
            variant === 'default' && 'w-px bg-arch-border-subtle',
            variant === 'dotted' && 'divider-arch-dotted-v',
            variant === 'fading' && 'divider-arch-fading-v',
            variant === 'double' &&
              'w-[3px] border-arch-border-emphasis border-l-[3px] border-double',
            variant === 'dashed' && 'w-0 border-arch-border-emphasis border-l border-dashed',
            className
          )}
          {...props}
        />
      );
    }

    return (
      <hr
        aria-orientation="horizontal"
        className={cn(
          'my-4 w-full border-none',
          variant === 'default' && 'h-px bg-arch-border-subtle',
          variant === 'dotted' && 'divider-arch-dotted',
          variant === 'fading' && 'divider-arch-fading',
          variant === 'double' &&
            'h-[3px] border-arch-border-emphasis border-t-[3px] border-double',
          variant === 'dashed' && 'border-arch-border-emphasis border-t border-dashed',
          className
        )}
        {...props}
      />
    );
  }

  // Divider with label / content
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn('relative my-4 flex w-full items-center', className)}
      {...props}
    >
      <div
        className={cn(
          'flex-grow',
          variant === 'default' && 'h-px bg-arch-border-subtle',
          variant === 'dotted' && 'border-arch-border-emphasis border-t-[1.5px] border-dotted',
          variant === 'fading' &&
            'h-px bg-gradient-to-r from-transparent via-arch-border-emphasis to-arch-border-emphasis',
          variant === 'double' &&
            'h-[3px] border-arch-border-emphasis border-t-[3px] border-double',
          variant === 'dashed' && 'border-arch-border-emphasis border-t border-dashed'
        )}
      />
      <span className="select-none px-3 font-medium text-arch-text-tertiary text-xs uppercase tracking-wider">
        {content}
      </span>
      <div
        className={cn(
          'flex-grow',
          variant === 'default' && 'h-px bg-arch-border-subtle',
          variant === 'dotted' && 'border-arch-border-emphasis border-t-[1.5px] border-dotted',
          variant === 'fading' &&
            'h-px bg-gradient-to-l from-transparent via-arch-border-emphasis to-arch-border-emphasis',
          variant === 'double' &&
            'h-[3px] border-arch-border-emphasis border-t-[3px] border-double',
          variant === 'dashed' && 'border-arch-border-emphasis border-t border-dashed'
        )}
      />
    </div>
  );
}

export default Divider;
