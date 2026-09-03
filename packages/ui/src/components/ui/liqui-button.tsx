"use client";

import React, { forwardRef } from "react";
import { LiquiGlass, type LiquiGlassProps } from "@liqui-design/glass";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

/**
 * LiquiButton — a glass button rendered as a LiquiGlass surface.
 *
 * Variants retint the glass by overriding --lq-tint rather than painting over
 * it, so the lens still refracts the background through the accent color.
 */

const buttonVariants = cva(
  "group inline-flex cursor-pointer select-none items-center justify-center outline-none transition-[transform,box-shadow] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        glass:
          "focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lq-accent)_40%,transparent)]",
        accent:
          "text-white [--lq-tint:color-mix(in_srgb,var(--lq-accent)_82%,transparent)] [--lq-tint-deep:color-mix(in_srgb,var(--lq-accent)_62%,transparent)] focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.55)]",
        danger:
          "text-white [--lq-tint:rgba(229,72,77,0.82)] [--lq-tint-deep:rgba(229,72,77,0.62)] focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.55)]",
      },
      size: {
        sm: "",
        md: "",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  },
);

const buttonContentVariants = cva(
  "inline-flex items-center justify-center rounded-[inherit] font-semibold leading-tight whitespace-nowrap group-hover:bg-[color-mix(in_srgb,var(--lq-highlight)_40%,transparent)] group-disabled:bg-transparent",
  {
    variants: {
      size: {
        sm: "gap-1.5 px-3 py-1.5 text-xs",
        md: "gap-[7px] px-4 py-[9px] text-[13.5px]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const BUTTON_GLASS = {
  radius: 12,
  blur: 1,
  refraction: 45,
  bezel: 11,
} satisfies Partial<LiquiGlassProps>;

export interface LiquiButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Overrides for the underlying glass surface (radius, refraction, bezel…). */
  glass?: Partial<LiquiGlassProps>;
}

export const LiquiButton = forwardRef<HTMLButtonElement, LiquiButtonProps>(
  ({ variant, size, glass, className, children, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
        <LiquiGlass {...BUTTON_GLASS} {...glass}>
          <div className={buttonContentVariants({ size })}>{children}</div>
        </LiquiGlass>
      </button>
    );
  },
);

LiquiButton.displayName = "LiquiButton";

export { buttonVariants as liquiButtonVariants, buttonVariants };
