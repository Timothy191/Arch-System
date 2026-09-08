import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center font-medium rounded-full border select-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shrink-0 leading-none",
  {
    variants: {
      variant: {
        // Shadcn backward-compatible
        default:
          "border-transparent bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900",
        secondary:
          "border-transparent bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
        destructive: "border-transparent bg-red-600 text-white dark:bg-red-900 dark:text-red-50",
        outline:
          "border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100",

        // Geist solid variants
        gray: "border-transparent bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900",
        blue: "border-transparent bg-blue-600 text-white dark:bg-blue-500",
        purple: "border-transparent bg-purple-600 text-white dark:bg-purple-500",
        amber: "border-transparent bg-amber-500 text-black dark:bg-amber-400",
        red: "border-transparent bg-red-600 text-white dark:bg-red-500",
        pink: "border-transparent bg-pink-600 text-white dark:bg-pink-500",
        green: "border-transparent bg-emerald-600 text-white dark:bg-emerald-500",
        teal: "border-transparent bg-teal-600 text-white dark:bg-teal-500",
        inverted:
          "border-transparent bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm",

        // Geist subtle variants
        "gray-subtle":
          "bg-neutral-100 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700/60",
        "blue-subtle":
          "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/70 dark:border-blue-800/60",
        "purple-subtle":
          "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/70 dark:border-purple-800/60",
        "amber-subtle":
          "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/60",
        "red-subtle":
          "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200/70 dark:border-red-800/60",
        "pink-subtle":
          "bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200/70 dark:border-pink-800/60",
        "green-subtle":
          "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/60",
        "teal-subtle":
          "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200/70 dark:border-teal-800/60",

        // Special branded variants
        trial:
          "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-sm",
        turbo:
          "border-transparent bg-gradient-to-r from-red-500 via-pink-500 to-blue-500 text-white font-semibold shadow-sm",

        // Interactive link / filter pill
        pill: "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer shadow-sm active:scale-[0.98]",
      },
      size: {
        sm: "h-5 px-1.5 text-[11px] gap-1 [&>svg]:w-3 [&>svg]:h-3",
        md: "h-6 px-2 text-xs gap-1.5 [&>svg]:w-3.5 [&>svg]:h-3.5",
        lg: "h-7 px-2.5 text-sm gap-2 [&>svg]:w-4 [&>svg]:h-4",
      },
    },
    defaultVariants: {
      variant: "gray",
      size: "md",
    },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
export type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>["size"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof badgeVariants>, "variant"> {
  variant?: BadgeVariant;
  contrast?: "low" | "high";
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "gray", contrast, size = "md", icon, children, ...props }, ref) => {
    // If contrast="low", automatically map base colors to their -subtle variant
    let resolvedVariant = variant;
    if (contrast === "low") {
      if (["gray", "blue", "purple", "amber", "red", "pink", "green", "teal"].includes(variant)) {
        resolvedVariant = `${variant}-subtle` as BadgeVariant;
      }
    }

    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant: resolvedVariant, size }), className)}
        {...props}
      >
        {icon && (
          <span className="shrink-0 flex items-center justify-center" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </div>
    );
  }
);

Badge.displayName = "Badge";

export { badgeVariants };
