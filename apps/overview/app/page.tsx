"use client";

import { useState, Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Logo } from "@repo/ui/Logo";
import {
  Network,
  Building2,
  Layers,
  Database,
  Server,
  BookOpen,
  ShieldCheck,
  Bot,
} from "lucide-react";

// Lazy load sections for better performance
const SystemArchitecture = lazy(() => import("./sections/SystemArchitecture"));
const BackendArchitecture = lazy(() => import("./sections/BackendArchitecture"));
const DepartmentBreakdown = lazy(() => import("./sections/DepartmentBreakdown"));
const TechStack = lazy(() => import("./sections/TechStack"));
const DatabaseSchema = lazy(() => import("./sections/DatabaseSchema"));
const DocumentationMaps = lazy(() => import("./sections/DocumentationMaps"));
const AgenticMonitor = lazy(() => import("./sections/AgenticMonitor"));
const AuditReportsSection = lazy(() => import("./sections/AuditReportsSection"));

// Loading fallback
function SectionLoader() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-200px)] min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
        <span className="text-[var(--text-secondary)] text-sm">Loading...</span>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState("architecture");

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header with Official Arch Systems Branding */}
      <header className="border-b border-[var(--border-subtle)] bg-white/70 backdrop-blur-xl sticky top-0 z-50 shadow-card">
        <div className="max-w-[1600px] mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-8 text-[var(--accent-blue)]" />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[var(--text-heading)] flex items-center gap-2">
                  Arch Systems
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-accent-blue/10 text-[var(--accent-blue)] border border-accent-blue/20">
                    Overview Portal
                  </span>
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">
                  Opencast Coal Mine Operations Portal — System Architecture & Topology
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
              <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                Next.js 16
              </span>
              <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                Supabase
              </span>
              <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                Redis Cluster
              </span>
              <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                9 Departments
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-bg-secondary border border-default p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="architecture"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:text-accent-green"
            >
              <Network className="w-4 h-4" />
              <span className="hidden sm:inline">System Architecture</span>
              <span className="sm:hidden">Architecture</span>
            </TabsTrigger>
            <TabsTrigger
              value="backend"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:text-accent-green"
            >
              <Server className="w-4 h-4" />
              <span className="hidden sm:inline">Backend Connections</span>
              <span className="sm:hidden">Backend Flow</span>
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:text-accent-green"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Department Breakdown</span>
              <span className="sm:hidden">Departments</span>
            </TabsTrigger>
            <TabsTrigger
              value="techstack"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:text-accent-green"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Tech Stack</span>
              <span className="sm:hidden">Tech</span>
            </TabsTrigger>
            <TabsTrigger
              value="database"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:text-accent-green"
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Database Schema</span>
              <span className="sm:hidden">Database</span>
            </TabsTrigger>
            <TabsTrigger
              value="docs"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:text-accent-green"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Docs & Maps</span>
              <span className="sm:hidden">Docs</span>
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:text-accent-green"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Audit & Compliance</span>
              <span className="sm:hidden">Audit</span>
            </TabsTrigger>
            <TabsTrigger
              value="agentic"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:text-accent-green"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">Agentic Monitor</span>
              <span className="sm:hidden">Agentic</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="audit" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <AuditReportsSection />
              </Suspense>
            </TabsContent>

            <TabsContent value="architecture" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <SystemArchitecture />
              </Suspense>
            </TabsContent>

            <TabsContent value="backend" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <BackendArchitecture />
              </Suspense>
            </TabsContent>

            <TabsContent value="departments" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <DepartmentBreakdown />
              </Suspense>
            </TabsContent>

            <TabsContent value="techstack" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <TechStack />
              </Suspense>
            </TabsContent>

            <TabsContent value="database" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <DatabaseSchema />
              </Suspense>
            </TabsContent>

            <TabsContent value="docs" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <DocumentationMaps />
              </Suspense>
            </TabsContent>

            <TabsContent value="agentic" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <AgenticMonitor />
              </Suspense>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t border-default mt-12">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-text-muted">
            <div>
              Arch Systems — Multi-departmental business portal for opencast coal mine operations
            </div>
            <div className="flex items-center gap-4">
              <span>Built with Next.js 16 + React 19 + Supabase + Nx + Payload CMS v3</span>
              <span className="text-accent-green">Visualizer v2.0</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
