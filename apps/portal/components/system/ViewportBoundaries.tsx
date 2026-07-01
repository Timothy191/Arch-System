"use client";

import React from "react";
import { cn } from "@repo/ui/lib/utils";

interface ViewportBoundariesProps {
  className?: string;
}

/**
 * ViewportBoundaries
 *
 * Reserved edge overlay for future 08_developer_tooling/panels. The bottom OS dock was replaced
 * by ConversationalBar — navigation lives in the top taskbar and Start menu.
 */
export function ViewportBoundaries({ className }: ViewportBoundariesProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 select-none",
        className,
      )}
      aria-hidden="true"
    />
  );
}
