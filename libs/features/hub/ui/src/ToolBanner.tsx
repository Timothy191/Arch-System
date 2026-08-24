"use client";

import { Marquee } from "@repo/ui/Marquee";
import { GlassCard } from "@repo/ui/GlassCard";
import { cn } from "@repo/ui/lib/utils";
import { CheckSquare, FileText, Calendar, Calculator, StickyNote, Factory } from "lucide-react";

// AGENT-TRACE: Maps database icon identifiers to canonical Lucide React component references
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  tasks: CheckSquare,
  documents: FileText,
  schedule: Calendar,
  calculations: Calculator,
  notes: StickyNote,
};

// AGENT-TRACE: Canonical design tokens mapped to specific alert/accent colors for glass spotlights
const COLOR_MAP: Record<string, { iconBg: string; glow: string }> = {
  emerald: {
    iconBg: "bg-accent-green/10 text-accent-green",
    glow: "rgba(52, 199, 89, 0.08)",
  },
  blue: {
    iconBg: "bg-accent-blue/10 text-accent-blue",
    glow: "rgba(0, 122, 255, 0.08)",
  },
  violet: {
    iconBg: "bg-accent-blue/10 text-accent-blue",
    glow: "rgba(0, 122, 255, 0.08)",
  },
  cyan: {
    iconBg: "bg-accent-blue/10 text-accent-blue",
    glow: "rgba(0, 122, 255, 0.08)",
  },
  red: {
    iconBg: "bg-accent-red/10 text-accent-red",
    glow: "rgba(255, 59, 48, 0.08)",
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
  if (tools.length === 0) return null;

  // AGENT-TRACE: Using CSS mask-image gradient to smoothly fade marquee edges over the dynamic video background
  const maskStyle = {
    maskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)",
    WebkitMaskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)",
  };

  return (
    <div className="relative w-full overflow-hidden" style={maskStyle}>
      <Marquee pauseOnHover className="[--duration:25s] gap-4 sm:gap-6 py-2">
        {tools.map((tool) => {
          const Icon = ICON_MAP[tool.icon] || Factory;
          const config = COLOR_MAP[tool.color] || {
            iconBg: "bg-arch-surface-tertiary text-arch-text-primary",
            glow: "rgba(0,0,0,0.04)",
          };

          return (
            <div key={tool.id} className="w-[280px] sm:w-[300px] shrink-0">
              <GlassCard
                variant="spotlight"
                spotlightColor={config.glow}
                className="h-full rounded-2xl bg-white/75 backdrop-blur-xl border border-black/[0.08] shadow-card hover:shadow-card-hover hover:border-arch-accent-blue/30 transition-all duration-300 will-change-[backdrop-filter]"
              >
                <div className="p-5 sm:p-6 flex flex-col items-center text-center select-none">
                  <div
                    className={cn(
                      "p-3.5 rounded-xl mb-3.5 shadow-sm transition-transform duration-300 hover:scale-105 border border-arch-border-subtle",
                      config.iconBg,
                    )}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-arch-text-primary mb-1.5 hover:text-arch-accent-blue transition-colors duration-200">
                    {tool.displayName}
                  </h3>
                  <p className="text-xs text-arch-text-secondary leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                </div>
              </GlassCard>
            </div>
          );
        })}
      </Marquee>
    </div>
  );
}
