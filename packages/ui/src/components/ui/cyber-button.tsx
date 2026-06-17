"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";

interface CyberButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  variant?: "cyan" | "blue" | "alert";
  size?: "default" | "sm" | "lg";
}

export function CyberButton({
  children,
  className,
  variant = "cyan",
  size = "default",
  ...props
}: CyberButtonProps) {
  const colorMap = {
    cyan: {
      border: "border-[var(--accent-mint)]/40",
      text: "text-[var(--accent-mint)]",
      glow: "shadow-glow-mint",
      glowHover: "hover:shadow-glow-mint",
      bg: "bg-[var(--accent-mint)]/5",
      bgHover: "hover:bg-[var(--accent-mint)]/10",
      before: "before:bg-[var(--accent-mint)]",
    },
    blue: {
      border: "border-[var(--accent-electric-blue)]/40",
      text: "text-[var(--accent-electric-blue)]",
      glow: "shadow-md",
      glowHover: "hover:shadow-lg",
      bg: "bg-[var(--accent-electric-blue)]/5",
      bgHover: "hover:bg-[var(--accent-electric-blue)]/10",
      before: "before:bg-[var(--accent-electric-blue)]",
    },
    alert: {
      border: "border-[var(--accent-red)]/40",
      text: "text-[var(--accent-red)]",
      glow: "shadow-glow-electric",
      glowHover: "hover:shadow-glow-electric",
      bg: "bg-[var(--accent-red)]/5",
      bgHover: "hover:bg-[var(--accent-red)]/10",
      before: "before:bg-[var(--accent-red)]",
    },
  };

  const sizeMap = {
    sm: "px-3 py-1.5 text-xs",
    default: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const colors = colorMap[variant];

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative overflow-hidden rounded-md font-mono font-medium uppercase tracking-widest",
        "border backdrop-blur-sm transition-all duration-300",
        "disabled:pointer-events-none disabled:opacity-50",
        colors.border,
        colors.text,
        colors.glow,
        colors.glowHover,
        colors.bg,
        colors.bgHover,
        sizeMap[size],
        "before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-10",
        colors.before,
        className,
      )}
      {...props}
    >
      {/* Scanline overlay */}
      <span
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
        }}
      />

      {/* Glitch text wrapper */}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
