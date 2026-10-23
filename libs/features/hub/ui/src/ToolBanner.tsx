'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { Marquee } from '@repo/ui/Marquee';
import { Calculator, Calendar, CheckSquare, Factory, FileText, StickyNote } from 'lucide-react';

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
    iconBg: 'bg-accent-green/10 text-accent-green',
    glow: 'rgba(52, 199, 89, 0.08)',
  },
  blue: {
    iconBg: 'bg-accent-blue/10 text-accent-blue',
    glow: 'rgba(0, 122, 255, 0.08)',
  },
  violet: {
    iconBg: 'bg-accent-blue/10 text-accent-blue',
    glow: 'rgba(0, 122, 255, 0.08)',
  },
  cyan: {
    iconBg: 'bg-accent-blue/10 text-accent-blue',
    glow: 'rgba(0, 122, 255, 0.08)',
  },
  red: {
    iconBg: 'bg-accent-red/10 text-accent-red',
    glow: 'rgba(255, 59, 48, 0.08)',
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
    maskImage: 'linear-gradient(to right, transparent, white 10%, white 90%, transparent)',
    WebkitMaskImage: 'linear-gradient(to right, transparent, white 10%, white 90%, transparent)',
  };

  return (
    <div className="relative w-full overflow-hidden" style={maskStyle}>
      <Marquee pauseOnHover className="py-2 [--duration:25s] [--gap:1rem] sm:[--gap:1.5rem]">
        {tools.map((tool) => {
          const Icon = ICON_MAP[tool.icon] || Factory;
          const config = COLOR_MAP[tool.color] || {
            iconBg: 'bg-arch-surface-tertiary text-arch-text-primary',
            glow: 'rgba(0,0,0,0.04)',
          };

          return (
            <div key={tool.id} className="w-[280px] shrink-0 sm:w-[300px]">
              <GlassCard
                variant="spotlight"
                spotlightColor={config.glow}
                className="h-full rounded-card border border-black/[0.08] bg-white/75 shadow-card backdrop-blur-xl transition-all duration-300 will-change-[backdrop-filter] hover:border-arch-accent-blue/30 hover:shadow-card-hover"
              >
                <div className="flex select-none flex-col items-center p-5 text-center sm:p-6">
                  <div
                    className={cn(
                      'mb-3.5 rounded-lg border border-arch-border-subtle p-3.5 shadow-sm transition-transform duration-300 hover:scale-105',
                      config.iconBg
                    )}
                  >
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="mb-1.5 font-semibold text-arch-text-primary text-sm transition-colors duration-200 hover:text-arch-accent-blue sm:text-base">
                    {tool.displayName}
                  </h3>
                  <p className="line-clamp-2 text-arch-text-secondary text-xs leading-relaxed">
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
