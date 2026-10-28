'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Logo } from '@repo/ui/Logo';
import { MacTitleBar } from '@repo/ui/MacTitleBar';
import {
  BookOpen,
  Bot,
  Building2,
  ChevronRight,
  Database,
  Layers,
  Menu,
  Network,
  Pin,
  Server,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { GitHubProvenanceVisualGraphs, OverviewStackIconsStrip } from './OverviewHeaderVisuals';

// Lazy load sections for better performance
const SystemArchitecture = lazy(() => import('./sections/SystemArchitecture'));
const BackendArchitecture = lazy(() => import('./sections/BackendArchitecture'));
const DepartmentBreakdown = lazy(() => import('./sections/DepartmentBreakdown'));
const TechStack = lazy(() => import('./sections/TechStack'));
const DatabaseSchema = lazy(() => import('./sections/DatabaseSchema'));
const DocumentationMaps = lazy(() => import('./sections/DocumentationMaps'));
const AgenticMonitor = lazy(() => import('./sections/AgenticMonitor'));
const AuditReportsSection = lazy(() => import('./sections/AuditReportsSection'));

const OVERVIEW_NAV_ITEMS = [
  {
    value: 'architecture',
    label: 'System Architecture',
    badge: 'n8n + Flow',
    icon: Network,
  },
  {
    value: 'backend',
    label: 'Backend Topology',
    badge: '12 Nodes',
    icon: Server,
  },
  {
    value: 'departments',
    label: 'Departments',
    badge: '8 Modules',
    icon: Building2,
  },
  {
    value: 'techstack',
    label: 'Tech Stack',
    badge: '13 Specs',
    icon: Layers,
  },
  {
    value: 'database',
    label: 'Database Schema',
    badge: '189 SQL',
    icon: Database,
  },
  {
    value: 'docs',
    label: 'Docs & Maps',
    badge: 'Codemaps',
    icon: BookOpen,
  },
  {
    value: 'audit',
    label: 'Audit & Compliance',
    badge: 'RLS + ISO',
    icon: ShieldCheck,
  },
  {
    value: 'agentic',
    label: 'Agentic Monitor',
    badge: 'AI Mesh',
    icon: Bot,
  },
] as const;

function SectionLoader() {
  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-blue)] border-t-transparent" />
        <span className="text-[var(--text-secondary)] text-sm">Loading visualizer...</span>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState('architecture');
  const [isOpen, setIsOpen] = useState(true);
  const [isPinned, setIsPinned] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      if (next) {
        setIsOpen(true);
      }
      return next;
    });
  }, []);

  const openSidebar = useCallback(() => {
    setIsOpen((prev) => (prev ? prev : true));
  }, []);

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPinned || isOpen) return;
      if (e.clientX <= 36) {
        openSidebar();
      }
    },
    [isPinned, isOpen, openSidebar]
  );

  const activeNavMeta =
    OVERVIEW_NAV_ITEMS.find((item) => item.value === activeTab) ?? OVERVIEW_NAV_ITEMS[0];

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      orientation="vertical"
      className="relative flex min-h-[calc(100vh-28px)] w-full"
      onMouseMove={handleContainerMouseMove}
    >
      {/* Left Edge Hover Trigger Zone when Sidebar is Unpinned */}
      <div
        className={`fixed top-7 bottom-0 left-0 z-30 w-6 ${
          isPinned ? 'pointer-events-none' : 'cursor-pointer'
        }`}
        onMouseEnter={openSidebar}
        onClick={openSidebar}
        aria-hidden="true"
        data-testid="overview-edge-trigger"
      />

      {/* Mobile Sidebar Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle overview navigation"
        className="fixed bottom-4 left-4 z-50 rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] p-2.5 text-[var(--text-heading)] shadow-lg hover:bg-[var(--bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Department-Style Left Side Panel Navigation */}
      <aside
        ref={sidebarRef}
        data-testid="overview-sidebar"
        aria-label="System Overview Side Panel Navigation"
        onMouseEnter={openSidebar}
        onMouseLeave={() => {
          if (!isPinned) setIsOpen(false);
        }}
        className={`gold-steel-border gold-steel-border-slim fixed top-0 left-0 z-40 flex h-[calc(100vh-28px)] w-64 shrink-0 flex-col border-black/[0.08] border-r bg-white/85 shadow-xl backdrop-blur-xl transition-all duration-300 ease-mac-decelerate md:sticky ${
          isPinned || isOpen
            ? 'translate-x-0'
            : '-translate-x-[calc(100%-12px)] md:w-3 md:overflow-hidden'
        }`}
      >
        {/* Collapsed Hint */}
        <div
          className={`pointer-events-none absolute top-1/2 right-0 flex h-12 w-4 translate-x-full -translate-y-1/2 items-center justify-center transition-opacity ${
            isPinned || isOpen ? 'opacity-0' : 'opacity-60'
          }`}
        >
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
        </div>

        {/* macOS Title Bar matching DepartmentLayout */}
        <MacTitleBar title="System Overview" className="bg-white/40" />

        {/* Back to Hub & Pin Sidebar Controls */}
        <div className="flex items-center justify-between px-3 pt-3.5 pb-1.5">
          <Link
            href="/"
            className="group flex items-center gap-1.5 rounded px-2 py-1 font-medium text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-blue)]"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-0.5">‹</span>
            <span>Back to Hub</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={togglePin}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              title={isPinned ? 'Unpin sidebar (auto-collapse)' : 'Pin sidebar (always open)'}
              className="cursor-pointer rounded p-1.5 text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text-heading)]"
            >
              <Pin
                className={`h-3.5 w-3.5 transition-transform ${
                  isPinned ? 'rotate-45 text-[var(--accent-blue)]' : ''
                }`}
              />
            </button>
            <Logo className="mr-1 h-4 w-4 opacity-60" />
          </div>
        </div>

        {/* Department Header Badge */}
        <div className="flex items-center gap-2.5 border-black/[0.05] border-b px-4 py-2">
          <div className="rounded-lg bg-accent-blue/10 p-1.5 text-[var(--accent-blue)]">
            <Network className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-[11px] text-[var(--text-heading)] uppercase tracking-wider">
              Architecture & Ops
            </div>
            <div className="truncate font-mono text-[10px] text-[var(--text-muted)]">
              8 Modules · 189 Migrations
            </div>
          </div>
        </div>

        {/* Vertical Side Panel Navigation TabsList */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3">
          <div className="px-2 pb-1.5 font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Topology & Audit Views
          </div>
          <TabsList
            aria-label="System Overview Sections"
            className="flex h-auto w-full flex-col items-stretch justify-start gap-1 border-0 bg-transparent p-0"
          >
            {OVERVIEW_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className={`group relative flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all data-[state=active]:bg-[var(--accent-blue)]/10 data-[state=active]:font-semibold data-[state=active]:text-[var(--accent-blue)] data-[state=active]:shadow-none ${
                    isActive
                      ? 'gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)]/10 font-semibold text-[var(--accent-blue)]'
                      : 'text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--accent-blue)]"
                    />
                  )}
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[var(--accent-blue)]'
                          : 'text-[var(--text-muted)] group-hover:text-[var(--text-body)]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] ${
                      isActive
                        ? 'bg-[var(--accent-blue)]/15 font-semibold text-[var(--accent-blue)]'
                        : 'bg-black/[0.04] text-[var(--text-muted)]'
                    }`}
                  >
                    {item.badge}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Bottom Status Strip matching DepartmentLayout */}
        <div className="flex flex-col gap-1.5 border-black/[0.06] border-t p-3">
          <div className="gold-steel-border gold-steel-border-slim flex items-center justify-between rounded-md border border-[var(--accent-green)]/20 bg-[var(--accent-green)]/10 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-green)]" />
              <span className="font-medium text-[11px] text-[var(--text-heading)] tracking-wide">
                Connection Secure
              </span>
            </div>
            <span className="font-mono font-semibold text-[10px] text-emerald-700">RLS 100%</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area beside Department Side Panel */}
      <div className="mx-auto min-w-0 max-w-[1600px] flex-1 animate-fade-up space-y-6 px-4 py-5 pb-12 sm:px-6">
        {/* Header with Official Arch Systems Branding, Full Stack SVG Icons & Visual Provenance Graphs */}
        <header className="gold-steel-border gold-steel-border-slim space-y-4 rounded-xl border border-[var(--border-subtle)] bg-white/80 p-5 shadow-card backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Logo className="h-9 w-9 shrink-0 text-[var(--accent-blue)]" />
              <div>
                <h1 className="flex flex-wrap items-center gap-2 font-bold text-[var(--text-heading)] text-xl tracking-tight">
                  <span>Arch Systems</span>
                  <span className="rounded-full border border-accent-blue/20 bg-accent-blue/10 px-2.5 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                    System Architecture & Operations Topology
                  </span>
                  <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                    Active View: {activeNavMeta.label}
                  </span>
                </h1>
                <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                  Opencast Coal Mine Operations Portal — Interactive Block-and-Line Flow Diagrams,
                  n8n Node Canvas & Audit Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Item 5: Visual SVG Illustrators for All Codebase Stack Technologies */}
          <OverviewStackIconsStrip />

          {/* Item 4: Visual Engineering Velocity & GitHub Provenance Graphs */}
          <GitHubProvenanceVisualGraphs />
        </header>

        {/* Active Section Viewport */}
        <div className="min-w-0">
          <TabsContent value="architecture" className="m-0 focus-visible:outline-none">
            <Suspense fallback={<SectionLoader />}>
              <SystemArchitecture />
            </Suspense>
          </TabsContent>

          <TabsContent value="backend" className="m-0 focus-visible:outline-none">
            <Suspense fallback={<SectionLoader />}>
              <BackendArchitecture />
            </Suspense>
          </TabsContent>

          <TabsContent value="departments" className="m-0 focus-visible:outline-none">
            <Suspense fallback={<SectionLoader />}>
              <DepartmentBreakdown />
            </Suspense>
          </TabsContent>

          <TabsContent value="techstack" className="m-0 focus-visible:outline-none">
            <Suspense fallback={<SectionLoader />}>
              <TechStack />
            </Suspense>
          </TabsContent>

          <TabsContent value="database" className="m-0 focus-visible:outline-none">
            <Suspense fallback={<SectionLoader />}>
              <DatabaseSchema />
            </Suspense>
          </TabsContent>

          <TabsContent value="docs" className="m-0 focus-visible:outline-none">
            <Suspense fallback={<SectionLoader />}>
              <DocumentationMaps />
            </Suspense>
          </TabsContent>

          <TabsContent value="audit" className="m-0 focus-visible:outline-none">
            <Suspense fallback={<SectionLoader />}>
              <AuditReportsSection />
            </Suspense>
          </TabsContent>

          <TabsContent value="agentic" className="m-0 focus-visible:outline-none">
            <Suspense fallback={<SectionLoader />}>
              <AgenticMonitor />
            </Suspense>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
