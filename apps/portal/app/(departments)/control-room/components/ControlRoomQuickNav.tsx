'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import {
  BarChart3,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Compass,
  Cpu,
  FileText,
  Pickaxe,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ElementType } from 'react';

interface TabItem {
  name: string;
  label: string;
  href: string;
  description: string;
  icon: ElementType;
}

export const CONTROL_ROOM_QUICK_TABS: readonly TabItem[] = [
  {
    name: 'dashboard',
    label: 'Dashboard',
    href: '/control-room',
    description: 'Live SCADA monitoring & site overview',
    icon: BarChart3,
  },
  {
    name: 'shift-compilation',
    label: 'Shift Operations',
    href: '/control-room/shift-compilation',
    description: 'Shift compilation, active roster & dispatch',
    icon: ClipboardCheck,
  },
  {
    name: 'hourly-loads',
    label: 'Hourly Loads',
    href: '/control-room/hourly-loads',
    description: 'Real-time haulage & hourly load logging',
    icon: Clock,
  },
  {
    name: 'machine-operations',
    label: 'Machine Operations',
    href: '/control-room/machine-operations',
    description: 'Fleet machinery status, delays & SMR',
    icon: Cpu,
  },
  {
    name: 'engineering-notes',
    label: 'Eng Notes',
    href: '/control-room/engineering-notes',
    description: 'Breakdowns, inspections & maintenance notes',
    icon: ClipboardList,
  },
  {
    name: 'excavator-activity',
    label: 'Excavator Activity',
    href: '/control-room/excavator-activity',
    description: 'Dig face tracking & bucket cycles',
    icon: Pickaxe,
  },
  {
    name: 'reports',
    label: 'Reports',
    href: '/control-room/reports',
    description: 'Live KPIs, shift closeout summaries & archives',
    icon: FileText,
  },
  {
    name: 'shift-closeout',
    label: 'Shift Closeout',
    href: '/control-room/shift-closeout',
    description: 'End-of-shift reconciliation & supervisor signoff',
    icon: CheckSquare,
  },
] as const;

export function ControlRoomQuickNav() {
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="control-room-quick-nav-trigger"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/90 px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs shadow-sm transition-all duration-200 hover:border-[var(--accent-blue)]/50 hover:bg-[var(--bg-tertiary)] hover:shadow focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 active:scale-[0.98] sm:text-sm"
          aria-label="Quick navigation to other Control Room tabs"
        >
          <Compass className="h-4 w-4 shrink-0 text-[var(--accent-blue)]" />
          <span>Quick Navigation</span>
          <Logo
            variant="gold"
            className="h-3.5 w-3.5 shrink-0 rotate-180 transition-transform duration-200 ease-out [[data-state=open]_&]:rotate-0"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="fade-in-0 zoom-in-95 z-50 w-72 animate-in rounded-xl border border-[var(--border-subtle)] bg-[var(--vibrancy-surface)] p-1.5 shadow-2xl backdrop-blur-xl sm:w-80"
      >
        <DropdownMenuLabel className="px-2.5 py-2 font-semibold text-[var(--text-heading)] text-xs">
          <div className="flex items-center justify-between">
            <span>Control Room Tabs</span>
            <span className="font-normal text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              Navigation
            </span>
          </div>
          <p className="mt-0.5 font-normal text-[11px] text-[var(--text-secondary)]">
            Quick jump to operational modules
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 bg-[var(--border-subtle)]/60" />
        <div className="space-y-0.5">
          {CONTROL_ROOM_QUICK_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              pathname === tab.href ||
              (tab.name === 'dashboard' && pathname === '/control-room') ||
              (tab.name === 'shift-compilation' &&
                (pathname === '/control-room/shift-compilation' ||
                  pathname === '/control-room/shift-coverage'));

            return (
              <DropdownMenuItem
                key={tab.name}
                asChild
                className={cn(
                  'cursor-pointer select-none rounded-lg px-2.5 py-2 outline-none transition-colors duration-150',
                  isActive
                    ? 'bg-[var(--accent-blue)]/10 font-medium text-[var(--accent-blue)]'
                    : 'text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-heading)]'
                )}
              >
                <Link href={tab.href} className="flex w-full items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 shrink-0 rounded-md p-1.5',
                      isActive
                        ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]'
                        : 'bg-black/[0.04] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate font-medium text-[var(--text-heading)] text-xs">
                        {tab.label}
                      </span>
                      {isActive && (
                        <span className="rounded bg-[var(--accent-blue)]/15 px-1.5 py-0.5 font-semibold text-[9px] text-[var(--accent-blue)] uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">
                      {tab.description}
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
