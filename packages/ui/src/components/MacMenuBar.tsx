'use client';

import { m } from 'framer-motion';
import {
  Activity,
  // Menu: Help
  BookOpen,
  Bot,
  Calculator,
  CalendarDays,
  // Tools
  CheckSquare,
  // Menu: Operations dropdown icons
  ChevronRight,
  Command,
  Database,
  // General
  ExternalLink,
  Factory,
  FileText,
  Info,
  LayoutGrid,
  MailOpen,
  Maximize2,
  // Departments
  Pickaxe,
  // Menu: View
  RotateCcw,
  ScanFace,
  ScrollText,
  Search,
  Shield,
  StickyNote,
  TowerControl,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';
import { getServiceUrls } from '../lib/urls';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { Avatar } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const WHATSAPP_WEB_DIRECT_URL = 'https://web.whatsapp.com/';

interface MacMenuBarProps {
  menuItems?: readonly string[];
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

const NAVIGATION_ITEMS: readonly string[] = [];

const DEPARTMENTS_LIST = [
  {
    name: 'drilling',
    displayName: 'Drilling Operations',
    icon: Pickaxe,
    iconColor: 'text-dept-drilling',
    bgColor: 'bg-dept-drilling/10 hover:bg-dept-drilling/15',
    description: 'Rig operations & depth telemetry',
  },
  {
    name: 'production',
    displayName: 'Production Tracking',
    icon: TrendingUp,
    iconColor: 'text-dept-production',
    bgColor: 'bg-dept-production/10 hover:bg-dept-production/15',
    description: 'Yield & tonnage monitoring',
  },
  {
    name: 'plant-processing',
    displayName: 'Plant & Processing',
    icon: Factory,
    iconColor: 'text-dept-production',
    bgColor: 'bg-dept-production/10 hover:bg-dept-production/15',
    description: 'Wash plant throughput & recovery',
  },
  {
    name: 'plant-inventory',
    displayName: 'Plant Inventory',
    icon: Database,
    iconColor: 'text-dept-production',
    bgColor: 'bg-dept-production/10 hover:bg-dept-production/15',
    description: 'ROM stockpiles, magnetite & reagents',
  },
  {
    name: 'access-control',
    displayName: 'Access Control',
    icon: ScanFace,
    iconColor: 'text-dept-access-control',
    bgColor: 'bg-dept-access-control/10 hover:bg-dept-access-control/15',
    description: 'Personnel badging & visitor logs',
  },
  {
    name: 'engineering',
    displayName: 'Engineering',
    icon: Wrench,
    iconColor: 'text-dept-engineering',
    bgColor: 'bg-dept-engineering/10 hover:bg-dept-engineering/15',
    description: 'CAD, equipment specs & breakdowns',
  },
  {
    name: 'control-room',
    displayName: 'SCADA Control Room',
    icon: TowerControl,
    iconColor: 'text-dept-control-room',
    bgColor: 'bg-dept-control-room/10 hover:bg-dept-control-room/15',
    description: 'Real-time operations monitor',
  },
  {
    name: 'overview',
    displayName: 'System Overview',
    icon: Activity,
    iconColor: 'text-dept-access-control',
    bgColor: 'bg-dept-access-control/10 hover:bg-dept-access-control/15',
    description: 'Architecture, tech stack & telemetry',
  },
  {
    name: 'database',
    displayName: 'Database',
    icon: Database,
    iconColor: 'text-dept-production',
    bgColor: 'bg-dept-production/10 hover:bg-dept-production/15',
    description: 'Supabase PostgreSQL, RLS & schemas',
  },
] as const;

const PRODUCTIVITY_LIST = [
  {
    name: 'tasks',
    displayName: 'Tasks',
    icon: CheckSquare,
    colorClass: 'text-dept-production',
  },
  {
    name: 'documents',
    displayName: 'Documents',
    icon: FileText,
    colorClass: 'text-dept-drilling',
  },
  {
    name: 'schedule',
    displayName: 'Schedule',
    icon: CalendarDays,
    colorClass: 'text-dept-control-room',
  },
  {
    name: 'calculations',
    displayName: 'Calculations',
    icon: Calculator,
    colorClass: 'text-dept-engineering',
  },
  {
    name: 'notes',
    displayName: 'Notes',
    icon: StickyNote,
    colorClass: 'text-accent-amber',
  },
] as const;

const urls = getServiceUrls();
const EXTERNAL_LIST = [
  {
    name: 'flowise',
    displayName: 'Flowise AI',
    icon: Bot,
    url: urls.portal,
    colorClass: 'text-[#3ecf8e]',
  },
] as const;

const NAV_BTN =
  'px-2.5 min-h-11 flex items-center rounded-button text-[13px] font-medium text-[var(--text-heading)] hover:bg-black/10 data-[state=open]:bg-black/10 transition-colors select-none outline-none cursor-default';

const DROPDOWN_CONTENT =
  'liquid-glass-light backdrop-blur-2xl shadow-window border border-white/20 rounded-card py-1';

export function MacMenuBar({
  menuItems = NAVIGATION_ITEMS,
  centerSlot,
  rightSlot,
  className,
}: MacMenuBarProps) {
  const [pathname, setPathname] = React.useState('/hub');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [systemMenuOpen, setSystemMenuOpen] = React.useState(false);
  const [focusedModule, setFocusedModule] = React.useState<{
    name: string;
    title: string;
  } | null>(null);

  React.useEffect(() => {
    setPathname(window.location.pathname);
    const handlePopState = () => {
      setPathname(window.location.pathname);
      setSystemMenuOpen(false);
    };
    const handleModuleChange = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; title?: string }>).detail;
      if (detail?.name && detail?.title) {
        setFocusedModule({ name: detail.name, title: detail.title });
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('arch:active-module-change', handleModuleChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('arch:active-module-change', handleModuleChange);
    };
  }, []);

  const routeDept = React.useMemo(
    () => DEPARTMENTS_LIST.find((d) => pathname.startsWith(`/${d.name}`)) ?? null,
    [pathname]
  );

  const focusedDept = React.useMemo(
    () =>
      focusedModule ? (DEPARTMENTS_LIST.find((d) => d.name === focusedModule.name) ?? null) : null,
    [focusedModule]
  );

  const activeDeptSlug = routeDept?.name ?? focusedDept?.name ?? DEPARTMENTS_LIST[0].name;
  const isHubRoute = pathname === '/hub' || pathname === '/';
  const isAdminRoute = pathname.startsWith('/admin');

  const currentContextLabel = isAdminRoute
    ? 'Admin Panel'
    : routeDept
      ? routeDept.displayName
      : focusedModule && focusedModule.name !== 'overview'
        ? focusedModule.title
        : 'Central Hub';

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      '_blank',
      'noopener,noreferrer'
    );
    setSearchQuery('');
  }

  return (
    <m.div
      initial={false}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'fixed top-2 right-3 left-3 z-navigation flex h-11 items-center justify-between px-3.5',
        'liquid-glass-light gold-steel-border rounded-full border border-white/20 shadow-window',
        className
      )}
    >
      {/* Left: System Menu Trigger + Navigation items */}
      <nav className="flex shrink-0 items-center gap-1" aria-label="Main Navigation">
        {/* ── System Logo Dropdown ── */}
        <DropdownMenu open={systemMenuOpen} onOpenChange={setSystemMenuOpen}>
          <div className="flex items-center gap-1.5">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="System Menu"
                aria-haspopup="true"
                title={`System Menu · Active: ${currentContextLabel}`}
                className="gold-steel-border gold-steel-border-slim relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/60 bg-white/80 shadow-xs backdrop-blur-md transition-all duration-150 ease-in-out hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] active:scale-95 data-[state=open]:border-[var(--accent-blue)]/40 data-[state=open]:bg-[var(--accent-blue)]/15 data-[state=open]:ring-2 data-[state=open]:ring-[var(--accent-blue)]/25"
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
              className="gold-steel-border gold-steel-border-slim flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/50 bg-white/70 shadow-sm backdrop-blur-md transition-all duration-150 hover:scale-110 hover:bg-white/95 hover:shadow-md active:scale-95"
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
                      <Icon
                        className={cn('h-3.5 w-3.5 shrink-0 transition-colors', tool.colorClass)}
                      />
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

        {/* Context label pill button */}
        <button
          type="button"
          onClick={() => setSystemMenuOpen((open) => !open)}
          className="gold-steel-border gold-steel-border-slim ml-1 hidden h-7 cursor-pointer select-none items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/60 px-2.5 font-medium text-[11px] text-[var(--text-heading)] shadow-2xs backdrop-blur-md transition-all hover:bg-white/85 md:inline-flex"
          title="Open System Menu"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--accent-blue)]"
            aria-hidden="true"
          />
          <span className="max-w-[140px] truncate">{currentContextLabel}</span>
          <Logo
            variant="gold"
            className={cn(
              'h-3 w-3 shrink-0 transition-transform duration-200 ease-out',
              systemMenuOpen ? 'rotate-0' : 'rotate-180'
            )}
          />
        </button>

        {/* ── Menu Bar Items ── */}
        {menuItems.map((item) => {
          if (item === 'Operations') {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <button className={NAV_BTN}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn('w-60', DROPDOWN_CONTENT)}>
                  {DEPARTMENTS_LIST.map((dept) => {
                    const Icon = dept.icon;
                    return (
                      <DropdownMenuItem
                        key={dept.name}
                        asChild
                        className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                      >
                        <Link
                          href={`/${dept.name}`}
                          className="flex w-full items-center px-2 py-1.5"
                        >
                          <div
                            className={cn(
                              'mr-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm',
                              dept.bgColor
                            )}
                          >
                            <Icon className={cn('h-3.5 w-3.5', dept.iconColor)} />
                          </div>
                          <span className="font-medium text-[13px] text-[var(--text-heading)]">
                            {dept.displayName}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item === 'Tools') {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <button className={NAV_BTN}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn('w-52', DROPDOWN_CONTENT)}>
                  {PRODUCTIVITY_LIST.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <DropdownMenuItem
                        key={tool.name}
                        asChild
                        className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                      >
                        <Link
                          href={`/${DEPARTMENTS_LIST[0]?.name}/tools?tab=${tool.name}`}
                          className="flex w-full items-center gap-2.5 px-2 py-1.5"
                        >
                          <Icon className={cn('h-4 w-4 shrink-0', tool.colorClass)} />
                          <span className="font-medium text-[13px] text-[var(--text-heading)]">
                            {tool.displayName}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuItem
                    className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('open-split-view', {
                          detail: { service: 'github' },
                        })
                      );
                    }}
                  >
                    <div className="flex w-full items-center gap-2.5 px-2 py-1.5">
                      <svg
                        className="h-4 w-4 shrink-0 fill-current text-dept-drilling"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </svg>
                      <span className="font-medium text-[13px] text-[var(--text-heading)]">
                        GitHub Workspace
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="mx-1 my-1 bg-black/[0.06]" />
                  {EXTERNAL_LIST.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <DropdownMenuItem
                        key={tool.name}
                        asChild
                        className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                      >
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center justify-between px-2 py-1.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={cn('h-4 w-4 shrink-0', tool.colorClass)} />
                            <span className="font-medium text-[13px] text-[var(--text-heading)]">
                              {tool.displayName}
                            </span>
                          </div>
                          <ExternalLink className="h-3 w-3 opacity-40" />
                        </a>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item === 'View') {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <button className={NAV_BTN}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn('w-48', DROPDOWN_CONTENT)}>
                  <DropdownMenuItem
                    className="mx-1 my-0.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
                    onClick={() => window.location.reload()}
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="font-medium text-[13px] text-[var(--text-heading)]">
                      Reload
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌘R</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="mx-1 my-0.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      } else if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="font-medium text-[13px] text-[var(--text-heading)]">
                      Toggle Fullscreen
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌃⌘F</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item === 'Help') {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <button className={NAV_BTN}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn('w-52', DROPDOWN_CONTENT)}>
                  <DropdownMenuItem
                    asChild
                    className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                  >
                    <a
                      href="https://docs.arch.os"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-2.5 px-2 py-1.5"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="font-medium text-[13px] text-[var(--text-heading)]">
                        Documentation
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                  >
                    <a
                      href="https://wiki.arch.os"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-2.5 px-2 py-1.5"
                    >
                      <ScrollText className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="font-medium text-[13px] text-[var(--text-heading)]">
                        Wiki
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="mx-1 my-1 bg-black/[0.06]" />
                  <DropdownMenuItem
                    asChild
                    className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                  >
                    <a
                      href="mailto:support@arch.os"
                      className="flex w-full items-center gap-2.5 px-2 py-1.5"
                    >
                      <MailOpen className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="font-medium text-[13px] text-[var(--text-heading)]">
                        Contact Support
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="mx-1 my-1 bg-black/[0.06]" />
                  <DropdownMenuItem className="mx-1 my-0.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]">
                    <Info className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="font-medium text-[13px] text-[var(--text-heading)]">
                      About Arch Systems
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <button key={item} type="button" className={NAV_BTN}>
              {item}
            </button>
          );
        })}
      </nav>

      {/* Center: Pill-shaped search or custom slot */}
      <div className="mx-4 hidden flex-1 items-center justify-center sm:flex">
        {centerSlot !== undefined ? (
          centerSlot
        ) : (
          <form onSubmit={handleSearch} className="flex w-full justify-center">
            <div className="gold-steel-border gold-steel-border-slim relative w-full max-w-2xl rounded-full">
              <Logo
                variant="gold"
                className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-3.5 w-3.5 -translate-y-1/2 text-accent-amber"
              />
              <Search className="pointer-events-none absolute top-1/2 right-2.5 z-10 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                aria-label="Search"
                className="gold-steel-border gold-steel-border-slim h-6 w-full rounded-full border border-accent-amber/60 bg-white/35 pr-7 pl-7 text-[12px] text-[var(--text-heading)] shadow-diffusion-sm backdrop-blur-md transition-all placeholder:text-[var(--text-muted)] hover:bg-white/50 focus:border-accent-amber focus:bg-white/70 focus:outline-none"
              />
            </div>
          </form>
        )}
      </div>

      {/* Right: system tray slot */}
      <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
        {rightSlot}
      </div>
    </m.div>
  );
}
