"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/utils";

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "default";
  variant?: "default" | "rounded-lg";
  asChild?: boolean;
}

// UI Component: SecondaryButton
// ------------------------------------------------------------
// *Fitts's Law* - large hit area (`rounded-full` or `rounded-lg`) and
//  sufficient padding (`px-6 py-2.5`).
// *Von Restorff Effect* - visual distinction from the primary button via a
//  lighter background (`bg-white/80`).
// *Aesthetic-Usability* - uses the shared glass-morphism palette and smooth
//  transition on hover.
const SecondaryButton = forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  (
    { size = "default", variant = "default", asChild = false, className, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          variant === "rounded-lg" ? "rounded-lg" : "rounded-full",
          size === "sm" ? "px-4 py-2" : "px-6 py-2.5",
          "bg-white/80 text-[var(--text-heading)] text-sm font-medium border border-[var(--border-default)] hover:bg-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
SecondaryButton.displayName = "SecondaryButton";

export { SecondaryButton };
