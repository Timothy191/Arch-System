"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface ContextCardTriggerProps {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  render?: React.ReactElement;
  delay?: number;
  className?: string;
  cardClassName?: string;
  children?: React.ReactNode;
}

export function ContextCardTrigger({
  content,
  side = "top",
  align = "center",
  render,
  delay = 150,
  className,
  cardClassName,
  children,
}: ContextCardTriggerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    openTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const positionClasses = React.useMemo(() => {
    switch (side) {
      case "top":
        return cn(
          "bottom-[calc(100%+8px)]",
          align === "start" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "end" && "right-0",
        );
      case "bottom":
        return cn(
          "top-[calc(100%+8px)]",
          align === "start" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "end" && "right-0",
        );
      case "left":
        return cn(
          "right-[calc(100%+8px)]",
          align === "start" && "top-0",
          align === "center" && "top-1/2 -translate-y-1/2",
          align === "end" && "bottom-0",
        );
      case "right":
        return cn(
          "left-[calc(100%+8px)]",
          align === "start" && "top-0",
          align === "center" && "top-1/2 -translate-y-1/2",
          align === "end" && "bottom-0",
        );
    }
  }, [side, align]);

  const cardElement = isOpen && (
    <div
      role="tooltip"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "absolute z-50 min-w-[200px] max-w-sm rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 animate-in fade-in-0 zoom-in-95 duration-150",
        positionClasses,
        cardClassName,
      )}
    >
      {content}
    </div>
  );

  if (render) {
    return (
      <div
        className={cn("relative inline-block", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        {React.cloneElement(render as React.ReactElement<any>, {
          children: (render.props as any)?.children || children,
        })}
        {cardElement}
      </div>
    );
  }

  return (
    <div
      ref={triggerRef as React.RefObject<HTMLDivElement>}
      className={cn("relative inline-block cursor-pointer", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {children}
      {cardElement}
    </div>
  );
}

/** @deprecated Use ContextCardTrigger directly. Alias preserved for backwards compatibility. */
export { ContextCardTrigger as ContextCard };
