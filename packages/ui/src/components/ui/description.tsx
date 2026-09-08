"use client";

import { Info } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

export interface DescriptionProps
  extends Omit<React.HTMLAttributes<HTMLDListElement>, "title" | "content"> {
  title: React.ReactNode;
  content: React.ReactNode;
  tooltip?: string;
  right?: boolean;
  ellipsis?: boolean;
}

export function Description({
  title,
  content,
  tooltip,
  right = false,
  ellipsis = false,
  className,
  ...props
}: DescriptionProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <dl
      className={cn(
        "flex text-sm font-sans",
        right ? "flex-row items-baseline justify-between gap-4" : "flex-col gap-1",
        className
      )}
      {...props}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 font-medium text-xs text-neutral-500 dark:text-neutral-400 select-none",
          right && "shrink-0"
        )}
      >
        <span>{title}</span>
        {tooltip && (
          <span
            className="relative inline-flex items-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            tabIndex={0}
            role="button"
            aria-label={`More information about ${typeof title === "string" ? title : "this field"}`}
          >
            <Info className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors cursor-help" />
            {showTooltip && (
              <span
                role="tooltip"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-max max-w-xs rounded-md bg-neutral-900 px-2 py-1 text-xs text-neutral-100 shadow-md dark:bg-neutral-100 dark:text-neutral-900 pointer-events-none animate-in fade-in-0 duration-150"
              >
                {tooltip}
              </span>
            )}
          </span>
        )}
      </dt>
      <dd
        className={cn(
          "text-sm text-neutral-900 dark:text-neutral-100 m-0",
          right && "text-right",
          ellipsis && "truncate max-w-full"
        )}
      >
        {content}
      </dd>
    </dl>
  );
}
