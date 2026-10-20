'use client';

import type { Department } from '@repo/departments/data-access';
import { cn } from '@repo/ui/lib/utils';
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  CreditCard,
  Database,
  Factory,
  Loader2,
  Monitor,
  Pickaxe,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
// eslint-disable-next-line no-redeclare
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Sparkline } from './Sparkline';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  Database,
  Drill: Pickaxe,
  Factory,
  ShieldCheck,
  Wrench,
  Monitor,
  CreditCard,
};

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  amber: {
    bg: 'border-accent-amber/20 text-accent-amber bg-accent-amber/5',
    text: 'text-accent-amber',
  },
  emerald: {
    bg: 'border-accent-green/20 text-accent-green bg-accent-green/5',
    text: 'text-accent-green',
  },
  blue: {
    bg: 'border-accent-blue/20 text-accent-blue bg-accent-blue/5',
    text: 'text-accent-blue',
  },
  violet: {
    bg: 'border-accent-blue/20 text-accent-blue bg-accent-blue/5',
    text: 'text-accent-blue',
  },
  red: {
    bg: 'border-accent-red/20 text-accent-red bg-accent-red/5',
    text: 'text-accent-red',
  },
  orange: {
    bg: 'border-accent-amber/20 text-accent-amber bg-accent-amber/5',
    text: 'text-accent-amber',
  },
  cyan: {
    bg: 'border-accent-blue/20 text-accent-blue bg-accent-blue/5',
    text: 'text-accent-blue',
  },
  indigo: {
    bg: 'border-accent-blue/20 text-accent-blue bg-accent-blue/5',
    text: 'text-accent-blue',
  },
};

interface DepartmentCardProps {
  department: Department;
  index: number;
  onPinnedChange?: (departmentName: string, pinned: boolean) => void;
  isPinned?: boolean;
}

