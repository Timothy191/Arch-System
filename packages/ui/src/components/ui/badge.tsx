import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center font-medium rounded-full border select-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shrink-0 leading-none",
  {
    variants: {
      variant: {
        // Shadcn backward-compatible
        default: "border-transparent bg-neutral-900 text-white",
        secondary: "border-transparent bg-neutral-100 text-neutral-900",
        destructive: "border-transparent bg-red-600 text-white",
        outline: "border-neutral-200 text-neutral-900",

        // Geist solid variants
        gray: "border-transparent bg-neutral-900 text-white",
        blue: "border-transparent bg-blue-600 text-white",
        purple: "border-transparent bg-purple-600 text-white",
        amber: "border-transparent bg-amber-500 text-black",
        red: "border-transparent bg-red-600 text-white",
        pink: "border-transparent bg-pink-600 text-white",
        green: "border-transparent bg-emerald-600 text-white",
        teal: "border-transparent bg-teal-600 text-white",
        inverted: "border-transparent bg-neutral-900 text-white shadow-sm",

        // Geist subtle variants
        "gray-subtle": "bg-neutral-100 text-neutral-600 border-neutral-200/80",
        "blue-subtle": "bg-blue-50 text-blue-700 border-blue-200/70",
        "purple-subtle": "bg-purple-50 text-purple-700 border-purple-200/70",
        "amber-subtle": "bg-amber-50 text-amber-700 border-amber-200/70",
        "red-subtle": "bg-red-50 text-red-700 border-red-200/70",
        "pink-subtle": "bg-pink-50 text-pink-700 border-pink-200/70",
        "green-subtle": "bg-emerald-50 text-emerald-700 border-emerald-200/70",
        "teal-subtle": "bg-teal-50 text-teal-700 border-teal-200/70",

        // Special branded variants
        trial:
          "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-sm",
        turbo:
          "border-transparent bg-gradient-to-r from-red-500 via-pink-500 to-blue-500 text-white font-semibold shadow-sm",

        // Interactive link / filter pill
        pill: "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer shadow-sm active:scale-[0.98]",
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
  },
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
  },
);

Badge.displayName = "Badge";

export { badgeVariants };
