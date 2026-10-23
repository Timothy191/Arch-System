import { ChevronLeft, ChevronRight, Lock, RotateCw } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BrowserProps extends React.HTMLAttributes<HTMLDivElement> {
  address?: string;
  theme?: 'auto' | 'light' | 'dark';
  aspectRatio?: string;
  children: React.ReactNode;
}

/**
 * Middle truncate a URL so both domain and trailing path remain visible.
 */
function middleTruncate(str: string, maxLength: number = 42): string {
  if (str.length <= maxLength) return str;
  const half = Math.floor((maxLength - 3) / 2);
  return `${str.slice(0, half)}...${str.slice(-half)}`;
}

export const Browser = React.forwardRef<HTMLDivElement, BrowserProps>(
  (
    {
      address = 'https://arch.coal',
      theme = 'auto',
      aspectRatio,
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    // Format address display
    const cleanAddress = address.replace(/^https?:\/\//, '');
    const truncatedAddress = middleTruncate(cleanAddress);

    return (
      <div
        ref={ref}
        className={cn(
          'w-full overflow-hidden rounded-xl border border-neutral-200',
          'select-none bg-white shadow-xl',
          className
        )}
        style={{
          aspectRatio,
          ...style,
        }}
        {...props}
      >
        {/* Decorative Browser Chrome Bar */}
        <div
          aria-hidden="true"
          className="flex items-center justify-between gap-3 border-neutral-200/80 border-b bg-neutral-100/70 px-3.5 py-2.5 backdrop-blur-xs"
        >
          {/* Window Control Dots (Decorative, non-focusable) */}
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-[#E0443E]/40 bg-[#FF5F56]" />
            <span className="h-2.5 w-2.5 rounded-full border border-[#DEA123]/40 bg-[#FFBD2E]" />
            <span className="h-2.5 w-2.5 rounded-full border border-[#1AAB29]/40 bg-[#27C93F]" />
          </div>

          {/* Navigation Controls */}
          <div className="hidden shrink-0 items-center gap-1 text-neutral-400 sm:flex">
            <ChevronLeft className="h-3.5 w-3.5 opacity-60" />
            <ChevronRight className="h-3.5 w-3.5 opacity-40" />
            <RotateCw className="ml-1 h-3 w-3 opacity-60" />
          </div>

          {/* Centered Address Bar */}
          <div className="mx-auto flex max-w-md flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-200/70 bg-white px-3 py-1 font-mono text-neutral-600 text-xs shadow-2xs">
            <Lock className="h-3 w-3 shrink-0 text-neutral-400" />
            <span className="truncate tracking-tight">{truncatedAddress}</span>
          </div>

          {/* Spacer for symmetrical balance */}
          <div className="hidden w-12 shrink-0 sm:block" />
        </div>

        {/* Inner Content / Screenshot / Demo surface */}
        <div className="relative h-full w-full overflow-hidden bg-neutral-50">{children}</div>
      </div>
    );
  }
);

Browser.displayName = 'Browser';
