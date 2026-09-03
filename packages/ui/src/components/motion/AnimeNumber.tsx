"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";

interface AnimeNumberProps {
  value: number;
  duration?: number;
  round?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  format?: "number" | "percentage" | "time";
}

export function AnimeNumber({
  value,
  duration = 1200,
  round = 0,
  prefix = "",
  suffix = "",
  className,
  format = "number",
}: AnimeNumberProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const count = useMotionValue(0);

  const displayPrefix = format === "percentage" && !prefix ? "" : prefix;
  const displaySuffix = format === "percentage" && !suffix ? "%" : suffix;

  useEffect(() => {
    const controls = animate(count, value, {
      duration: duration / 1000,
      ease: [0.16, 1, 0.3, 1], // ease-out-expo
      onUpdate: (latest) => {
        if (nodeRef.current) {
          nodeRef.current.textContent = `${displayPrefix}${latest.toFixed(round)}${displaySuffix}`;
        }
      },
    });

    return () => controls.stop();
  }, [value, duration, round, displayPrefix, displaySuffix]);

  return (
    <span ref={nodeRef} className={cn("tabular-nums", className)}>
      {displayPrefix}0{displaySuffix}
    </span>
  );
}

