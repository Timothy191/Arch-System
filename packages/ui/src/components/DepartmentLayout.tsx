'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckSquare,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  Cpu,
  CreditCard,
  Database,
  Factory,
  FileText,
  GitCommit,
  GraduationCap,
  HardHat,
  Layers,
  LifeBuoy,
  Monitor,
  Pickaxe,
  Printer,
  QrCode,
  Radio,
  Satellite,
  Search,
  Settings,
  ShieldCheck,
  Undo2,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  Satellite,
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
  HardHat,
  GraduationCap,
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
  const basePath = `/${department.name}`;
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const openSidebar = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const closeSidebarWithDelay = useCallback((delayMs = 450) => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = setTimeout(() => {
      // Keep open if user currently has focus inside sidebar
      if (!sidebarRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
      }
    }, delayMs);
  }, []);

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
      // If cursor is close enough to the left edge (within 36px), auto-reveal
      if (e.clientX <= 36) {
        openSidebar();
      }
    },
    [openSidebar]
  );

  return (
    <div className="flex h-[calc(100vh-28px)] relative" onMouseMove={handleContainerMouseMove}>
      {/* Invisible hover / proximity trigger zone at the far left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-12 z-40 cursor-pointer"
        onMouseEnter={openSidebar}
        onMouseMove={openSidebar}
        aria-hidden="true"
      />

      {/* macOS Sidebar — Auto-hide/reveal style with proximity reveal and delayed auto-collapse */}
      <aside
        ref={sidebarRef}
        className={cn(
          'absolute left-0 top-0 bottom-0 z-50 w-60 shrink-0 border-r border-black/[0.08] bg-[var(--vibrancy-surface)] backdrop-blur-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group/sidebar shadow-2xl',
          isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-12px)]'
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
            isOpen ? 'opacity-0' : 'opacity-50'
          )}
        >
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </div>

        {/* MacTitleBar with department name */}
        <MacTitleBar title={department.displayName} />

        {/* Back to Hub link */}
        <div
          className={cn(
            'px-3 pt-3 pb-1 flex items-center justify-between transition-opacity duration-200',
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors group px-2 py-1 rounded"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform text-sm">‹</span>
            <span>Back to Hub</span>
          </Link>
          <Logo className="w-4 h-4 opacity-60 mr-2" />
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
              department.color === 'red' && 'bg-dept-control-room/10 text-dept-control-room'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
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
            const isActive =
              pathname === href || (tab.name === 'dashboard' && pathname === basePath);
            const Icon = ICON_MAP[tab.icon];
            return (
              <Link
                key={tab.name}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all relative group',
                  isActive
                    ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-black/[0.04]'
                )}
              >
                {isActive && (
                  <motion.div
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
                {tab.label}
              </Link>
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
          <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--accent-green)]/8 border border-[var(--accent-green)]/15">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
            <span className="text-[11px] text-[var(--text-muted)] font-medium tracking-wide">
              Connection Secure
            </span>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 h-full overflow-auto p-6 pl-12 transition-all duration-300">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
