'use client';

import { m } from 'framer-motion';
import {
  BookOpen,
  ExternalLink,
  Info,
  MailOpen,
  Maximize2,
  RotateCcw,
  ScrollText,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { MacSystemMenuDropdown } from './MacSystemMenuDropdown';
import {
  DEPARTMENTS_LIST,
  DROPDOWN_CONTENT,
  EXTERNAL_LIST,
  type MacMenuBarProps,
  NAV_BTN,
  NAVIGATION_ITEMS,
  PRODUCTIVITY_LIST,
} from './mac-menu-bar-constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
        <MacSystemMenuDropdown
          systemMenuOpen={systemMenuOpen}
          setSystemMenuOpen={setSystemMenuOpen}
          pathname={pathname}
          setPathname={setPathname}
          focusedModule={focusedModule}
          setFocusedModule={setFocusedModule}
          currentContextLabel={currentContextLabel}
          activeDeptSlug={activeDeptSlug}
          isHubRoute={isHubRoute}
          isAdminRoute={isAdminRoute}
        />

        {/* Context label pill button */}
        <button
          type="button"
          onClick={() => setSystemMenuOpen((open) => !open)}
          className={cn(
            'gold-steel-border gold-steel-border-slim ml-1 hidden h-7 cursor-pointer select-none items-center gap-1.5 rounded-full',
            'border border-black/[0.08] bg-white/60 px-2.5 font-medium text-[11px] text-[var(--text-heading)] shadow-2xs backdrop-blur-md transition-all hover:bg-white/85 md:inline-flex'
          )}
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
                className={cn(
                  'gold-steel-border gold-steel-border-slim h-6 w-full rounded-full border border-accent-amber/60 bg-white/35 pr-7 pl-7',
                  'text-[12px] text-[var(--text-heading)] shadow-diffusion-sm backdrop-blur-md transition-all placeholder:text-[var(--text-muted)]',
                  'hover:bg-white/50 focus:border-accent-amber focus:bg-white/70 focus:outline-none'
                )}
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
