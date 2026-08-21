"use client";

import React, { forwardRef } from "react";
import { cn } from "../lib/utils";

export type BorderVariant =
  | "solid"
  | "dotted"
  | "double"
  | "gradient"
  | "bevelled"
  | "bevelled-inset"
  | "handdrawn"
  | "patterned"
  | "patterned-caution"
  | "thick-transparent"
  | "fading";

export interface BorderBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BorderVariant;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  asChild?: boolean;
}

/**
 * BorderBox Component
 *
 * Implements 9 specialized industrial border techniques:
 * 1. Dotted Border (`variant="dotted"`)
 * 2. Double Border (`variant="double"`)
 * 3. Gradient Border (`variant="gradient"`)
 * 4. Bevelled Border (`variant="bevelled"` | `variant="bevelled-inset"`)
 * 5. Hand-Drawn Border (`variant="handdrawn"`)
 * 6. Patterned Border (`variant="patterned"` | `variant="patterned-caution"`)
 * 7. Thick Transparent Border (`variant="thick-transparent"`)
 * 8. Fading Borders (`variant="fading"`)
 * 9. Solid / Base (`variant="solid"`)
 */
export const BorderBox = forwardRef<HTMLDivElement, BorderBoxProps>(
  ({ variant = "solid", padding = "md", rounded = "xl", className, children, ...props }, ref) => {
    const paddingStyles = {
      none: "p-0",
      sm: "p-2.5 sm:p-3",
      md: "p-4 sm:p-5",
      lg: "p-6 sm:p-7",
      xl: "p-8 sm:p-10",
    }[padding];

    const roundedStyles = {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
      "2xl": "rounded-2xl",
      "3xl": "rounded-3xl",
      full: "rounded-full",
    }[rounded];

    const variantStyles: Record<BorderVariant, string> = {
      solid: "border border-arch-border-subtle bg-arch-surface-primary",
      dotted: "border-arch-dotted bg-arch-surface-primary",
      double: "border-arch-double bg-arch-surface-primary",
      gradient: "border-arch-gradient shadow-sm",
      bevelled: "border-arch-bevelled bg-arch-surface-primary",
      "bevelled-inset": "border-arch-bevelled-inset bg-arch-surface-secondary/50",
      handdrawn: "border-arch-handdrawn bg-arch-surface-primary",
      patterned: "border-arch-patterned shadow-sm",
      "patterned-caution": "border-arch-patterned-caution shadow-sm",
      "thick-transparent": "border-arch-thick-transparent bg-white/70",
      fading: "border-arch-fading bg-arch-surface-primary",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative transition-all duration-200",
          variant !== "handdrawn" && roundedStyles,
          paddingStyles,
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

BorderBox.displayName = "BorderBox";

export default BorderBox;
