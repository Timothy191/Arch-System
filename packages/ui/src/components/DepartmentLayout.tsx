'use client';

import { m } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckSquare,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cpu,
  CreditCard,
  Database,
  Factory,
  FileText,
  GitCommit,
  Layers,
  LifeBuoy,
  Menu,
  MessageSquare,
  Monitor,
  Pickaxe,
  Pin,
  Printer,
  QrCode,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Undo2,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDepartmentIcon } from '../icons/department-icons';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { MacTitleBar } from './MacTitleBar';

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  BarChart2: BarChart3,
  Clock,
  Cpu,
  AlertTriangle,
  Wrench,
  Pickaxe,
  GitCommit,
  Database,
  FileText,
  ClipboardCheck,
  ClipboardList,
  History: Undo2,
  Radio,
  Layers,
  ScanSearch: Search,
  CheckSquare,
  Drill: Pickaxe,
  Activity,
  ShieldCheck,
  Users,
  CreditCard,
  Factory,
  Settings,
  CircleDot: Circle,
  Monitor,
  Printer,
  QrCode,
  LifeBuoy,
};

interface Tab {
  name: string;
  label: string;
  icon: string;
}

interface DepartmentLayoutProps {
  department: {
    name: string;
    displayName: string;
    icon: string;
    color: string;
  };
  tabs: readonly Tab[];
  children: React.ReactNode;
}

const SUBTAB_LINK_BASE =
  'group relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-all';