function DepartmentCard({
  department,
  index,
  onPinnedChange,
  isPinned: controlledIsPinned,
}: DepartmentCardProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [uncontrolledIsPinned, setUncontrolledIsPinned] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isPinned = controlledIsPinned ?? uncontrolledIsPinned;

  useEffect(() => {
    if (controlledIsPinned !== undefined || typeof window === 'undefined') return;
    const pinned = localStorage.getItem(`pinned_dept_${department.name}`);
    setUncontrolledIsPinned(pinned === 'true');
  }, [controlledIsPinned, department.name]);

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const nextState = !isPinned;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pinned_dept_${department.name}`, String(nextState));
    }
    if (controlledIsPinned === undefined) {
      setUncontrolledIsPinned(nextState);
    }
    onPinnedChange?.(department.name, nextState);
    if (nextState) {
      toast.success(`Pinned ${department.displayName} to dashboard`);
    } else {
      toast.success(`Unpinned ${department.displayName}`);
    }
  };

  const Icon = ICON_MAP[department.icon] || Factory;
  const config = COLOR_MAP[department.color] || {
    bg: 'border-arch-border-subtle text-arch-text-primary',
    text: 'text-arch-text-primary',
  };

  const route = department.route || `/${department.name}`;

  return (
    <div
      style={
        {
          animation: `fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both`,
          ['--shimmer-delay' as string]: `${-(index * 1.5)}s`,
        } as React.CSSProperties
      }
      className={cn('h-full', department.gridSpan)}
    >
      <div
        className="uiverse-card group outline-none h-full interactive-element relative ring-1 ring-black/[0.06] hover:ring-arch-accent-blue/35 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:[transform:perspective(900px)_rotateX(1deg)]"
        data-testid={`dept-card-${department.name}`}
      >
        {/* Navigation Loading Overlay */}
        {isNavigating && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-arch-surface-primary/75 backdrop-blur-sm rounded-[24px] z-30 transition-all animate-fade-in"
            data-testid={`dept-loading-${department.name}`}
            aria-live="polite"
          >
            <Loader2 className="w-6 h-6 animate-spin text-arch-accent-blue" />
            <span className="text-xs font-medium text-arch-text-secondary">Loading...</span>
          </div>
        )}

        {/* Stretched client-side Link with proper useTransition */}
        <Link
          href={route}
          prefetch={true}
          onClick={(e) => {
            e.preventDefault();
            // Use useTransition for smoother navigation with loading state
            startTransition(() => {
              router.push(route);
            });
          }}
          className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue rounded-[24px]"
          aria-label={`Open ${department.displayName} department`}
          data-testid={`dept-link-${department.name}`}
        />

        {/* Banner area with photographic / terrain visual background */}
        <div
          className={cn(
            'uiverse-card-banner relative z-10 pointer-events-none',
            `uiverse-card-banner-${department.name}`
          )}
        >
          {/* Real industrial terrain visual background with liquid glass gradient overlay */}
          <div className="absolute inset-0 z-0 overflow-hidden rounded-t-[22px]">
            <Image
              src={
                imageError
                  ? '/images/departments/overview.jpg'
                  : department.name === 'reports'
                    ? '/images/departments/control-room.jpg'
                    : `/images/departments/${department.name}.jpg`
              }
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover object-center opacity-90 transition-transform duration-500 group-hover:scale-105"
              onError={() => {
                if (!imageError) {
                  setImageError(true);
                }
              }}
            />
            {/* Glass gradient overlay to ensure icon bubble contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35 z-10" />
          </div>

          {/* Save/Pin Button */}
          <button
            type="button"
            onClick={togglePin}
            aria-pressed={isPinned}
            className={cn(
              'uiverse-card-pin absolute top-3 right-3 z-20 pointer-events-auto hover:scale-110 active:scale-95',
              isPinned
                ? 'bg-white border-arch-accent-blue/40 text-arch-accent-blue shadow-sm'
                : 'text-arch-text-secondary hover:text-arch-text-primary hover:bg-white/95'
            )}
            title={isPinned ? 'Unpin department' : 'Pin department'}
            aria-label={
              isPinned ? `Unpin ${department.displayName}` : `Pin ${department.displayName}`
            }
          >
            <Bookmark
              className={cn(
                'w-3.5 h-3.5 transition-all duration-200',
                isPinned
                  ? 'fill-arch-accent-blue text-arch-accent-blue'
                  : 'text-arch-text-secondary'
              )}
            />
          </button>

          {/* Department Icon Bubble */}
          <div
            className={cn(
              'uiverse-card-icon-bubble absolute left-5 -bottom-5 z-20 border-arch-border-emphasis/25',
              config.bg
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {/* Card Body */}
        <div className="uiverse-card-body relative z-10 pointer-events-none">
          <div className="space-y-2">
            <div className="uiverse-card-title-row">
              <h3 className="uiverse-card-title">{department.displayName}</h3>
              {department.status && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-[0.05em]',
                    department.status === 'active' &&
                      'bg-accent-green/10 text-accent-green border-accent-green/25',
                    department.status === 'maintenance' &&
                      'bg-accent-amber/12 text-accent-amber border-accent-amber/30',
                    department.status === 'alert' &&
                      'bg-accent-red/12 text-accent-red border-accent-red/30'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full animate-pulse',
                      department.status === 'active' && 'bg-accent-green',
                      department.status === 'maintenance' && 'bg-accent-amber',
                      department.status === 'alert' && 'bg-accent-red'
                    )}
                  />
                  <span>{department.status}</span>
                </span>
              )}
            </div>
            <p className="uiverse-card-subtitle">{department.description}</p>
          </div>

          {/* Tag / Stats row */}
          {department.stats && (
            <div className="uiverse-card-tag-row group-hover:border-arch-accent-blue/25 group-hover:bg-white/95">
              <div className="flex items-center gap-2">
                <span className="uiverse-card-tag-row-text">{department.stats.label}</span>
                {department.trend && (
                  <div className="opacity-90">
                    <Sparkline data={department.trend} width={52} height={14} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="uiverse-card-tag-row-value">{department.stats.value}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="w-3.5 h-3.5 text-arch-text-tertiary group-hover:text-arch-accent-blue group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// AGENT-TRACE: Memoize DepartmentCard to prevent re-renders when sibling cards
// or parent hub state changes. Props (department, index) are stable across renders.
const MemoizedDepartmentCard = memo(DepartmentCard);

export { MemoizedDepartmentCard as DepartmentCard };
export default MemoizedDepartmentCard;
