import React from "react";
import { cn } from "../../lib/utils";

export interface LoadingDotsProps extends React.HTMLAttributes<HTMLSpanElement> {}

export function LoadingDots({ className, ...props }: LoadingDotsProps) {
  return (
    <span className={cn("inline-flex items-center space-x-1", className)} {...props}>
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
    </span>
  );
}
