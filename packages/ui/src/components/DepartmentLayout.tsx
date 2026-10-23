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

export function DepartmentLayout({ department, tabs, children }: DepartmentLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams?.() ?? null;
  const activeTabParam = searchParams?.get?.('tab') ?? null;
  const basePath = `/${department.name}`;
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
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
    setIsOpen(true);
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
      if (isPinned) return;
      // If cursor is close enough to the left edge (within 36px), auto-reveal
      if (e.clientX <= 36) {
        openSidebar();
      }
    },
    [isPinned, openSidebar]
  );

  return (
    <div className="flex h-[calc(100vh-28px)] relative" onMouseMove={handleContainerMouseMove}>
      {/* Hover / proximity trigger zone at the far left (disabled when pinned) */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-12 z-40',
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
        className="fixed bottom-4 left-4 z-50 md:hidden p-2.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg text-[var(--text-heading)] hover:bg-[var(--bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile backdrop overlay */}
      {isOpen && !isPinned && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* macOS Sidebar — Auto-hide/reveal style with proximity reveal, delayed collapse, and manual pin */}
      <aside
        ref={sidebarRef}
        className={cn(
          'absolute left-0 top-0 bottom-0 z-50 w-60 shrink-0 border-r border-black/[0.08] bg-[var(--vibrancy-surface)] backdrop-blur-xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group/sidebar shadow-2xl gold-steel-border gold-steel-border-slim',
          isPinned || isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-12px)]'
        )}
        style={{ borderRight: '1px solid rgba(0,0,0,0.07)' }}
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
            'absolute top-1/2 right-0 -translate-y-1/2 translate-x-full w-4 h-12 flex items-center justify-center transition-opacity pointer-events-none',
            isPinned || isOpen ? 'opacity-0' : 'opacity-50'
          )}
        >
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </div>

        {/* MacTitleBar with department name */}
        <MacTitleBar title={department.displayName} className="bg-white/25" />

        {/* Back to Hub link & Pin toggle */}
        <div
          className={cn(
            'px-3 pt-3.5 pb-1.5 flex items-center justify-between transition-opacity duration-200',
            isPinned || isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors group px-2 py-1 rounded"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform text-sm">‹</span>
            <span>Back to Hub</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={togglePin}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              className="p-1.5 rounded hover:bg-black/5 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
              title={isPinned ? 'Unpin sidebar (auto-collapse)' : 'Pin sidebar (always open)'}
            >
              <Pin
                className={cn(
                  'w-3.5 h-3.5 transition-transform',
                  isPinned ? 'rotate-45 text-[var(--accent-blue)]' : ''
                )}
              />
            </button>
            <Logo className="w-4 h-4 opacity-60 mr-1" />
          </div>
        </div>

        {/* Department icon + label */}
        <div
          className={cn(
            'px-4 py-2 flex items-center gap-2.5 transition-opacity duration-200',
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
        >
          <div
            className={cn(
              'p-1.5 rounded-lg',
              department.color === 'blue' && 'bg-dept-drilling/10 text-dept-drilling',
              department.color === 'emerald' && 'bg-dept-production/10 text-dept-production',
              department.color === 'violet' && 'bg-dept-engineering/10 text-dept-engineering',
              department.color === 'red' && 'bg-dept-control-room/10 text-dept-control-room',
              department.color === 'amber' && 'bg-accent-amber/10 text-accent-amber'
            )}
          >
            {(() => {
              const DeptIcon =
                ICON_MAP[department.icon] || getDepartmentIcon(department.name) || BarChart3;
              return <DeptIcon className="w-3.5 h-3.5" />;
            })()}
          </div>
          <span className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            {department.displayName}
          </span>
        </div>

        {/* Navigation items */}
        <nav
          className={cn(
            'flex-1 px-2 pb-2 space-y-0.5 overflow-y-auto transition-opacity duration-200',
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
        >
          {tabs.map((tab) => {
            const href = tab.name === 'dashboard' ? basePath : `${basePath}/${tab.name}`;
            const isShiftOperationsActive =
              tab.name === 'shift-compilation' &&
              (pathname === `${basePath}/shift-compilation` ||
                pathname === `${basePath}/shift-coverage` ||
                pathname === `${basePath}/shift-closeout`);
            const isRouteMatch =
              pathname === href ||
              (tab.name === 'dashboard' && pathname === basePath) ||
              isShiftOperationsActive;
            const isPdfReportActive =
              tab.name === 'reports' && isRouteMatch && activeTabParam === 'pdf-report';
            const isReportsDashboardActive =
              tab.name === 'reports' && isRouteMatch && !isPdfReportActive;
            const isActive = isRouteMatch && !isPdfReportActive;
            const Icon = ICON_MAP[tab.icon];
            return (
              <div key={tab.name} className="space-y-0.5">
                <div className="flex items-center gap-0.5">
                  <Link
                    href={href}
                    onClick={() => {
                      if (tab.name === 'reports') {
                        setIsReportsExpanded(true);
                      }
                    }}
                    className={cn(
                      'flex-1 flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all relative group',
                      isActive
                        ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium gold-steel-border gold-steel-border-slim'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-black/[0.04]'
                    )}
                  >
                    {isActive && (
                      <m.div
                        layoutId="active-sidebar-tab"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-[var(--accent-blue)]"
                      />
                    )}
                    {Icon && (
                      <Icon
                        className={cn(
                          'w-3.5 h-3.5 shrink-0 transition-colors',
                          isActive
                            ? 'text-[var(--accent-blue)]'
                            : 'text-[var(--text-muted)] group-hover:text-[var(--text-body)]'
                        )}
                      />
                    )}
                    <span className="flex-1 truncate">{tab.label}</span>
                  </Link>
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
                        'p-1.5 rounded-md transition-colors cursor-pointer shrink-0',
                        isRouteMatch
                          ? 'text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-black/[0.04]'
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          'w-3.5 h-3.5 transition-transform duration-200',
                          isReportsExpanded && 'rotate-90'
                        )}
                      />
                    </button>
                  )}
                </div>
                {tab.name === 'reports' && isReportsExpanded && (
                  <div
                    data-testid="reports-subtabs"
                    className="pl-6 space-y-0.5 border-l border-black/[0.06] ml-4 mt-0.5"
                  >
                    <Link
                      href={`${basePath}/reports`}
                      data-testid="reports-subtab-dashboard"
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1 rounded-md text-[12px] transition-all relative group',
                        isReportsDashboardActive
                          ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-black/[0.04]'
                      )}
                    >
                      {isReportsDashboardActive && (
                        <m.div
                          layoutId="active-sidebar-subtab"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[var(--accent-blue)]"
                        />
                      )}
                      <BarChart3
                        className={cn(
                          'w-3 h-3 shrink-0 transition-colors',
                          isReportsDashboardActive
                            ? 'text-[var(--accent-blue)]'
                            : 'text-[var(--text-muted)] group-hover:text-[var(--text-body)]'
                        )}
                      />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      href={`${basePath}/reports?tab=pdf-report`}
                      data-testid="reports-subtab-pdf-report"
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1 rounded-md text-[12px] transition-all relative group',
                        isPdfReportActive
                          ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-black/[0.04]'
                      )}
                    >
                      {isPdfReportActive && (
                        <m.div
                          layoutId="active-sidebar-subtab"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[var(--accent-blue)]"
                        />
                      )}
                      <FileText
                        className={cn(
                          'w-3 h-3 shrink-0 transition-colors',
                          isPdfReportActive
                            ? 'text-[var(--accent-blue)]'
                            : 'text-[var(--text-muted)] group-hover:text-[var(--text-body)]'
                        )}
                      />
                      <span>PDF Report</span>
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
            'p-3 border-t border-black/[0.06] flex items-center justify-between gap-2 transition-opacity duration-200',
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--accent-green)]/8 border border-[var(--accent-green)]/15 gold-steel-border gold-steel-border-slim">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
            <span className="text-[11px] text-[var(--text-muted)] font-medium tracking-wide">
              Connection Secure
            </span>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main
        aria-label={`${department.displayName} content`}
        className={cn(
          'flex-1 h-full overflow-auto p-lg transition-all duration-300',
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
