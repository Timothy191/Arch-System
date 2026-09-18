import { Logo } from "@repo/ui/Logo";
import { Suspense } from "react";
import { OverviewTabsClient } from "./OverviewTabsClient";
import AgenticMonitor from "./sections/AgenticMonitor";
import AuditReportsSection from "./sections/AuditReportsSection";
import BackendArchitecture from "./sections/BackendArchitecture";
import DatabaseSchema from "./sections/DatabaseSchema";
import DepartmentBreakdown from "./sections/DepartmentBreakdown";
import DocumentationMaps from "./sections/DocumentationMaps";
import SystemArchitecture from "./sections/SystemArchitecture";
import TechStack from "./sections/TechStack";

const VALID_TABS = [
  "architecture",
  "backend",
  "departments",
  "techstack",
  "database",
  "docs",
  "audit",
  "agentic",
] as const;
export type OverviewTab = (typeof VALID_TABS)[number];

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

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolved = (await searchParams) || {};
  const rawTab = resolved.tab;
  const activeTab: OverviewTab =
    typeof rawTab === "string" && (VALID_TABS as readonly string[]).includes(rawTab)
      ? (rawTab as OverviewTab)
      : "architecture";

  return (
    <div className="space-y-6 animate-fade-up max-w-[1600px] mx-auto pb-12">
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
                Opencast Coal Mine Operations Portal — Interactive React Flow Topology & Audit
                Intelligence
              </p>
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={<SectionLoader />}>
        <OverviewTabsClient activeTab={activeTab}>
          {activeTab === "architecture" && <SystemArchitecture />}
          {activeTab === "backend" && <BackendArchitecture />}
          {activeTab === "departments" && <DepartmentBreakdown />}
          {activeTab === "techstack" && <TechStack />}
          {activeTab === "database" && <DatabaseSchema />}
          {activeTab === "docs" && <DocumentationMaps />}
          {activeTab === "audit" && <AuditReportsSection />}
          {activeTab === "agentic" && <AgenticMonitor />}
        </OverviewTabsClient>
      </Suspense>
    </div>
  );
}
