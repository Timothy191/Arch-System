'use client';

import type { Department } from '@repo/departments/data-access';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { ArrowUpRight, Loader2 } from 'lucide-react';
// eslint-disable-next-line no-redeclare
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Sparkline } from './Sparkline';

function ArchBookmarkIcon({ isPinned, className }: { isPinned: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="22.75 16.625 166.16 166.19"
      className={cn(
        'h-4 w-4 transition-all duration-200',
        isPinned
          ? 'scale-110 fill-current text-arch-accent-blue drop-shadow-[0_1px_4px_rgba(212,175,55,0.45)]'
          : 'fill-none text-arch-text-secondary group-hover/pin:text-arch-accent-blue',
        className
      )}
      aria-hidden="true"
      data-testid="arch-bookmark-icon"
    >
      <path
        d="m 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z"
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth={isPinned ? 4 : 12}
        strokeLinejoin="round"
      />
    </svg>
  );
}

const GOLD_BADGE_CONFIG = {
  bg: 'border-accent-amber/45 bg-white/95 text-accent-amber shadow-sm',
  text: 'text-accent-amber',
  iconColor: 'text-accent-amber',
  ringColor: 'ring-accent-amber/35',
} as const;

const COLOR_MAP: Record<
  string,
  { bg: string; text: string; iconColor: string; ringColor: string }
> = {
  amber: GOLD_BADGE_CONFIG,
  emerald: GOLD_BADGE_CONFIG,
  blue: GOLD_BADGE_CONFIG,
  violet: GOLD_BADGE_CONFIG,
  red: GOLD_BADGE_CONFIG,
  orange: GOLD_BADGE_CONFIG,
  cyan: GOLD_BADGE_CONFIG,
  indigo: GOLD_BADGE_CONFIG,
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

  const config = COLOR_MAP[department.color] || GOLD_BADGE_CONFIG;

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
        className="uiverse-card gold-steel-border group interactive-element relative h-full outline-none ring-1 ring-black/[0.06] hover:ring-arch-accent-blue/35 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:[transform:perspective(900px)_rotateX(1deg)]"
        data-testid={`dept-card-${department.name}`}
      >
        {/* Navigation Loading Overlay */}
        {isNavigating && (
          <div
            className="absolute inset-0 z-30 flex animate-fade-in flex-col items-center justify-center gap-2 rounded-[20px] bg-arch-surface-primary/75 backdrop-blur-sm transition-all"
            data-testid={`dept-loading-${department.name}`}
            aria-live="polite"
          >
            <Loader2 className="h-6 w-6 animate-spin text-arch-accent-blue" />
            <span className="font-medium text-arch-text-secondary text-xs">Loading...</span>
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
          className="absolute inset-0 z-0 rounded-[20px] focus:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue"
          aria-label={`Open ${department.displayName} department`}
          data-testid={`dept-link-${department.name}`}
        />

        {/* Banner area with photographic / terrain visual background */}
        <div
          className={cn(
            'uiverse-card-banner pointer-events-none relative z-10',
            `uiverse-card-banner-${department.name}`
          )}
        >
          {/* Real industrial terrain visual background with liquid glass gradient overlay */}
          <div className="absolute inset-0 z-0 overflow-hidden rounded-t-[18px]">
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
            <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/25 via-transparent to-black/35" />
          </div>

          {/* Save/Pin Button */}
          <button
            type="button"
            onClick={togglePin}
            aria-pressed={isPinned}
            className={cn(
              'uiverse-card-pin gold-steel-border gold-steel-border-slim group/pin pointer-events-auto absolute top-2.5 right-2.5 z-20 border border-transparent hover:scale-110 active:scale-95',
              isPinned
                ? 'bg-white text-arch-accent-blue shadow-sm'
                : 'text-arch-text-secondary hover:bg-white/95 hover:text-arch-accent-blue'
            )}
            title={isPinned ? 'Unpin department' : 'Pin department'}
            aria-label={
              isPinned ? `Unpin ${department.displayName}` : `Pin ${department.displayName}`
            }
          >
            <ArchBookmarkIcon isPinned={isPinned} />
          </button>

          {/* Department Icon Bubble with high-contrast gold badge */}
          <div
            className={cn(
              'uiverse-card-icon-bubble gold-steel-border gold-steel-border-slim absolute -bottom-4 left-4 z-20 flex items-center justify-center rounded-full shadow-md ring-2 backdrop-blur-md',
              config.bg,
              config.ringColor
            )}
            aria-hidden="true"
          >
            <Logo
              variant="gold"
              className={cn(
                'h-5 w-5 shrink-0 drop-shadow-[0_1px_4px_rgba(212,175,55,0.45)]',
                config.iconColor
              )}
            />
          </div>
        </div>

        {/* Card Body */}
        <div className="uiverse-card-body pointer-events-none relative z-10">
          <div className="space-y-1">
            <div className="uiverse-card-title-row">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'gold-steel-border gold-steel-border-slim inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-semibold text-xs shadow-2xs',
                    config.bg
                  )}
                  aria-hidden="true"
                >
                  <Logo variant="gold" className={cn('h-3.5 w-3.5 shrink-0', config.iconColor)} />
                </span>
                <h3 className="uiverse-card-title truncate font-anurati font-bold uppercase tracking-[0.055em]">
                  {department.displayName}
                </h3>
              </div>
              {department.status && (
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold text-[10px] uppercase tracking-[0.05em]',
                    department.status === 'active' &&
                      'border-accent-green/25 bg-accent-green/10 text-accent-green',
                    department.status === 'maintenance' &&
                      'border-accent-amber/30 bg-accent-amber/12 text-accent-amber',
                    department.status === 'alert' &&
                      'border-accent-red/30 bg-accent-red/12 text-accent-red'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 animate-pulse rounded-full',
                      department.status === 'active' && 'bg-accent-green',
                      department.status === 'maintenance' && 'bg-accent-amber',
                      department.status === 'alert' && 'bg-accent-red'
                    )}
                  />
                  <span>{department.status}</span>
                </span>
              )}
            </div>
            <div
              data-testid={`dept-header-separator-${department.name}`}
              aria-hidden="true"
              className="my-1.5 h-px w-full bg-gradient-to-r from-accent-amber/55 via-slate-300/80 to-transparent"
            />
            <p className="uiverse-card-subtitle">{department.description}</p>
          </div>

          {/* Tag / Stats row */}
          {department.stats && (
            <div className="uiverse-card-tag-row group-hover:border-arch-accent-blue/25 group-hover:bg-white/95">
              <div className="flex items-center gap-2">
                <span className="uiverse-card-tag-row-text">{department.stats.label}</span>
                {department.trend && (
                  <div className="opacity-90">
                    <Sparkline data={department.trend} width={52} height={14} color="#d4af37" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="uiverse-card-tag-row-value">{department.stats.value}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-arch-text-tertiary transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-arch-accent-blue"
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
