import { ChevronLeft, ChevronRight, Lock, RotateCw } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

export interface BrowserProps extends React.HTMLAttributes<HTMLDivElement> {
  address?: string;
  theme?: "auto" | "light" | "dark";
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
      address = "https://arch.coal",
      theme = "auto",
      aspectRatio,
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    // Format address display
    const cleanAddress = address.replace(/^https?:\/\//, "");
    const truncatedAddress = middleTruncate(cleanAddress);

    return (
      <div
        ref={ref}
        className={cn(
          "w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800",
          "bg-white dark:bg-neutral-950 shadow-xl select-none",
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
          className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100/70 dark:bg-neutral-900/70 backdrop-blur-xs"
        >
          {/* Window Control Dots (Decorative, non-focusable) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] border border-[#E0443E]/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F] border border-[#1AAB29]/40" />
          </div>

          {/* Navigation Controls */}
          <div className="hidden sm:flex items-center gap-1 text-neutral-400 dark:text-neutral-500 shrink-0">
            <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            <RotateCw className="w-3 h-3 opacity-60 ml-1" />
          </div>

          {/* Centered Address Bar */}
          <div className="flex-1 max-w-md mx-auto flex items-center justify-center gap-1.5 px-3 py-1 rounded-md bg-white dark:bg-neutral-800/90 border border-neutral-200/70 dark:border-neutral-700/60 shadow-2xs text-xs font-mono text-neutral-600 dark:text-neutral-300">
            <Lock className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
            <span className="truncate tracking-tight">{truncatedAddress}</span>
          </div>

          {/* Spacer for symmetrical balance */}
          <div className="w-12 shrink-0 hidden sm:block" />
        </div>

        {/* Inner Content / Screenshot / Demo surface */}
        <div className="relative w-full h-full overflow-hidden bg-neutral-50 dark:bg-neutral-900">
          {children}
        </div>
      </div>
    );
  }
);

Browser.displayName = "Browser";
