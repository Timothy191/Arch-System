"use client";

import React from "react";
import { cn } from "../lib/utils";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "dotted" | "fading" | "double" | "dashed";
  orientation?: "horizontal" | "vertical";
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
  variant = "default",
  orientation = "horizontal",
  label,
  className,
  children,
  ...props
}: DividerProps) {
  const content = label || children;
  const isHorizontal = orientation === "horizontal";

  if (!content) {
    if (!isHorizontal) {
      return (
        <div
          role="separator"
          aria-orientation="vertical"
          className={cn(
            "inline-block self-stretch",
            variant === "default" && "w-px bg-arch-border-subtle",
            variant === "dotted" && "divider-arch-dotted-v",
            variant === "fading" && "divider-arch-fading-v",
            variant === "double" &&
              "w-[3px] border-l-[3px] border-double border-arch-border-emphasis",
            variant === "dashed" && "w-0 border-l border-dashed border-arch-border-emphasis",
            className,
          )}
          {...props}
        />
      );
    }

    return (
      <hr
        role="separator"
        aria-orientation="horizontal"
        className={cn(
          "w-full border-none my-4",
          variant === "default" && "h-px bg-arch-border-subtle",
          variant === "dotted" && "divider-arch-dotted",
          variant === "fading" && "divider-arch-fading",
          variant === "double" &&
            "h-[3px] border-t-[3px] border-double border-arch-border-emphasis",
          variant === "dashed" && "border-t border-dashed border-arch-border-emphasis",
          className,
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
      className={cn("relative flex items-center w-full my-4", className)}
      {...props}
    >
      <div
        className={cn(
          "flex-grow",
          variant === "default" && "h-px bg-arch-border-subtle",
          variant === "dotted" && "border-t-[1.5px] border-dotted border-arch-border-emphasis",
          variant === "fading" &&
            "h-px bg-gradient-to-r from-transparent via-arch-border-emphasis to-arch-border-emphasis",
          variant === "double" &&
            "h-[3px] border-t-[3px] border-double border-arch-border-emphasis",
          variant === "dashed" && "border-t border-dashed border-arch-border-emphasis",
        )}
      />
      <span className="px-3 text-xs font-medium uppercase tracking-wider text-arch-text-tertiary select-none">
        {content}
      </span>
      <div
        className={cn(
          "flex-grow",
          variant === "default" && "h-px bg-arch-border-subtle",
          variant === "dotted" && "border-t-[1.5px] border-dotted border-arch-border-emphasis",
          variant === "fading" &&
            "h-px bg-gradient-to-l from-transparent via-arch-border-emphasis to-arch-border-emphasis",
          variant === "double" &&
            "h-[3px] border-t-[3px] border-double border-arch-border-emphasis",
          variant === "dashed" && "border-t border-dashed border-arch-border-emphasis",
        )}
      />
    </div>
  );
}

export default Divider;
