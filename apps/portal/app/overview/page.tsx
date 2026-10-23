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
    <div className="flex items-center justify-center h-[calc(100vh-200px)] min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
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
    setIsOpen(true);
  }, []);

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPinned) return;
      if (e.clientX <= 36) {
        openSidebar();
      }
    },
    [isPinned, openSidebar]
  );

  const activeNavMeta =
    OVERVIEW_NAV_ITEMS.find((item) => item.value === activeTab) ?? OVERVIEW_NAV_ITEMS[0];

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      orientation="vertical"
      className="flex min-h-[calc(100vh-28px)] relative w-full"
      onMouseMove={handleContainerMouseMove}
    >
      {/* Left Edge Hover Trigger Zone when Sidebar is Unpinned */}
      <div
        className={`fixed left-0 top-7 bottom-0 w-6 z-30 ${
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
        className="fixed bottom-4 left-4 z-50 md:hidden p-2.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg text-[var(--text-heading)] hover:bg-[var(--bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
      >
        <Menu className="w-5 h-5" />
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
        className={`fixed md:sticky left-0 top-0 h-[calc(100vh-28px)] z-40 w-64 shrink-0 border-r border-black/[0.08] bg-white/85 backdrop-blur-xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-xl gold-steel-border gold-steel-border-slim ${
          isPinned || isOpen
            ? 'translate-x-0'
            : '-translate-x-[calc(100%-12px)] md:w-3 md:overflow-hidden'
        }`}
      >
        {/* Collapsed Hint */}
        <div
          className={`absolute top-1/2 right-0 -translate-y-1/2 translate-x-full w-4 h-12 flex items-center justify-center transition-opacity pointer-events-none ${
            isPinned || isOpen ? 'opacity-0' : 'opacity-60'
          }`}
        >
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </div>

        {/* macOS Title Bar matching DepartmentLayout */}
        <MacTitleBar title="System Overview" className="bg-white/40" />

        {/* Back to Hub & Pin Sidebar Controls */}
        <div className="px-3 pt-3.5 pb-1.5 flex items-center justify-between">
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
              title={isPinned ? 'Unpin sidebar (auto-collapse)' : 'Pin sidebar (always open)'}
              className="p-1.5 rounded hover:bg-black/5 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
            >
              <Pin
                className={`w-3.5 h-3.5 transition-transform ${
                  isPinned ? 'rotate-45 text-[var(--accent-blue)]' : ''
                }`}
              />
            </button>
            <Logo className="w-4 h-4 opacity-60 mr-1" />
          </div>
        </div>

        {/* Department Header Badge */}
        <div className="px-4 py-2 flex items-center gap-2.5 border-b border-black/[0.05]">
          <div className="p-1.5 rounded-lg bg-accent-blue/10 text-[var(--accent-blue)]">
            <Network className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--text-heading)] uppercase tracking-wider truncate">
              Architecture & Ops
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
              8 Modules · 189 Migrations
            </div>
          </div>
        </div>

        {/* Vertical Side Panel Navigation TabsList */}
        <div className="flex-1 px-2.5 py-3 overflow-y-auto">
          <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            Topology & Audit Views
          </div>
          <TabsList
            aria-label="System Overview Sections"
            className="flex flex-col items-stretch justify-start bg-transparent border-0 p-0 h-auto gap-1 w-full"
          >
            {OVERVIEW_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all relative group cursor-pointer data-[state=active]:bg-[var(--accent-blue)]/10 data-[state=active]:text-[var(--accent-blue)] data-[state=active]:font-semibold data-[state=active]:shadow-none ${
                    isActive
                      ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-semibold gold-steel-border gold-steel-border-slim'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-black/[0.04]'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-[var(--accent-blue)]"
                    />
                  )}
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[var(--accent-blue)]'
                          : 'text-[var(--text-muted)] group-hover:text-[var(--text-body)]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      isActive
                        ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-semibold'
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
        <div className="p-3 border-t border-black/[0.06] flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/20 gold-steel-border gold-steel-border-slim">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
              <span className="text-[11px] text-[var(--text-heading)] font-medium tracking-wide">
                Connection Secure
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 font-semibold">RLS 100%</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area beside Department Side Panel */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 py-5 space-y-6 animate-fade-up max-w-[1600px] mx-auto pb-12">
        {/* Header with Official Arch Systems Branding, Full Stack SVG Icons & Visual Provenance Graphs */}
        <header className="rounded-xl border border-[var(--border-subtle)] bg-white/80 backdrop-blur-xl p-5 shadow-card space-y-4 gold-steel-border gold-steel-border-slim">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo className="w-9 h-9 text-[var(--accent-blue)] shrink-0" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-heading)] flex flex-wrap items-center gap-2">
                  <span>Arch Systems</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-accent-blue/10 text-[var(--accent-blue)] border border-accent-blue/20">
                    System Architecture & Operations Topology
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    Active View: {activeNavMeta.label}
                  </span>
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
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
