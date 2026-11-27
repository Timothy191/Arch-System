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
import { CheckSquare, ChevronDown, ClipboardCheck, Clock, Cpu, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ElementType } from 'react';

interface ActionItem {
  id: string;
  label: string;
  href: string;
  description: string;
  icon: ElementType;
}

const CONTROL_ROOM_ACTIONS: readonly ActionItem[] = [
  {
    id: 'machine-operations',
    label: 'Machine Operations',
    href: '/control-room/machine-operations',
    description: 'Fleet machinery status, delays & SMR',
    icon: Cpu,
  },
  {
    id: 'hourly-loads',
    label: 'Update Loads',
    href: '/control-room/hourly-loads',
    description: 'Real-time haulage & hourly load logging',
    icon: Clock,
  },
  {
    id: 'shift-operations',
    label: 'Shift Operations',
    href: '/control-room/shift-compilation',
    description: 'Shift compilation, active roster & dispatch',
    icon: ClipboardCheck,
  },
  {
    id: 'shift-closeout',
    label: 'Shift Closeout',
    href: '/control-room/shift-compilation?tab=closeout',
    description: 'End-of-shift reconciliation & supervisor signoff',
    icon: CheckSquare,
  },
] as const;

const ACTION_TRIGGER_CLASS = cn(
  'liquid-glass-light gold-steel-border gold-steel-border-slim inline-flex items-center gap-2',
  'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/90 px-3.5 py-2',
  'font-medium text-[var(--text-heading)] text-xs shadow-sm transition-all duration-200 sm:text-sm',
  'hover:scale-[1.02] hover:border-[var(--accent-blue)]/50 hover:bg-[var(--bg-tertiary)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 active:scale-[0.98]'
);

const ACTION_CONTENT_CLASS = cn(
  'liquid-glass-light gold-steel-border gold-steel-border-slim fade-in-0 zoom-in-95 z-50',
  'w-72 animate-in rounded-xl border border-white/20 bg-[var(--vibrancy-surface)]',
  'p-1.5 shadow-window backdrop-blur-xl sm:w-80'
);

const ACTION_ITEM_CLASS = cn(
  'group cursor-pointer select-none rounded-lg px-2.5 py-2 outline-none',
  'transition-colors duration-150 hover:bg-black/[0.04]'
);

const ACTION_ICON_BOX_CLASS = cn(
  'mt-0.5 shrink-0 rounded-md bg-[var(--accent-blue)]/10 p-1.5',
  'text-[var(--accent-blue)] transition-colors group-hover:bg-[var(--accent-blue)]/20'
);

/**
 * Quick Action Dropdown for Control Room operational workflows.
 * Replaces the static 4-button quick action row with a consolidated liquid-glass menu.
 */
export function ControlRoomActionDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="control-room-action-dropdown-trigger"
          className={ACTION_TRIGGER_CLASS}
          aria-label="Quick Actions Menu"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent-blue)]" />
          <span>Quick Actions</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={ACTION_CONTENT_CLASS}>
        <DropdownMenuLabel className="px-2.5 py-2 font-semibold text-[var(--text-heading)] text-xs">
          <div className="flex items-center justify-between">
            <span>Operational Actions</span>
            <span className="font-normal text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              Control Room
            </span>
          </div>
          <p className="mt-0.5 font-normal text-[11px] text-[var(--text-secondary)]">
            Quick dispatch &amp; data logging workflows
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 bg-[var(--border-subtle)]/60" />
        <div className="space-y-0.5">
          {CONTROL_ROOM_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem key={action.id} asChild className={ACTION_ITEM_CLASS}>
                <Link href={action.href} className="flex w-full items-start gap-3">
                  <div className={ACTION_ICON_BOX_CLASS}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-medium text-[var(--text-heading)] text-xs">
                      {action.label}
                    </span>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">
                      {action.description}
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
