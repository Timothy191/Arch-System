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
  const [activeTab, setActiveTab] = useState("architecture");

  return (
    <div className="space-y-6 animate-fade-up max-w-[1600px] mx-auto pb-12">
      {/* Header with Official Arch Systems Branding */}
      <header className="rounded-xl border border-[var(--border-subtle)] bg-white/70 backdrop-blur-xl p-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="w-9 h-9 text-[var(--accent-blue)]" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-heading)] flex items-center gap-2">
                Arch Systems
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-accent-blue/10 text-[var(--accent-blue)] border border-accent-blue/20">
                  System Architecture & Operations Topology
                </span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Opencast Coal Mine Operations Portal — Interactive React Flow Topology & Audit Intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
            <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              Next.js 16
            </span>
            <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              Supabase RLS
            </span>
            <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              Redis Cluster
            </span>
            <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              8 Specialist Agents
            </span>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-1 h-auto flex flex-wrap gap-1 rounded-lg">
          <TabsTrigger
            value="architecture"
            className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
          >
            <Network className="w-3.5 h-3.5" />
            <span>System Architecture</span>
          </TabsTrigger>
          <TabsTrigger
            value="backend"
            className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Backend Topology</span>
          </TabsTrigger>
          <TabsTrigger
            value="departments"
            className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Departments</span>
          </TabsTrigger>
          <TabsTrigger
            value="techstack"
            className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tech Stack</span>
          </TabsTrigger>
          <TabsTrigger
            value="database"
            className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database Schema</span>
          </TabsTrigger>
          <TabsTrigger
            value="docs"
            className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Docs & Maps</span>
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit & Compliance</span>
          </TabsTrigger>
          <TabsTrigger
            value="agentic"
            className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Agentic Monitor</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
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
      </Tabs>
    </div>
  );
}