export function DepartmentLayout({ department, tabs, children }: DepartmentLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams?.() ?? null;
  const activeTabParam = searchParams?.get?.('tab') ?? null;
  const basePath = `/${department.name}`;
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(true);
  const [isReportsExpanded, setIsReportsExpanded] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('arch:sidebar:pinned');
      if (saved === 'true') {
        setIsPinned(true);
        setIsOpen(true);
      }
    }
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('arch:sidebar:pinned', String(next));
      }
      if (next) {
        setIsOpen(true);
      }
      return next;
    });
  }, []);

  const openSidebar = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsOpen((prev) => (prev ? prev : true));
  }, []);

  const closeSidebarWithDelay = useCallback(
    (delayMs = 450) => {
      if (isPinned) return;
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
      collapseTimerRef.current = setTimeout(() => {
        // Keep open if user currently has focus inside sidebar
        if (!sidebarRef.current?.contains(document.activeElement)) {
          setIsOpen(false);
        }
      }, delayMs);
    },
    [isPinned]
  );

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  // Global mousemove proximity detection near left edge
  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPinned || isOpen) return;
      // If cursor is close enough to the left edge (within 36px), auto-reveal
      if (e.clientX <= 36) {
        openSidebar();
      }
    },
    [isPinned, isOpen, openSidebar]
  );

  return (
    <div className="relative flex h-[calc(100vh-28px)]" onMouseMove={handleContainerMouseMove}>
      {/* Hover / proximity trigger zone at the far left (disabled when pinned) */}
      <div
        className={cn(
          'absolute top-0 bottom-0 left-0 z-40 w-12',
          isPinned ? 'pointer-events-none' : 'cursor-pointer'
        )}
        onMouseEnter={openSidebar}
        onMouseMove={openSidebar}
        onClick={openSidebar}
        aria-hidden="true"
        data-testid="edge-trigger"
      />

      {/* Mobile sidebar toggle button for touchscreen / pit tablet usability */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle department navigation"
        className="fixed bottom-4 left-4 z-50 rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] p-2.5 text-[var(--text-heading)] shadow-lg hover:bg-[var(--bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop overlay */}
      {isOpen && !isPinned && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* macOS Sidebar — Auto-hide/reveal style with proximity reveal, delayed collapse, and manual pin */}
      <aside
        ref={sidebarRef}
        className={cn(
          'group/sidebar liquid-glass-light gold-steel-border absolute inset-y-0 left-0 z-50 flex w-60 flex-col rounded-r-2xl bg-white/85 shadow-2xl transition-transform duration-300',
          isPinned || isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-12px)]'
        )}
        style={{ borderRight: '1px solid rgba(212, 175, 55, 0.28)' }}
        onMouseEnter={openSidebar}
        onMouseLeave={() => closeSidebarWithDelay(450)}
        onFocus={openSidebar}
        onBlur={(e) => {
          if (!sidebarRef.current?.contains(e.relatedTarget as Node)) {
            closeSidebarWithDelay(250);
          }
        }}
      >
        {/* Subtle hint when collapsed */}
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 right-0 flex h-12 w-4 translate-x-full -translate-y-1/2 items-center justify-center transition-opacity',
            isPinned || isOpen ? 'opacity-0' : 'opacity-50'
          )}
        >
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
        </div>

        {/* MacTitleBar with department name */}
        <MacTitleBar title={department.displayName} className="bg-white/50" />

        {/* Back to Hub link & Pin toggle */}
        <div
          className={cn(
            'flex items-center justify-between px-3 pt-3 pb-1 transition-opacity duration-200',
            isPinned || isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <Link
            href="/"
            className="gold-steel-border gold-steel-border-slim group flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 font-semibold text-[11px] text-[var(--text-heading)] shadow-2xs transition-colors hover:bg-white hover:text-[var(--accent-blue)]"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-0.5">‹</span>
            <span>Back to Hub</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePin}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              className="gold-steel-border gold-steel-border-slim cursor-pointer rounded-full bg-white/80 p-1.5 text-[var(--text-heading)] shadow-2xs transition-colors hover:bg-white hover:text-[var(--accent-blue)]"
              title={isPinned ? 'Unpin sidebar (auto-collapse)' : 'Pin sidebar (always open)'}
            >
              <Pin
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  isPinned ? 'rotate-45 text-[var(--accent-blue)]' : ''
                )}
              />
            </button>
            <Logo variant="gold" className="mr-0.5 h-4 w-4 shrink-0 text-[var(--accent-blue)]" />
          </div>
        </div>

        {/* Department icon + label */}
        <div
          className={cn(
            'gold-steel-border gold-steel-border-slim mx-3 my-1.5 flex items-center gap-2.5 rounded-xl bg-white/80 px-3 py-2 shadow-xs transition-opacity duration-200',
            isPinned || isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <div className="gold-steel-border gold-steel-border-slim flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-blue)]/12 text-[var(--accent-blue)] shadow-2xs">
            {(() => {
              const DeptIcon =
                ICON_MAP[department.icon] || getDepartmentIcon(department.name) || BarChart3;
              return <DeptIcon className="h-4 w-4" />;
            })()}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate font-bold text-[12px] text-[var(--text-heading)] uppercase tracking-wider">
              {department.displayName}
            </span>
            <span className="block font-mono text-[9.5px] text-[var(--accent-blue)] uppercase tracking-widest">
              Active Command
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav
          className={cn(
            'flex-1 space-y-1 overflow-y-auto px-2.5 py-1 transition-opacity duration-200',
            isPinned || isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          {tabs.map((tab) => {
            const href = tab.name === 'dashboard' ? basePath : `${basePath}/${tab.name}`;
            const hasDashboardSubtabs =
              tab.name === 'dashboard' && department.name === 'control-room';
            const isShiftOperationsSubtabActive =
              hasDashboardSubtabs &&
              (pathname === `${basePath}/shift-compilation` ||
                pathname === `${basePath}/shift-coverage` ||
                pathname === `${basePath}/shift-closeout`);
            const isScadaDashboardSubtabActive =
              hasDashboardSubtabs && pathname === basePath && !isShiftOperationsSubtabActive;
            const isShiftOperationsActive =
              tab.name === 'shift-compilation' &&
              (pathname === `${basePath}/shift-compilation` ||
                pathname === `${basePath}/shift-coverage` ||
                pathname === `${basePath}/shift-closeout`);
            const isRouteMatch =
              pathname === href ||
              (tab.name === 'dashboard' &&
                (pathname === basePath || isShiftOperationsSubtabActive)) ||
              isShiftOperationsActive;
            const isPdfReportActive =
              tab.name === 'reports' && isRouteMatch && activeTabParam === 'pdf-report';
            const isWhatsappReportActive =
              tab.name === 'reports' && isRouteMatch && activeTabParam === 'whatsapp-report';
            const isReportsDashboardActive =
              tab.name === 'reports' &&
              isRouteMatch &&
              !isPdfReportActive &&
              !isWhatsappReportActive;
            const isActive =
              isRouteMatch &&
              !isPdfReportActive &&
              !isWhatsappReportActive &&
              !isShiftOperationsSubtabActive;
            const Icon = ICON_MAP[tab.icon];
            return (
              <div key={tab.name} className="space-y-0.5">
                <div className="flex items-center gap-0.5">
                  <Link
                    href={href}
                    onClick={() => {
                      if (hasDashboardSubtabs) {
                        setIsDashboardExpanded(true);
                      }
                      if (tab.name === 'reports') {
                        setIsReportsExpanded(true);
                      }
                    }}
                    className={cn(
                      'group relative flex flex-1 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all',
                      isActive
                        ? 'gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)]/10 font-semibold text-[var(--accent-blue)] shadow-xs'
                        : 'font-medium text-[var(--text-heading)] hover:bg-white/75 hover:text-[var(--accent-blue)]'
                    )}
                  >
                    {isActive && (
                      <m.div
                        layoutId="active-sidebar-tab"
                        className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--accent-blue)]"
                      />
                    )}
                    {Icon && (
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors',
                          isActive
                            ? 'border-[var(--accent-blue)]/35 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                            : 'border-black/[0.06] bg-white/75 text-[var(--text-heading)] group-hover:border-[var(--accent-blue)]/30 group-hover:text-[var(--accent-blue)]'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                      </span>
                    )}
                    <span className="flex-1 truncate">{tab.label}</span>
                  </Link>
                  {hasDashboardSubtabs && (
                    <button
                      type="button"
                      data-testid="dashboard-subtabs-toggle"
                      aria-label={
                        isDashboardExpanded
                          ? 'Collapse Dashboard sub-tabs'
                          : 'Expand Dashboard sub-tabs'
                      }
                      aria-expanded={isDashboardExpanded}
                      onClick={() => setIsDashboardExpanded((prev) => !prev)}
                      className={cn(
                        'shrink-0 cursor-pointer rounded-md p-1.5 transition-colors',
                        isRouteMatch
                          ? 'text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10'
                          : 'text-[var(--text-heading)] hover:bg-black/[0.04] hover:text-[var(--accent-blue)]'
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          isDashboardExpanded && 'rotate-90'
                        )}
                      />
                    </button>
                  )}
                  {tab.name === 'reports' && (
                    <button
                      type="button"
                      data-testid="reports-subtabs-toggle"
                      aria-label={
                        isReportsExpanded ? 'Collapse Reports sub-tabs' : 'Expand Reports sub-tabs'
                      }
                      aria-expanded={isReportsExpanded}
                      onClick={() => setIsReportsExpanded((prev) => !prev)}
                      className={cn(
                        'shrink-0 cursor-pointer rounded-md p-1.5 transition-colors',
                        isRouteMatch
                          ? 'text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10'
                          : 'text-[var(--text-heading)] hover:bg-black/[0.04] hover:text-[var(--accent-blue)]'
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          isReportsExpanded && 'rotate-90'
                        )}
                      />
                    </button>
                  )}
                </div>
                {hasDashboardSubtabs && isDashboardExpanded && (
                  <div
                    data-testid="dashboard-subtabs"
                    className="mt-0.5 ml-4 space-y-0.5 border-[var(--accent-blue)]/25 border-l-2 pl-4"
                  >
                    <Link
                      href={basePath}
                      data-testid="dashboard-subtab-scada"
                      className={cn(
                        SUBTAB_LINK_BASE,
                        isScadaDashboardSubtabActive
                          ? 'gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)]/10 font-semibold text-[var(--accent-blue)] shadow-2xs'
                          : 'font-medium text-[var(--text-heading)] hover:bg-white/75 hover:text-[var(--accent-blue)]'
                      )}
                    >
                      {isScadaDashboardSubtabActive && (
                        <m.div
                          layoutId="active-dashboard-subtab"
                          className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent-blue)]"
                        />
                      )}
                      <Activity
                        className={cn(
                          'h-3 w-3 shrink-0 transition-colors',
                          isScadaDashboardSubtabActive
                            ? 'text-[var(--accent-blue)]'
                            : 'text-[var(--text-heading)] group-hover:text-[var(--accent-blue)]'
                        )}
                      />
                      <span>SCADA Dashboard</span>
                    </Link>
                    <Link
                      href={`${basePath}/shift-compilation`}
                      data-testid="dashboard-subtab-shift-operations"
                      className={cn(
                        SUBTAB_LINK_BASE,
                        isShiftOperationsSubtabActive
                          ? 'gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)]/10 font-semibold text-[var(--accent-blue)] shadow-2xs'
                          : 'font-medium text-[var(--text-heading)] hover:bg-white/75 hover:text-[var(--accent-blue)]'
                      )}
                    >
                      {isShiftOperationsSubtabActive && (
                        <m.div
                          layoutId="active-dashboard-subtab"
                          className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent-blue)]"
                        />
                      )}
                      <ClipboardCheck
                        className={cn(
                          'h-3 w-3 shrink-0 transition-colors',
                          isShiftOperationsSubtabActive
                            ? 'text-[var(--accent-blue)]'
                            : 'text-[var(--text-heading)] group-hover:text-[var(--accent-blue)]'
                        )}
                      />
                      <span>Shift Operations</span>
                    </Link>
                  </div>
                )}
                {tab.name === 'reports' && isReportsExpanded && (
                  <div
                    data-testid="reports-subtabs"
                    className="mt-0.5 ml-4 space-y-0.5 border-[var(--accent-blue)]/25 border-l-2 pl-4"
                  >
                    <Link
                      href={`${basePath}/reports`}
                      data-testid="reports-subtab-dashboard"
                      className={cn(
                        SUBTAB_LINK_BASE,
                        isReportsDashboardActive
                          ? 'gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)]/10 font-semibold text-[var(--accent-blue)] shadow-2xs'
                          : 'font-medium text-[var(--text-heading)] hover:bg-white/75 hover:text-[var(--accent-blue)]'
                      )}
                    >
                      {isReportsDashboardActive && (
                        <m.div
                          layoutId="active-sidebar-subtab"
                          className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent-blue)]"
                        />
                      )}
                      <BarChart3
                        className={cn(
                          'h-3 w-3 shrink-0 transition-colors',
                          isReportsDashboardActive
                            ? 'text-[var(--accent-blue)]'
                            : 'text-[var(--text-heading)] group-hover:text-[var(--accent-blue)]'
                        )}
                      />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      href={`${basePath}/reports?tab=pdf-report`}
                      data-testid="reports-subtab-pdf-report"
                      className={cn(
                        SUBTAB_LINK_BASE,
                        isPdfReportActive
                          ? 'gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)]/10 font-semibold text-[var(--accent-blue)] shadow-2xs'
                          : 'font-medium text-[var(--text-heading)] hover:bg-white/75 hover:text-[var(--accent-blue)]'
                      )}
                    >
                      {isPdfReportActive && (
                        <m.div
                          layoutId="active-sidebar-subtab"
                          className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent-blue)]"
                        />
                      )}
                      <FileText
                        className={cn(
                          'h-3 w-3 shrink-0 transition-colors',
                          isPdfReportActive
                            ? 'text-[var(--accent-blue)]'
                            : 'text-[var(--text-heading)] group-hover:text-[var(--accent-blue)]'
                        )}
                      />
                      <span>PDF Report</span>
                    </Link>
                    <Link
                      href={`${basePath}/reports?tab=whatsapp-report`}
                      data-testid="reports-subtab-whatsapp-report"
                      className={cn(
                        SUBTAB_LINK_BASE,
                        isWhatsappReportActive
                          ? 'gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)]/10 font-semibold text-[var(--accent-blue)] shadow-2xs'
                          : 'font-medium text-[var(--text-heading)] hover:bg-white/75 hover:text-[var(--accent-blue)]'
                      )}
                    >
                      {isWhatsappReportActive && (
                        <m.div
                          layoutId="active-sidebar-subtab"
                          className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent-blue)]"
                        />
                      )}
                      <MessageSquare
                        className={cn(
                          'h-3 w-3 shrink-0 transition-colors',
                          isWhatsappReportActive
                            ? 'text-[var(--accent-blue)]'
                            : 'text-[var(--text-heading)] group-hover:text-[var(--accent-blue)]'
                        )}
                      />
                      <span>WhatsApp Report</span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom status strip */}
        <div
          className={cn(
            'flex items-center justify-between gap-2 border-black/[0.06] border-t p-3 transition-opacity duration-200',
            isPinned || isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <div className="gold-steel-border gold-steel-border-slim flex flex-1 items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-green)]" />
              <span className="font-semibold text-[11px] text-[var(--text-heading)] tracking-wide">
                Connection Secure
              </span>
            </div>
            <span className="rounded-full bg-[var(--accent-green)]/12 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-[var(--accent-green)] uppercase">
              Live
            </span>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main
        aria-label={`${department.displayName} content`}
        className={cn(
          'h-full flex-1 overflow-auto p-lg transition-all duration-300',
          isPinned ? 'pl-64' : 'pl-12',
          'max-md:pl-4'
        )}
      >
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </m.div>
      </main>
    </div>
  );
}
