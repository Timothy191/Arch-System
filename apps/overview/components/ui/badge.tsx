import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-[#363636] px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#3ecf8e] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#242424] text-[#fafafa] hover:bg-[#363636]",
        secondary:
          "border-transparent bg-[#171717] text-[#b4b4b4] hover:bg-[#242424]",
        destructive:
          "border-transparent bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20",
        outline: "text-[#fafafa]",
        accent:
          "border-transparent bg-[#3ecf8e]/10 text-[#3ecf8e] hover:bg-[#3ecf8e]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
