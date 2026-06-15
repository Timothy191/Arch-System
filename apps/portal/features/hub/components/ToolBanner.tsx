"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@repo/ui/GlassCard";
import { cn } from "@repo/ui/lib/utils";
import {
  CheckSquare,
  FileText,
  Calendar,
  Calculator,
  StickyNote,
  Factory,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  tasks: CheckSquare,
  documents: FileText,
  schedule: Calendar,
  calculations: Calculator,
  notes: StickyNote,
};

const COLOR_MAP: Record<string, { iconBg: string; glow: string }> = {
  emerald: {
    iconBg: "bg-accent-green/10 text-accent-green",
    glow: "rgba(52, 199, 89, 0.1)",
  },
  blue: {
    iconBg: "bg-accent-blue/10 text-accent-blue",
    glow: "rgba(0, 122, 255, 0.1)",
  },
  violet: {
    iconBg: "bg-accent-blue/10 text-accent-blue",
    glow: "rgba(0, 122, 255, 0.1)",
  },
  cyan: {
    iconBg: "bg-accent-blue/10 text-accent-blue",
    glow: "rgba(0, 122, 255, 0.1)",
  },
  red: {
    iconBg: "bg-accent-red/10 text-accent-red",
    glow: "rgba(255, 59, 48, 0.1)",
  },
};

interface Tool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
}

interface ToolBannerProps {
  tools: Tool[];
}

export function ToolBanner({ tools }: ToolBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const paginate = useCallback(
    (newDirection: number) => {
      setDirection(newDirection);
      setCurrentIndex((prev) => {
        const next = prev + newDirection;
        if (next < 0) return tools.length - 1;
        if (next >= tools.length) return 0;
        return next;
      });
    },
    [tools.length],
  );

  useEffect(() => {
    if (isPaused || tools.length <= 1) return;
    const interval = setInterval(() => paginate(1), 4000);
    return () => clearInterval(interval);
  }, [isPaused, tools.length, paginate]);

  if (tools.length === 0) return null;

  const tool = tools[currentIndex]!;
  const Icon = ICON_MAP[tool.icon] || Factory;
  const config = COLOR_MAP[tool.color] || {
    iconBg: "bg-arch-surface-tertiary text-arch-text-primary",
    glow: "rgba(0,0,0,0.04)",
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl min-h-[200px]">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={tool.id}
            custom={direction}
            initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction < 0 ? 300 : -300, opacity: 0 }}
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="w-full"
          >
            <GlassCard
              variant="spotlight"
              spotlightColor={config.glow}
              className="h-full bg-arch-surface-tertiary/40 border border-arch-border-primary hover:border-white/40 transition-all duration-300 will-change-[backdrop-filter]"
            >
              <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                <div
                  className={cn(
                    "p-3 rounded-xl mb-4 transition-transform duration-300 group-hover:scale-110",
                    config.iconBg,
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-arch-text-primary mb-2 group-hover:text-arch-accent-blue transition-colors duration-300">
                  {tool.displayName}
                </h3>
                <p className="text-sm text-arch-text-secondary max-w-md leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </GlassCard>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          onClick={() => paginate(-1)}
          className="p-1.5 rounded-full bg-arch-surface-tertiary/50 hover:bg-arch-surface-tertiary text-arch-text-tertiary hover:text-arch-text-primary transition-colors"
          aria-label="Previous tool"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {tools.map((t, i) => (
            <button
              key={t.id}
              onClick={() => {
                setDirection(i > currentIndex ? 1 : -1);
                setCurrentIndex(i);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === currentIndex
                  ? "w-6 bg-arch-accent-blue"
                  : "w-1.5 bg-arch-border-primary hover:bg-arch-text-tertiary",
              )}
              aria-label={`Go to ${t.displayName}`}
            />
          ))}
        </div>

        <button
          onClick={() => paginate(1)}
          className="p-1.5 rounded-full bg-arch-surface-tertiary/50 hover:bg-arch-surface-tertiary text-arch-text-tertiary hover:text-arch-text-primary transition-colors"
          aria-label="Next tool"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
