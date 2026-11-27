'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import {
  BarChart3,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  Cloud,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import type { ElementType } from 'react';

export const CONTROL_ROOM_ACTIVE_SUBTAB_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg border border-white/40 bg-[var(--accent-blue)]/15 px-3.5 py-1.5 font-semibold text-[var(--accent-blue)] text-xs shadow-diffusion-sm shadow-window backdrop-blur-md transition-all active:scale-95';

export const CONTROL_ROOM_INACTIVE_SUBTAB_CLASS =
  'inline-flex items-center gap-2 rounded-lg border border-transparent px-3.5 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-all hover:border-[var(--border-subtle)] hover:bg-black/[0.04] hover:text-[var(--accent-blue)]';

export interface ControlRoomSubtabsProps {
  readonly departmentSlug?: string;
  readonly activeTab:
    | 'scada'
    | 'shift-operations'
    | 'shift-closeout'
    | 'cloudflare-edge'
    | 'quality-intelligence';
  readonly borderTop?: boolean;
}

interface SubtabConfig {
  id: ControlRoomSubtabsProps['activeTab'];
  label: string;
  getPath: (departmentSlug: string) => string;
  description: string;
  icon: ElementType;
}

const CONTROL_ROOM_PAGES: readonly SubtabConfig[] = [
  {
    id: 'scada',
    label: 'SCADA Dashboard',
    getPath: (dept) => `/${dept}`,
    description: 'Live SCADA telemetry & dig face monitoring',
    icon: BarChart3,
  },
  {
    id: 'shift-operations',
    label: 'Shift Operations',
    getPath: (dept) => `/${dept}/shift-compilation`,
    description: 'Shift roster, active fleet & dispatch compilation',
    icon: ClipboardCheck,
  },
  {
    id: 'shift-closeout',
    label: 'Shift Closeout',
    getPath: (dept) => `/${dept}/shift-closeout`,
    description: 'End-of-shift reconciliation & supervisor signoff',
    icon: CheckSquare,
  },
  {
    id: 'cloudflare-edge',
    label: 'Cloudflare Edge',
    getPath: (dept) => `/${dept}/cloudflare-edge`,
    description: 'Edge cache status, KV stores & worker telemetry',
    icon: Cloud,
  },
  {
    id: 'quality-intelligence',
    label: 'Quality Intelligence',
    getPath: (dept) => `/${dept}/quality-intelligence`,
    description: 'Audit trails, sensor calibration & data quality',
    icon: ShieldCheck,
  },
] as const;

const DEFAULT_PAGE: SubtabConfig = {
  id: 'scada',
  label: 'SCADA Dashboard',
  getPath: (dept) => `/${dept}`,
  description: 'Live SCADA telemetry & dig face monitoring',
  icon: BarChart3,
};

const SUBTAB_TRIGGER_CLASS = cn(
  'liquid-glass-light gold-steel-border gold-steel-border-slim inline-flex items-center gap-2.5',
  'rounded-lg border border-white/40 bg-[var(--accent-blue)]/15 px-3.5 py-1.5',
  'font-semibold text-[var(--text-heading)] text-xs shadow-diffusion-sm shadow-window',
  'backdrop-blur-md transition-all duration-200 hover:scale-[1.01] hover:bg-[var(--accent-blue)]/20',
  'focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 active:scale-95'
);

const SUBTAB_CONTENT_CLASS = cn(
  'liquid-glass-light gold-steel-border gold-steel-border-slim fade-in-0 zoom-in-95 z-50',
  'w-72 animate-in rounded-xl border border-white/20 bg-[var(--vibrancy-surface)]',
  'p-1.5 shadow-window backdrop-blur-xl sm:w-80'
);

export function ControlRoomSubtabs({
  departmentSlug = 'control-room',
  activeTab,
  borderTop = true,
}: ControlRoomSubtabsProps) {
  const activePage = CONTROL_ROOM_PAGES.find((page) => page.id === activeTab) ?? DEFAULT_PAGE;
  const ActiveIcon = activePage.icon;

  return (
    <div
      aria-label="Control Room Dashboard Sub-tabs"
      className={
        borderTop
          ? 'mt-4 flex items-center border-[var(--border-subtle)]/60 border-t pt-3'
          : 'flex items-center'
      }
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Link
            href={activePage.getPath(departmentSlug)}
            aria-current="page"
            className={SUBTAB_TRIGGER_CLASS}
            data-testid="control-room-subtabs-trigger"
          >
            <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-[var(--accent-blue)]" />
            <span className="text-[var(--accent-blue)]">{activePage.label}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-[var(--accent-blue)]/70 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
          </Link>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className={SUBTAB_CONTENT_CLASS}>
          <DropdownMenuLabel className="px-2.5 py-2 font-semibold text-[var(--text-heading)] text-xs">
            <div className="flex items-center justify-between">
              <span>Control Room Modules</span>
              <span className="font-normal text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Pages
              </span>
            </div>
            <p className="mt-0.5 font-normal text-[11px] text-[var(--text-secondary)]">
              Switch operational views
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1 bg-[var(--border-subtle)]/60" />
          <div className="space-y-0.5">
            {CONTROL_ROOM_PAGES.map((page) => {
              const Icon = page.icon;
              const isActive = page.id === activeTab;
              const href = page.getPath(departmentSlug);

              return (
                <DropdownMenuItem
                  key={page.id}
                  asChild
                  className={cn(
                    'cursor-pointer select-none rounded-lg px-2.5 py-2 outline-none transition-colors duration-150',
                    isActive
                      ? 'bg-[var(--accent-blue)]/10 font-medium text-[var(--accent-blue)]'
                      : 'text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-heading)]'
                  )}
                >
                  <Link
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className="flex w-full items-start gap-3"
                  >
                    <div
                      className={cn(
                        'mt-0.5 shrink-0 rounded-md p-1.5',
                        isActive
                          ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]'
                          : 'bg-black/[0.04] text-[var(--text-secondary)]'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-medium text-[var(--text-heading)] text-xs">
                          {page.label}
                        </span>
                        {isActive && (
                          <span className="rounded bg-[var(--accent-blue)]/15 px-1.5 py-0.5 font-semibold text-[9px] text-[var(--accent-blue)] uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">
                        {page.description}
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
