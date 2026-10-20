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
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)]/90 hover:bg-[var(--bg-tertiary)] text-[var(--text-heading)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)]/50 shadow-sm hover:shadow transition-all duration-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30 active:scale-[0.98]"
          aria-label="Quick navigation to other Control Room tabs"
        >
          <Compass className="w-4 h-4 text-[var(--accent-blue)] shrink-0" />
          <span>Quick Navigation</span>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-72 sm:w-80 p-1.5 bg-[var(--vibrancy-surface)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-2xl rounded-xl z-50 animate-in fade-in-0 zoom-in-95"
      >
        <DropdownMenuLabel className="px-2.5 py-2 text-xs font-semibold text-[var(--text-heading)]">
          <div className="flex items-center justify-between">
            <span>Control Room Tabs</span>
            <span className="text-[10px] font-normal text-[var(--text-muted)] uppercase tracking-wider">
              Navigation
            </span>
          </div>
          <p className="text-[11px] font-normal text-[var(--text-secondary)] mt-0.5">
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
                  'cursor-pointer rounded-lg px-2.5 py-2 transition-colors duration-150 outline-none select-none',
                  isActive
                    ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium'
                    : 'hover:bg-black/[0.04] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                )}
              >
                <Link href={tab.href} className="flex items-start gap-3 w-full">
                  <div
                    className={cn(
                      'p-1.5 rounded-md shrink-0 mt-0.5',
                      isActive
                        ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]'
                        : 'bg-black/[0.04] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate text-[var(--text-heading)]">
                        {tab.label}
                      </span>
                      {isActive && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
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
