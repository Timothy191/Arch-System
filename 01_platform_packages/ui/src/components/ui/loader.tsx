"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

export interface LoaderProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Loader({ className, size = "md", ...props }: LoaderProps) {
  // Map sizes to Tailwind dimension classes
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
    xl: "w-32 h-32",
  };

  return (
    <svg
      role="status"
      aria-label="Loading..."
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("loader-pl select-none pointer-events-none", sizeClasses[size], className)}
      {...props}
    >
      <circle
        className="loader-pl-ring loader-pl-ring-a"
        cx="120"
        cy="120"
        r="105"
        fill="none"
        strokeWidth="20"
        strokeDasharray="0 660"
        strokeDashoffset="-330"
        strokeLinecap="round"
      />
      <circle
        className="loader-pl-ring loader-pl-ring-b"
        cx="120"
        cy="120"
        r="90"
        fill="none"
        strokeWidth="20"
        strokeDasharray="0 220"
        strokeDashoffset="-110"
        strokeLinecap="round"
      />
      <circle
        className="loader-pl-ring loader-pl-ring-c"
        cx="120"
        cy="120"
        r="75"
        fill="none"
        strokeWidth="20"
        strokeDasharray="0 440"
        strokeDashoffset="0"
        strokeLinecap="round"
      />
      <circle
        className="loader-pl-ring loader-pl-ring-d"
        cx="120"
        cy="120"
        r="60"
        fill="none"
        strokeWidth="20"
        strokeDasharray="0 440"
        strokeDashoffset="0"
        strokeLinecap="round"
      />
    </svg>
  );
}
