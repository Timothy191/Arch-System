'use client';

import {
  type MotionValue,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
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

/* ── 3D taskbar surface ──────────────────────────────────────────────────────
 * Depth comes from stacked, pointer-inert decor layers painted behind the
 * content (`-z-10` inside the bar's own stacking context): an elevated gold
 * drop shadow, a bevel (top highlight / bottom gold inner edge), a pointer-
 * following specular sheen and a periodic glint. Every animated property is
 * transform or opacity; pointer effects are disabled for touch and
 * prefers-reduced-motion. All colours come from semantic CSS variables.
 */
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const TILT_SPRING = { stiffness: 170, damping: 22, mass: 0.6 } as const;
const HOVER_SPRING = { stiffness: 210, damping: 26 } as const;
const SHEEN_SPRING = { stiffness: 260, damping: 30 } as const;
const SHEEN_HALF_WIDTH = 144;
const BAR_PERSPECTIVE = 1200;

const BAR_LAYOUT =
  'fixed inset-x-3 top-2 z-50 flex h-11 items-center justify-between gap-2 rounded-full px-3.5';
const BAR_GLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim border border-white/25 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md';

const DECOR_LAYER = 'pointer-events-none absolute inset-0 -z-10 rounded-full';
const DECOR_CLIP = cn(DECOR_LAYER, 'overflow-hidden');
const DEPTH_REST =
  'shadow-[0_14px_30px_-18px_color-mix(in_oklch,var(--accent-gold)_60%,transparent),0_6px_14px_-8px_color-mix(in_oklch,var(--text-heading)_26%,transparent)]';
const DEPTH_LIFT =
  'shadow-[0_24px_44px_-20px_color-mix(in_oklch,var(--accent-gold)_75%,transparent),0_12px_24px_-12px_color-mix(in_oklch,var(--text-heading)_30%,transparent)]';
const BEVEL =
  'shadow-[inset_0_1px_0_color-mix(in_oklch,white_85%,transparent),inset_0_-1px_0_color-mix(in_oklch,var(--accent-gold)_50%,transparent),inset_0_0_0_1px_color-mix(in_oklch,var(--accent-gold)_22%,transparent)]';
const EDGE_TOP =
  'pointer-events-none absolute inset-x-10 top-px -z-10 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90';
const EDGE_BOTTOM =
  'pointer-events-none absolute inset-x-16 bottom-px -z-10 h-px bg-gradient-to-r from-transparent via-accent-gold/70 to-transparent';
const SHEEN =
  'absolute top-[-58px] left-0 h-40 w-72 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,white_65%,transparent),color-mix(in_oklch,var(--accent-gold)_20%,transparent)_50%,transparent)]';
const GLINT_TRACK = 'absolute inset-0';
const GLINT =
  'absolute inset-y-0 left-0 w-24 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent';
const SEPARATOR =
  'hidden h-5 w-px shrink-0 rounded-full bg-gradient-to-b from-transparent via-accent-gold/70 to-transparent md:block';

const NAV_BTN_LIFT =
  'relative transform-gpu transition-[transform,background-color] duration-200 ease-out hover:-translate-y-px active:translate-y-0 motion-reduce:transform-none';
const NAV_BTN_UNDERLINE =
  'after:pointer-events-none after:absolute after:inset-x-2.5 after:bottom-2 after:h-px after:scale-x-0 after:rounded-full after:bg-accent-gold after:opacity-0 after:shadow-[0_0_8px_var(--accent-gold)] after:transition-[transform,opacity] after:duration-300';
const NAV_BTN_UNDERLINE_ON =
  'hover:after:scale-x-100 hover:after:opacity-100 focus-visible:after:scale-x-100 focus-visible:after:opacity-100 data-[state=open]:after:scale-x-100 data-[state=open]:after:opacity-100';
/** NAV_BTN plus hover lift and a gold glow underline (also shown while a menu is open). */
const NAV_BTN_3D = cn(NAV_BTN, NAV_BTN_LIFT, NAV_BTN_UNDERLINE, NAV_BTN_UNDERLINE_ON);

function useFinePointer(): boolean {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setFine(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return fine;
}

function BarSeparator({ delay, reduceMotion }: { delay: number; reduceMotion: boolean }) {
  return (
    <m.span
      aria-hidden="true"
      data-testid="menubar-separator"
      className={SEPARATOR}
      initial={{ scaleY: 0, opacity: 0 }}
      animate={reduceMotion ? { scaleY: 1, opacity: 1 } : { scaleY: 1, opacity: [0, 1, 0.5, 1] }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              scaleY: { delay, duration: 0.5, ease: EASE_OUT_EXPO },
              opacity: {
                delay,
                duration: 4.5,
                times: [0, 0.12, 0.6, 1],
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'mirror',
                ease: 'easeInOut',
              },
            }
      }
    />
  );
}

function BarDecor({
  lift,
  sheenX,
  sheenOpacity,
  reduceMotion,
}: {
  lift: MotionValue<number>;
  sheenX: MotionValue<number>;
  sheenOpacity: MotionValue<number>;
  reduceMotion: boolean;
}) {
  return (
    <>
      <span aria-hidden="true" className={cn(DECOR_LAYER, DEPTH_REST)} />
      <m.span
        aria-hidden="true"
        className={cn(DECOR_LAYER, DEPTH_LIFT)}
        style={{ opacity: lift }}
      />
      <span aria-hidden="true" className={cn(DECOR_LAYER, BEVEL)} />
      <span aria-hidden="true" className={DECOR_CLIP}>
        <m.span className={SHEEN} style={{ x: sheenX, opacity: sheenOpacity }} />
        <m.span
          className={GLINT_TRACK}
          initial={{ x: '-100%' }}
          animate={reduceMotion ? undefined : { x: ['-100%', '100%'] }}
          transition={{
            duration: 2.6,
            ease: 'easeInOut',
            delay: 1.2,
            repeat: Number.POSITIVE_INFINITY,
            repeatDelay: 7,
          }}
        >
          <span className={GLINT} />
        </m.span>
      </span>
      <span aria-hidden="true" className={EDGE_TOP} />
      <span aria-hidden="true" className={EDGE_BOTTOM} />
    </>
  );
}

export function MacMenuBar({
  menuItems = NAVIGATION_ITEMS,
  centerSlot,
  rightSlot,
  userSlot,
  className,
}: MacMenuBarProps) {
  const [pathname, setPathname] = React.useState('/hub');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [systemMenuOpen, setSystemMenuOpen] = React.useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
  const [focusedModule, setFocusedModule] = React.useState<{
    name: string;
    title: string;
  } | null>(null);

  React.useEffect(() => {
    setPathname(window.location.pathname);
    if (typeof document !== 'undefined') {
      setIsSidebarExpanded(document.documentElement.dataset.sidebarExpanded === 'true');
    }
    const handlePopState = () => {
      setPathname(window.location.pathname);
      setSystemMenuOpen(false);
    };
    const handleModuleChange = (e: Event) => {
      setPathname(window.location.pathname);
      const detail = (e as CustomEvent<{ name?: string; title?: string }>).detail;
      if (detail?.name && detail?.title) {
        setFocusedModule({ name: detail.name, title: detail.title });
      }
    };
    const handleSidebarStateChange = (e: Event) => {
      const detail = (e as CustomEvent<{ expanded?: boolean }>).detail;
      setIsSidebarExpanded(Boolean(detail?.expanded));
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('arch:active-module-change', handleModuleChange);
    window.addEventListener('arch:sidebar-state-change', handleSidebarStateChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('arch:active-module-change', handleModuleChange);
      window.removeEventListener('arch:sidebar-state-change', handleSidebarStateChange);
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

  /* ── Pointer-driven depth (fine pointers only, never under reduced motion) ── */
  const reduceMotion = useReducedMotion() ?? false;
  const finePointer = useFinePointer();
  const interactive = finePointer && !reduceMotion;
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const hover = useMotionValue(0);
  const sheenLeft = useMotionValue(0);
  const springX = useSpring(pointerX, TILT_SPRING);
  const springY = useSpring(pointerY, TILT_SPRING);
  const lift = useSpring(hover, HOVER_SPRING);
  const sheenX = useSpring(sheenLeft, SHEEN_SPRING);
  const rotateX = useTransform(springY, [-0.5, 0.5], [2, -2]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-0.6, 0.6]);
  const liftZ = useTransform(lift, [0, 1], [0, 6]);
  const sheenOpacity = useTransform(lift, [0, 1], [0, 0.9]);
  const barRectRef = React.useRef<DOMRect | null>(null);

  const resetDepth = React.useCallback(() => {
    barRectRef.current = null;
    pointerX.set(0);
    pointerY.set(0);
    hover.set(0);
  }, [pointerX, pointerY, hover]);

  React.useEffect(() => {
    if (!interactive) resetDepth();
  }, [interactive, resetDepth]);

  function handlePointerEnter(e: React.PointerEvent<HTMLDivElement>) {
    if (!interactive || e.pointerType !== 'mouse') return;
    barRectRef.current = e.currentTarget.getBoundingClientRect();
    hover.set(1);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!interactive || e.pointerType !== 'mouse') return;
    const rect = barRectRef.current ?? e.currentTarget.getBoundingClientRect();
    barRectRef.current = rect;
    if (rect.width === 0 || rect.height === 0) return;
    const localX = e.clientX - rect.left;
    pointerX.set(localX / rect.width - 0.5);
    pointerY.set((e.clientY - rect.top) / rect.height - 0.5);
    sheenLeft.set(localX - SHEEN_HALF_WIDTH);
    hover.set(1);
  }

  return (
    <m.div
      initial={{ opacity: 0, y: -16, scale: 0.985 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT_EXPO }}
      style={{ rotateX, rotateY, z: liftZ, transformPerspective: BAR_PERSPECTIVE }}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetDepth}
      data-sidebar-expanded={isSidebarExpanded ? 'true' : 'false'}
      data-hub-route={isHubRoute ? 'true' : 'false'}
      data-testid="mac-menu-bar"
      className={cn(BAR_LAYOUT, BAR_GLASS, className)}
    >
      <BarDecor
        lift={lift}
        sheenX={sheenX}
        sheenOpacity={sheenOpacity}
        reduceMotion={reduceMotion}
      />
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
          userSlot={userSlot}
        />

        {/* Context label pill button */}
        <button
          type="button"
          onClick={() => setSystemMenuOpen((open) => !open)}
          className={cn(
            'group/ctx gold-steel-border gold-steel-border-slim ml-1 hidden h-7 cursor-pointer select-none items-center gap-1.5 rounded-full',
            'border border-accent-gold/40 bg-white/70 px-2.5 font-medium text-[11px] text-[var(--text-heading)] shadow-2xs backdrop-blur-md transition-all hover:border-accent-gold hover:bg-white/90 md:inline-flex'
          )}
          title="Open System Menu"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent-gold"
            aria-hidden="true"
          />
          <span
            className={cn(
              'truncate transition-all duration-300 ease-out',
              systemMenuOpen
                ? 'max-w-[140px] opacity-100'
                : 'max-w-0 opacity-0 group-hover/ctx:max-w-[140px] group-hover/ctx:opacity-100 group-focus-visible/ctx:max-w-[140px] group-focus-visible/ctx:opacity-100'
            )}
          >
            {currentContextLabel}
          </span>
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
                  <button className={NAV_BTN_3D}>{item}</button>
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
                  <button className={NAV_BTN_3D}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn('w-52', DROPDOWN_CONTENT)}>
                  {PRODUCTIVITY_LIST.map((tool) => {
                    const Icon = tool.icon;
                    const splitService =
                      tool.name === 'documents'
                        ? 'google-docs'
                        : tool.name === 'schedule'
                          ? 'google-calendar'
                          : null;

                    if (splitService) {
                      return (
                        <DropdownMenuItem
                          key={tool.name}
                          className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent('open-split-view', {
                                detail: { service: splitService, action: 'open' },
                              })
                            );
                          }}
                        >
                          <div className="flex w-full items-center justify-between px-2 py-1.5">
                            <div className="flex items-center gap-2.5">
                              <Icon className={cn('h-4 w-4 shrink-0', tool.colorClass)} />
                              <span className="font-medium text-[13px] text-[var(--text-heading)]">
                                {tool.displayName}
                              </span>
                            </div>
                            <span className="rounded bg-blue-50 px-1 py-0.2 font-mono text-[9px] text-blue-600 uppercase">
                              Split
                            </span>
                          </div>
                        </DropdownMenuItem>
                      );
                    }

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
                        GitHub Workspace (Split)
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="mx-1 my-0.5 cursor-pointer rounded-lg hover:bg-black/[0.04] focus:bg-black/[0.04]"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('open-split-view', {
                          detail: { service: 'whatsapp' },
                        })
                      );
                    }}
                  >
                    <div className="flex w-full items-center gap-2.5 px-2 py-1.5">
                      <svg
                        className="h-4 w-4 shrink-0 fill-current text-emerald-600"
                        viewBox="0 0 24 24"
                      >
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.896c1.675.993 3.324 1.558 5.207 1.559 5.405 0 9.803-4.375 9.806-9.754.002-2.607-1.002-5.06-2.83-6.892-1.829-1.83-4.263-2.836-6.868-2.837-5.39 0-9.786 4.377-9.79 9.753-.001 2.03.535 3.738 1.555 5.262l-.994 3.63 3.74-.981z" />
                      </svg>
                      <span className="font-medium text-[13px] text-[var(--text-heading)]">
                        WhatsApp Operations (Split)
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
                  <button className={NAV_BTN_3D}>{item}</button>
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
                  <button className={NAV_BTN_3D}>{item}</button>
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
            <button key={item} type="button" className={NAV_BTN_3D}>
              {item}
            </button>
          );
        })}
      </nav>

      <BarSeparator delay={0.35} reduceMotion={reduceMotion} />

      {/* Center: Pill-shaped search or custom slot */}
      <div className="mx-2 hidden min-w-0 flex-1 items-center justify-center sm:flex md:mx-4">
        {centerSlot !== undefined ? (
          centerSlot
        ) : (
          <form onSubmit={handleSearch} className="flex w-full justify-center">
            <div className="gold-steel-border gold-steel-border-slim relative w-full max-w-2xl rounded-full">
              <Logo
                variant="gold"
                className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-3.5 w-3.5 -translate-y-1/2 text-accent-gold"
              />
              <Search className="pointer-events-none absolute top-1/2 right-2.5 z-10 h-3 w-3 -translate-y-1/2 text-accent-gold" />
              <input
                id="mac-menubar-search"
                name="q"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                aria-label="Search"
                className={cn(
                  'gold-steel-border gold-steel-border-slim h-6 w-full rounded-full border border-accent-gold/60 bg-white/35 pr-7 pl-7',
                  'text-[12px] text-[var(--text-heading)] shadow-diffusion-sm backdrop-blur-md transition-all placeholder:text-[var(--text-muted)]',
                  'hover:bg-white/50 focus:border-accent-gold focus:bg-white/70 focus:outline-none'
                )}
              />
            </div>
          </form>
        )}
      </div>

      <BarSeparator delay={0.5} reduceMotion={reduceMotion} />

      {/* Right: system tray slot */}
      <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
        {rightSlot}
      </div>
    </m.div>
  );
}
