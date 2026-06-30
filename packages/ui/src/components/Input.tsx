"use client";

import { cn } from "../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "login";
}

export function Input({ variant = "default", className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full border text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none transition-all duration-200",
        variant === "default"
          ? "rounded-lg border-[var(--border-emphasis)] bg-[var(--bg-secondary)] focus:border-[var(--accent-blue)] focus:ring-4 focus:ring-[var(--accent-blue)]/20"
          : "h-10 rounded-md border-transparent bg-[var(--bg-tertiary)] focus:border-transparent focus:ring-2 focus:ring-[var(--brand-gold-glow)]",
        className,
      )}
      {...props}
    />
  );
}
