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
  // General
  ExternalLink,
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
    colorClass: 'text-dept-safety',
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
        'fixed top-2 left-3 right-3 z-navigation h-11 flex items-center justify-between px-3.5',
        'liquid-glass-light border border-white/20 shadow-window rounded-full',
        className
      )}
    >
      {/* Left: System Menu Trigger + Navigation items */}
      <nav className="flex items-center gap-1 shrink-0" aria-label="Main Navigation">
        {/* ── System Logo Dropdown ── */}
        <DropdownMenu open={systemMenuOpen} onOpenChange={setSystemMenuOpen}>
          <div className="flex items-center gap-1.5">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="System Menu"
                aria-haspopup="true"
                title={`System Menu · Active: ${currentContextLabel}`}
                className="relative w-9 h-9 rounded-full bg-[var(--material-ultra-thin)] hover:bg-[var(--material-thin)] data-[state=open]:bg-[var(--accent-blue)]/15 data-[state=open]:border-[var(--accent-blue)]/40 data-[state=open]:ring-2 data-[state=open]:ring-[var(--accent-blue)]/25 backdrop-blur-md border border-white/20 shadow-diffusion-sm flex items-center justify-center active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] transition-all duration-150 ease-in-out cursor-pointer"
              >
                <Logo className="w-6 h-6 text-[var(--accent-blue)]" />
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-2xs transition-colors',
                    systemMenuOpen ? 'bg-[var(--accent-blue)]' : 'bg-accent-green'
                  )}
                  aria-hidden="true"
                />
              </button>
            </DropdownMenuTrigger>
            <button
              type="button"
              onClick={() => setSystemMenuOpen((open) => !open)}
              className="hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/60 hover:bg-white/85 backdrop-blur-md border border-black/[0.08] text-[11px] font-medium text-[var(--text-heading)] shadow-2xs transition-all cursor-pointer select-none"
              title="Open System Menu"
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse shrink-0"
                aria-hidden="true"
              />
              <span className="truncate max-w-[140px]">{currentContextLabel}</span>
            </button>
          </div>
          <DropdownMenuContent
            align="start"
            sideOffset={5}
            className={cn(
              'w-[560px] p-0 flex flex-col md:flex-row overflow-hidden z-popover',
              'bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-window rounded-card'
            )}
          >
            {/* ── Left Column: Departments ── */}
            <div className="flex-1 p-3.5 space-y-2">
              <div className="flex items-center justify-between px-2">
                <p className="text-[10.5px] font-medium text-[var(--text-muted)] uppercase tracking-widest">
                  System Departments
                </p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 text-[9.5px] font-mono font-semibold text-[var(--accent-blue)] truncate max-w-[165px]">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse"
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
                  'flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all group border',
                  isHubRoute && (!focusedModule || focusedModule.name === 'overview')
                    ? 'bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/25'
                    : 'border-transparent hover:bg-black/[0.04] active:bg-black/[0.08]'
                )}
              >
                <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] transition-transform group-hover:scale-105">
                  <LayoutGrid className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium text-[var(--text-heading)] truncate leading-tight">
                    Central Operations Hub
                  </span>
                  <span className="text-[10.5px] text-[var(--text-muted)] truncate leading-tight">
                    Executive overview &amp; shift telemetry
                  </span>
                </div>
                {isHubRoute && (!focusedModule || focusedModule.name === 'overview') ? (
                  <span className="ml-auto px-1.5 py-0.5 rounded-md bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] text-[9px] font-mono font-semibold uppercase tracking-wider shrink-0">
                    Active
                  </span>
                ) : (
                  <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-60 ml-auto shrink-0 transition-opacity" />
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
                        'flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all group border',
                        isRouteActive
                          ? 'bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/25'
                          : isFocused
                            ? 'bg-black/[0.035] border-black/[0.08]'
                            : 'border-transparent hover:bg-black/[0.04] active:bg-black/[0.08]'
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg shrink-0 flex items-center justify-center transition-transform group-hover:scale-105',
                          dept.bgColor
                        )}
                      >
                        <Icon className={cn('w-3.5 h-3.5', dept.iconColor)} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-medium text-[var(--text-body)] group-hover:text-[var(--text-heading)] truncate leading-tight">
                          {dept.displayName}
                        </span>
                        <span className="text-[10.5px] text-[var(--text-muted)] truncate leading-tight">
                          {dept.description}
                        </span>
                      </div>
                      {isRouteActive ? (
                        <span className="ml-auto px-1.5 py-0.5 rounded-md bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] text-[9px] font-mono font-semibold uppercase tracking-wider shrink-0">
                          Active
                        </span>
                      ) : isFocused ? (
                        <span className="ml-auto px-1.5 py-0.5 rounded-md bg-black/[0.06] text-[var(--text-secondary)] text-[9px] font-mono font-semibold uppercase tracking-wider shrink-0">
                          Focused
                        </span>
                      ) : (
                        <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-60 ml-auto shrink-0 transition-opacity" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ── Right Column: User + Tools + Admin ── */}
            <div className="w-[205px] bg-black/[0.015] border-l border-black/[0.05] flex flex-col shrink-0">
              {/* User Identity */}
              <div className="px-3.5 py-3 flex items-center gap-2.5 border-b border-black/[0.06]">
                <Avatar
                  size={32}
                  letter="AO"
                  title="Arch Operator"
                  className="border border-black/10 shadow-card shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-[12.5px] font-medium text-[var(--text-heading)] truncate leading-tight">
                    Arch Operator
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] truncate leading-tight">
                    admin@arch-systems.com
                  </span>
                </div>
              </div>

              {/* Tools */}
              <div className="px-2.5 pt-2.5 pb-1 space-y-0.5">
                <div className="flex items-center justify-between px-2 mb-1">
                  <p className="text-[10.5px] font-medium text-[var(--text-muted)] uppercase tracking-widest">
                    Tools
                  </p>
                  <span className="text-[9.5px] font-mono text-[var(--text-muted)] truncate max-w-[95px]">
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
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group"
                    >
                      <Icon
                        className={cn('w-3.5 h-3.5 shrink-0 transition-colors', tool.colorClass)}
                      />
                      <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
                        {tool.displayName}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <DropdownMenuSeparator className="bg-black/[0.06] mx-2.5" />

              {/* Split View & Quick Actions */}
              <div className="px-2.5 pb-1 space-y-0.5">
                <p className="px-2 text-[10.5px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-1 pt-1">
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
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group text-left focus:outline-none cursor-pointer"
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0 text-dept-engineering"
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
                    <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
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
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group text-left focus:outline-none cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Command className="w-3.5 h-3.5 shrink-0 text-[var(--accent-blue)]" />
                      <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
                        Command Palette
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">⌘K</span>
                  </button>
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator className="bg-black/[0.06] mx-2.5" />

              {/* Automation */}
              <div className="px-2.5 pb-1 space-y-0.5">
                <p className="px-2 text-[10.5px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-1 pt-1">
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
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={cn('w-3.5 h-3.5 shrink-0', tool.colorClass)} />
                        <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
                          {tool.displayName}
                        </span>
                      </div>
                      <ExternalLink className="w-2.5 h-2.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
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
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group"
                >
                  <Activity className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0" />
                  <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
                    AI &amp; Build Metrics
                  </span>
                </Link>
              </div>

              {/* Admin Panel */}
              <div className="mt-auto px-2.5 py-2.5 border-t border-black/[0.06]">
                <Link
                  href="/admin"
                  onClick={() => {
                    setPathname('/admin');
                    setFocusedModule({ name: 'admin', title: 'Admin Panel' });
                    setSystemMenuOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-between gap-2.5 px-2 py-1.5 rounded-lg transition-all group',
                    isAdminRoute || focusedModule?.name === 'admin'
                      ? 'bg-dept-admin/15 text-dept-admin'
                      : 'hover:bg-dept-admin/10 active:bg-dept-admin/15'
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Shield className="w-3.5 h-3.5 text-dept-admin shrink-0" />
                    <span className="text-[12.5px] font-medium text-[var(--text-secondary)] group-hover:text-dept-admin">
                      Admin Panel
                    </span>
                  </span>
                  {(isAdminRoute || focusedModule?.name === 'admin') && (
                    <span className="px-1.5 py-0.5 rounded-md bg-dept-admin/15 text-dept-admin text-[9px] font-mono font-semibold uppercase tracking-wider">
                      Active
                    </span>
                  )}
                </Link>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* WhatsApp Web Split-Screen trigger */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('open-split-view', {
                detail: { service: 'whatsapp', action: 'toggle' },
              })
            );
          }}
          className="w-8 h-8 rounded-full bg-[var(--material-ultra-thin)] hover:bg-[var(--material-thin)] backdrop-blur-md border border-white/20 shadow-diffusion-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer ml-1 shrink-0"
          title="WhatsApp Web (Split Screen)"
        >
          <Image
            src="/whatsapp-logo.jpeg"
            alt="WhatsApp Logo"
            width={18}
            height={18}
            className="rounded-full object-cover shrink-0"
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
                        className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5"
                      >
                        <Link
                          href={`/${dept.name}`}
                          className="w-full flex items-center px-2 py-1.5"
                        >
                          <div
                            className={cn(
                              'w-6 h-6 rounded-sm flex items-center justify-center mr-2.5 shrink-0',
                              dept.bgColor
                            )}
                          >
                            <Icon className={cn('w-3.5 h-3.5', dept.iconColor)} />
                          </div>
                          <span className="text-[13px] font-medium text-[var(--text-heading)]">
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
                        className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5"
                      >
                        <Link
                          href={`/${DEPARTMENTS_LIST[0]?.name}/tools?tab=${tool.name}`}
                          className="w-full flex items-center px-2 py-1.5 gap-2.5"
                        >
                          <Icon className={cn('w-4 h-4 shrink-0', tool.colorClass)} />
                          <span className="text-[13px] font-medium text-[var(--text-heading)]">
                            {tool.displayName}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('open-split-view', {
                          detail: { service: 'github' },
                        })
                      );
                    }}
                  >
                    <div className="w-full flex items-center px-2 py-1.5 gap-2.5">
                      <svg
                        className="w-4 h-4 shrink-0 text-dept-drilling fill-current"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </svg>
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        GitHub Workspace
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-black/[0.06] my-1 mx-1" />
                  {EXTERNAL_LIST.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <DropdownMenuItem
                        key={tool.name}
                        asChild
                        className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5"
                      >
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-between px-2 py-1.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={cn('w-4 h-4 shrink-0', tool.colorClass)} />
                            <span className="text-[13px] font-medium text-[var(--text-heading)]">
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
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                    onClick={() => window.location.reload()}
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
                      Reload
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌘R</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      } else if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
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
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5"
                  >
                    <a
                      href="https://docs.arch.os"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2.5 px-2 py-1.5"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        Documentation
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5"
                  >
                    <a
                      href="https://wiki.arch.os"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2.5 px-2 py-1.5"
                    >
                      <ScrollText className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        Wiki
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-black/[0.06] my-1 mx-1" />
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5"
                  >
                    <a
                      href="mailto:support@arch.os"
                      className="w-full flex items-center gap-2.5 px-2 py-1.5"
                    >
                      <MailOpen className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        Contact Support
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-black/[0.06] my-1 mx-1" />
                  <DropdownMenuItem className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-lg mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5">
                    <Info className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
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
      <div className="hidden sm:flex flex-1 items-center justify-center mx-4">
        {centerSlot !== undefined ? (
          centerSlot
        ) : (
          <form onSubmit={handleSearch} className="w-full flex justify-center">
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                aria-label="Search"
                className="w-full h-6 pl-7 pr-3 rounded-full bg-white/35 hover:bg-white/50 focus:bg-white/70 backdrop-blur-md border border-black/[0.08] focus:border-black/20 focus:outline-none text-[12px] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] shadow-diffusion-sm transition-all"
              />
            </div>
          </form>
        )}
      </div>

      {/* Right: system tray slot */}
      <div className="flex items-center gap-1.5 shrink-0 text-[12px] text-[var(--text-secondary)]">
        {rightSlot}
      </div>
    </m.div>
  );
}
