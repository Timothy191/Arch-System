import * as React from "react";
import { cn } from "../../lib/utils";

export interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  syntax?: string;
  children: React.ReactNode;
}

export const Code = React.forwardRef<HTMLElement, CodeProps>(
  ({ syntax, className, children, ...props }, ref) => {
    return (
      <code
        ref={ref}
        data-syntax={syntax}
        className={cn(
          "font-mono text-xs px-1.5 py-0.5 rounded",
          "bg-neutral-100 text-neutral-900 border border-neutral-200",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }
);

Code.displayName = "Code";
