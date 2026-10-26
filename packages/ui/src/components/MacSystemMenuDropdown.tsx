'use client';

import { Activity, ChevronRight, Command, ExternalLink, LayoutGrid, Shield } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import {
  DEPARTMENTS_LIST,
  EXTERNAL_LIST,
  PRODUCTIVITY_LIST,
  WHATSAPP_WEB_DIRECT_URL,
} from './mac-menu-bar-constants';
import { Avatar } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface MacSystemMenuDropdownProps {
  systemMenuOpen: boolean;
  setSystemMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  pathname: string;
  setPathname: (path: string) => void;
  focusedModule: { name: string; title: string } | null;
  setFocusedModule: (mod: { name: string; title: string } | null) => void;
  currentContextLabel: string;
  activeDeptSlug: string;
  isHubRoute: boolean;
  isAdminRoute: boolean;
}

export function MacSystemMenuDropdown({
  systemMenuOpen,
  setSystemMenuOpen,
  pathname,
  setPathname,
  focusedModule,
  setFocusedModule,
  currentContextLabel,
  activeDeptSlug,
  isHubRoute,
  isAdminRoute,
}: MacSystemMenuDropdownProps) {
  return (
    <DropdownMenu open={systemMenuOpen} onOpenChange={setSystemMenuOpen}>
      <div className="flex items-center gap-1.5">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="System Menu"
            aria-haspopup="true"
            title={`System Menu · Active: ${currentContextLabel}`}
            className={cn(
              'gold-steel-border gold-steel-border-slim relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full',
              'border border-white/60 bg-white/80 shadow-xs backdrop-blur-md transition-all duration-150 ease-in-out hover:bg-white hover:shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] active:scale-95',
              'data-[state=open]:border-[var(--accent-blue)]/40 data-[state=open]:bg-[var(--accent-blue)]/15 data-[state=open]:ring-2 data-[state=open]:ring-[var(--accent-blue)]/25'
            )}
          >
            <Logo className="h-5 w-5 text-[var(--accent-blue)] drop-shadow-xs" />
            <span
              className={cn(
                'absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-2xs transition-colors',
                systemMenuOpen ? 'bg-[var(--accent-blue)]' : 'bg-accent-green'
              )}
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        {/* WhatsApp Web Direct Web & Split-Screen trigger */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              // Direct shortcut: Spawn / navigate directly to official WhatsApp Web login
              window.open(WHATSAPP_WEB_DIRECT_URL, '_blank', 'noopener,noreferrer');
              // Also synchronize the docked split-screen pane
              window.dispatchEvent(
                new CustomEvent('open-split-view', {
                  detail: { service: 'whatsapp', action: 'open' },
                })
              );
            }
          }}
          className={cn(
            'gold-steel-border gold-steel-border-slim flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full',
            'border border-white/50 bg-white/70 shadow-sm backdrop-blur-md transition-all duration-150 hover:scale-110 hover:bg-white/95 hover:shadow-md active:scale-95'
          )}
          title="Open WhatsApp Web (Direct web.whatsapp.com shortcut & Split Screen)"
          aria-label="Open WhatsApp Web (Direct web.whatsapp.com shortcut & Split Screen)"
        >
          <Image
            src="/whatsapp-logo.jpeg"
            alt="WhatsApp Logo"
            width={20}
            height={20}
            className="shrink-0 rounded-full object-cover drop-shadow-xs"
          />
        </button>
      </div>
      <DropdownMenuContent
        align="start"
        sideOffset={5}
        className={cn(
          'z-popover flex w-[560px] flex-col overflow-hidden p-0 md:flex-row',
          'rounded-card border border-black/[0.08] bg-white/95 shadow-window backdrop-blur-2xl'
        )}
      >
        {/* ── Left Column: Departments ── */}
        <div className="flex-1 space-y-2 p-3.5">
          <div className="flex items-center justify-between px-2">
            <p className="font-medium text-[10.5px] text-[var(--text-muted)] uppercase tracking-widest">
              System Departments
            </p>
            <span className="inline-flex max-w-[165px] items-center gap-1 truncate rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-mono font-semibold text-[9.5px] text-[var(--accent-blue)]">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-blue)]"
                aria-hidden="true"
              />
              {currentContextLabel}
            </span>
          </div>

          {/* Central Hub Quick Return */}
          <Link
            href="/hub"
            onClick={() => {
              setPathname('/hub');
              setFocusedModule({ name: 'overview', title: 'Central Hub' });
              setSystemMenuOpen(false);
            }}
            className={cn(
              'group flex items-center gap-3 rounded-lg border px-2 py-1.5 transition-all',
              isHubRoute && (!focusedModule || focusedModule.name === 'overview')
                ? 'border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10'
                : 'border-transparent hover:bg-black/[0.04] active:bg-black/[0.08]'
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] transition-transform group-hover:scale-105">
              <LayoutGrid className="h-3.5 w-3.5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-[13px] text-[var(--text-heading)] leading-tight">
                Central Operations Hub
              </span>
              <span className="truncate text-[10.5px] text-[var(--text-muted)] leading-tight">
                Executive overview &amp; shift telemetry
              </span>
            </div>
            {isHubRoute && (!focusedModule || focusedModule.name === 'overview') ? (
              <span className="ml-auto shrink-0 rounded-md bg-[var(--accent-blue)]/15 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-[var(--accent-blue)] uppercase tracking-wider">
                Active
              </span>
            ) : (
              <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-60" />
            )}
          </Link>

          <div className="grid grid-cols-1 gap-0.5">
            {DEPARTMENTS_LIST.map((dept) => {
              const Icon = dept.icon;
              const isRouteActive = pathname.startsWith(`/${dept.name}`);
              const isFocused = !isRouteActive && focusedModule?.name === dept.name;
              return (
                <Link
                  key={dept.name}
                  href={`/${dept.name}`}
                  onClick={() => {
                    setPathname(`/${dept.name}`);
                    setFocusedModule({ name: dept.name, title: dept.displayName });
                    setSystemMenuOpen(false);
                  }}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg border px-2 py-1.5 transition-all',
                    isRouteActive
                      ? 'border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10'
                      : isFocused
                        ? 'border-black/[0.08] bg-black/[0.035]'
                        : 'border-transparent hover:bg-black/[0.04] active:bg-black/[0.08]'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                      dept.bgColor
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', dept.iconColor)} />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-[13px] text-[var(--text-body)] leading-tight group-hover:text-[var(--text-heading)]">
                      {dept.displayName}
                    </span>
                    <span className="truncate text-[10.5px] text-[var(--text-muted)] leading-tight">
                      {dept.description}
                    </span>
                  </div>
                  {isRouteActive ? (
                    <span className="ml-auto shrink-0 rounded-md bg-[var(--accent-blue)]/15 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-[var(--accent-blue)] uppercase tracking-wider">
                      Active
                    </span>
                  ) : isFocused ? (
                    <span className="ml-auto shrink-0 rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono font-semibold text-[9px] text-[var(--text-secondary)] uppercase tracking-wider">
                      Focused
                    </span>
                  ) : (
                    <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-60" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Right Column: User + Tools + Admin ── */}
        <div className="flex w-[205px] shrink-0 flex-col border-black/[0.05] border-l bg-black/[0.015]">
          {/* User Identity */}
          <div className="flex items-center gap-2.5 border-black/[0.06] border-b px-3.5 py-3">
            <Avatar
              size={32}
              letter="AO"
              title="Arch Operator"
              className="shrink-0 border border-black/10 shadow-card"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-[12.5px] text-[var(--text-heading)] leading-tight">
                Arch Operator
              </span>
              <span className="truncate text-[10px] text-[var(--text-muted)] leading-tight">
                admin@arch-systems.com
              </span>
            </div>
          </div>

          {/* Tools */}
          <div className="space-y-0.5 px-2.5 pt-2.5 pb-1">
            <div className="mb-1 flex items-center justify-between px-2">
              <p className="font-medium text-[10.5px] text-[var(--text-muted)] uppercase tracking-widest">
                Tools
              </p>
              <span className="max-w-[95px] truncate font-mono text-[9.5px] text-[var(--text-muted)]">
                /{activeDeptSlug}
              </span>
            </div>
            {PRODUCTIVITY_LIST.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.name}
                  href={`/${activeDeptSlug}/tools?tab=${tool.name}`}
                  onClick={() => {
                    setPathname(`/${activeDeptSlug}/tools`);
                    setSystemMenuOpen(false);
                  }}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all hover:bg-black/[0.04] active:bg-black/[0.08]"
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0 transition-colors', tool.colorClass)} />
                  <span className="font-medium text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]">
                    {tool.displayName}
                  </span>
                </Link>
              );
            })}
          </div>

          <DropdownMenuSeparator className="mx-2.5 bg-black/[0.06]" />

          {/* Split View & Quick Actions */}
          <div className="space-y-0.5 px-2.5 pb-1">
            <p className="mb-1 px-2 pt-1 font-medium text-[10.5px] text-[var(--text-muted)] uppercase tracking-widest">
              Workspace
            </p>
            <DropdownMenuItem asChild>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-split-view', {
                      detail: { service: 'whatsapp', action: 'toggle' },
                    })
                  );
                  setSystemMenuOpen(false);
                }}
                className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all hover:bg-black/[0.04] focus:outline-none active:bg-black/[0.08]"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-dept-engineering"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
                <span className="font-medium text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]">
                  New Split Tab
                </span>
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new KeyboardEvent('keydown', {
                      key: 'k',
                      metaKey: true,
                      ctrlKey: true,
                      bubbles: true,
                    })
                  );
                  setSystemMenuOpen(false);
                }}
                className="group flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left transition-all hover:bg-black/[0.04] focus:outline-none active:bg-black/[0.08]"
              >
                <span className="flex items-center gap-2.5">
                  <Command className="h-3.5 w-3.5 shrink-0 text-[var(--accent-blue)]" />
                  <span className="font-medium text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]">
                    Command Palette
                  </span>
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">⌘K</span>
              </button>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="mx-2.5 bg-black/[0.06]" />

          {/* Automation */}
          <div className="space-y-0.5 px-2.5 pb-1">
            <p className="mb-1 px-2 pt-1 font-medium text-[10.5px] text-[var(--text-muted)] uppercase tracking-widest">
              Automation
            </p>
            {EXTERNAL_LIST.map((tool) => {
              const Icon = tool.icon;
              return (
                <a
                  key={tool.name}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSystemMenuOpen(false)}
                  className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-all hover:bg-black/[0.04] active:bg-black/[0.08]"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', tool.colorClass)} />
                    <span className="font-medium text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]">
                      {tool.displayName}
                    </span>
                  </div>
                  <ExternalLink className="h-2.5 w-2.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              );
            })}
            <Link
              href="/admin/ai-metrics"
              onClick={() => {
                setPathname('/admin/ai-metrics');
                setFocusedModule({ name: 'admin', title: 'AI & Build Metrics' });
                setSystemMenuOpen(false);
              }}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all hover:bg-black/[0.04] active:bg-black/[0.08]"
            >
              <Activity className="h-3.5 w-3.5 shrink-0 text-[var(--accent-blue)]" />
              <span className="font-medium text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]">
                AI &amp; Build Metrics
              </span>
            </Link>
          </div>

          {/* Admin Panel */}
          <div className="mt-auto border-black/[0.06] border-t px-2.5 py-2.5">
            <Link
              href="/admin"
              onClick={() => {
                setPathname('/admin');
                setFocusedModule({ name: 'admin', title: 'Admin Panel' });
                setSystemMenuOpen(false);
              }}
              className={cn(
                'group flex items-center justify-between gap-2.5 rounded-lg px-2 py-1.5 transition-all',
                isAdminRoute || focusedModule?.name === 'admin'
                  ? 'bg-dept-admin/15 text-dept-admin'
                  : 'hover:bg-dept-admin/10 active:bg-dept-admin/15'
              )}
            >
              <span className="flex items-center gap-2.5">
                <Shield className="h-3.5 w-3.5 shrink-0 text-dept-admin" />
                <span className="font-medium text-[12.5px] text-[var(--text-secondary)] group-hover:text-dept-admin">
                  Admin Panel
                </span>
              </span>
              {(isAdminRoute || focusedModule?.name === 'admin') && (
                <span className="rounded-md bg-dept-admin/15 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-dept-admin uppercase tracking-wider">
                  Active
                </span>
              )}
            </Link>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
