import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DrawerProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
  > {
  show: boolean;
  onDismiss: () => void;
  height?: number | string;
  position?: "bottom" | "right" | "left" | "top";
  children: React.ReactNode;
}

export function Drawer({
  show,
  onDismiss,
  height = "auto",
  position = "bottom",
  className,
  children,
  ...props
}: DrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && show) {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [show, onDismiss]);

  const variants = {
    hidden: {
      y: position === "bottom" ? "100%" : position === "top" ? "-100%" : 0,
      x: position === "right" ? "100%" : position === "left" ? "-100%" : 0,
      opacity: 0,
    },
    visible: {
      y: 0,
      x: 0,
      opacity: 1,
    },
  };

  const getPositionClasses = () => {
    switch (position) {
      case "bottom":
        return "bottom-0 left-0 right-0 rounded-t-xl border-t";
      case "top":
        return "top-0 left-0 right-0 rounded-b-xl border-b";
      case "right":
        return "top-0 right-0 bottom-0 border-l";
      case "left":
        return "top-0 left-0 bottom-0 border-r";
      default:
        return "bottom-0 left-0 right-0 rounded-t-xl border-t";
    }
  };

  const drawerStyle: React.CSSProperties = {
    height: position === "bottom" || position === "top" ? height : "100%",
    width:
      position === "left" || position === "right"
        ? typeof height === "number"
          ? height
          : 400
        : "100%",
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onDismiss}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={variants}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            style={drawerStyle}
            className={cn(
              "fixed z-50 flex flex-col bg-background shadow-xl outline-none border-border",
              getPositionClasses(),
              className,
            )}
            {...props}
          >
            {/* Draggable Handle Indicator for bottom sheets */}
            {position === "bottom" && (
              <div className="flex w-full items-center justify-center pt-3 pb-1" aria-hidden="true">
                <div className="h-1.5 w-12 rounded-full bg-muted" />
              </div>
            )}

            <button
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>

            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
