'use client';

import { useAutoAnimate } from '@formkit/auto-animate/react';
import { cn, defineSlotRecipe, resolveSurfacePairing, type SurfaceTone } from '../lib/utils';
import { GlassCard } from './GlassCard';

export type KPIColor = SurfaceTone;

const kpiSlotRecipe = defineSlotRecipe({
  slots: ['root', 'headerRow', 'metricValue', 'iconSlot', 'subLabel'] as const,
  base: {
    root: 'group relative overflow-hidden',
    headerRow: 'flex items-start justify-between',
    metricValue: 'mt-1 font-medium text-fluid-2xl',
    iconSlot: 'opacity-20 transition-opacity duration-300 group-hover:opacity-40',
    subLabel: 'mt-1 text-fluid-xs',
  },
});

interface KPICardProps {
  label: string;
  value: string | number;
  color?: KPIColor;
  sub?: string;
  subColor?: KPIColor;
  icon?: React.ReactNode;
}

export function KPICard({
  label,
  value,
  color = 'default',
  sub,
  subColor = 'default',
  icon,
}: Readonly<KPICardProps>) {
  const slots = kpiSlotRecipe();
  const contrastClass = resolveSurfacePairing(color);
  const subContrastClass = resolveSurfacePairing(subColor);

  return (
    <GlassCard className={slots.root}>
      <div className={slots.headerRow}>
        <div>
          <p className="system-label">{label}</p>
          <p className={cn(slots.metricValue, contrastClass)}>{value}</p>
        </div>
        {icon && <div className={cn(slots.iconSlot, contrastClass)}>{icon}</div>}
      </div>
      {sub && <p className={cn(slots.subLabel, subContrastClass)}>{sub}</p>}
    </GlassCard>
  );
}

interface KPIGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function KPIGrid({ children, cols = 4, className }: Readonly<KPIGridProps>) {
  const [parent] = useAutoAnimate({ duration: 300, easing: 'ease-out' });
  const colClasses: Record<number, string> = {
    2: 'grid grid-cols-2 gap-4',
    3: 'grid grid-cols-1 md:grid-cols-3 gap-4',
    4: 'grid grid-cols-2 md:grid-cols-4 gap-4',
  };

  return (
    <div ref={parent} className={cn(colClasses[cols], className)}>
      {children}
    </div>
  );
}
