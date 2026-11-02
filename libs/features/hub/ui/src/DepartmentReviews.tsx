'use client';

import { Activity, Database, Layers, ShieldCheck } from 'lucide-react';
import type * as React from 'react';

interface SystemStatItem {
  id: string;
  subsystem: string;
  metricBadge: string;
  badgeTone: 'green' | 'blue' | 'amber';
  icon: React.ComponentType<{ className?: string }>;
}

// AGENT-TRACE: Static, professional enterprise status telemetry strip for the global Site footer.
// Replaces the distracting animated marquee ticker with calm, scannable operational health indicators.
const FOOTER_TELEMETRY_ITEMS: readonly SystemStatItem[] = [
  {
    id: 'scada-modbus-stream',
    subsystem: 'SCADA Stream',
    metricBadge: 'Sub-50ms Poll',
    badgeTone: 'green',
    icon: Activity,
  },
  {
    id: 'redis-l1-l2',
    subsystem: 'Redis L1/L2',
    metricBadge: '94.2% Hit',
    badgeTone: 'green',
    icon: Layers,
  },
  {
    id: 'supabase-rls',
    subsystem: 'PostgreSQL RLS',
    metricBadge: '18ms Avg',
    badgeTone: 'blue',
    icon: Database,
  },
  {
    id: 'policy-compiler',
    subsystem: 'Zero-Drift Policy',
    metricBadge: '100% Verified',
    badgeTone: 'amber',
    icon: ShieldCheck,
  },
] as const;

const BADGE_TONE_CLASSES: Record<SystemStatItem['badgeTone'], string> = {
  green: 'bg-accent-green/10 text-accent-green border-accent-green/25',
  blue: 'bg-arch-accent-blue/10 text-arch-accent-blue border-arch-accent-blue/25',
  amber: 'bg-accent-amber/10 text-accent-amber border-accent-amber/25',
};

export function DepartmentReviews() {
  return (
    <div
      className="flex w-full min-w-0 items-center justify-center gap-3 overflow-hidden"
      aria-label="Codebase & Architecture Performance Telemetry"
    >
      <div className="hidden items-center gap-3 overflow-hidden lg:flex">
        {FOOTER_TELEMETRY_ITEMS.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div key={metric.id} className="flex shrink-0 items-center gap-3">
              {idx > 0 && (
                <span
                  aria-hidden="true"
                  className="select-none font-mono text-[10px] text-black/15"
                >
                  |
                </span>
              )}
              <div className="inline-flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap">
                <Icon
                  className="h-3 w-3 shrink-0 text-[var(--text-secondary)]"
                  aria-hidden="true"
                />
                <span className="font-medium text-[10px] text-[var(--text-secondary)]">
                  {metric.subsystem}
                </span>
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-px font-mono font-semibold text-[9px] tabular-nums ${BADGE_TONE_CLASSES[metric.badgeTone]}`}
                >
                  {metric.metricBadge}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
