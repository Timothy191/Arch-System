import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 max-md:min-h-[44px] w-full rounded-lg border border-white/60 bg-white/60 backdrop-blur-md px-3 py-2 text-sm text-[var(--text-heading)] placeholder:text-[var(--text-muted)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03),inset_0_-0.5px_0_rgba(255,255,255,0.7)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/20 focus-visible:border-[var(--accent-blue)] focus-visible:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
