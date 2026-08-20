import { Suspense } from "react";
import { AuditReportsSection } from "./AuditReportsSection";
import { GlassCard } from "@repo/ui/GlassCard";
import { ShieldCheck, Layers, Building2 } from "lucide-react";
import Link from "next/link";
import { DEPARTMENTS } from "@repo/departments/data-access";

export const metadata = {
  title: "System Overview & Audit Reports | Arch Systems Operations",
  description: "Centralized system architecture topology, audit compliance reports, and database safety status.",
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab || "audit";

  return (
    <div className="space-y-8 animate-fade-up max-w-[1600px] mx-auto pb-12">
      {/* Top Hero Banner */}
      <section className="relative overflow-hidden rounded-xl p-6 sm:p-8 bg-gradient-to-r from-arch-surface-secondary/90 via-white/80 to-arch-surface-tertiary/90 border border-arch-border-subtle shadow-card">
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-semibold tracking-wide border border-accent-blue/20">
              System Operations & Topology
            </span>
            <span className="text-xs font-mono text-arch-text-tertiary">
              ARCH-SYSTEMS v2.4.1
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-arch-text-primary">
            System Overview & Audit Compliance
          </h1>
          <p className="text-sm text-arch-text-secondary leading-relaxed">
            Real-time visualizer for Arch Systems mining operations portal. Access automated code audit logs,
            Row Level Security (RLS) policies, OKLCH design system compliance, and department metrics.
          </p>
        </div>
      </section>

      {/* Main Tabs Header */}
      <div className="flex flex-wrap gap-2 border-b border-arch-border-subtle pb-3">
        <Link
          href="/overview?tab=audit"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "audit"
              ? "bg-accent-blue text-white shadow-card"
              : "bg-arch-surface-secondary/70 text-arch-text-secondary hover:text-arch-text-primary hover:bg-arch-surface-tertiary"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Reports & Logs</span>
        </Link>

        <Link
          href="/overview?tab=departments"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "departments"
              ? "bg-accent-blue text-white shadow-card"
              : "bg-arch-surface-secondary/70 text-arch-text-secondary hover:text-arch-text-primary hover:bg-arch-surface-tertiary"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Department Directory</span>
        </Link>

        <Link
          href="/overview?tab=architecture"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "architecture"
              ? "bg-accent-blue text-white shadow-card"
              : "bg-arch-surface-secondary/70 text-arch-text-secondary hover:text-arch-text-primary hover:bg-arch-surface-tertiary"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Architecture & Stack</span>
        </Link>
      </div>

      {/* Main Content Area */}
      {activeTab === "audit" && (
        <Suspense fallback={<div className="h-96 animate-pulse bg-arch-surface-tertiary rounded-xl" />}>
          <AuditReportsSection />
        </Suspense>
      )}

      {activeTab === "departments" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEPARTMENTS.map((dept) => (
              <GlassCard key={dept.name} variant="default" className="p-5 space-y-3 bg-white/70 border-arch-border-subtle shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-arch-text-primary flex items-center gap-2">
                    {dept.displayName}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue font-mono">
                    {dept.route}
                  </span>
                </div>
                <p className="text-xs text-arch-text-secondary">{dept.description}</p>
                {dept.stats && (
                  <div className="pt-2 border-t border-arch-border-subtle flex justify-between text-xs text-arch-text-tertiary">
                    <span>{dept.stats.label}</span>
                    <span className="font-mono font-bold text-arch-text-primary">{dept.stats.value}</span>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {activeTab === "architecture" && (
        <GlassCard variant="default" className="p-8 space-y-6 bg-white/70 border-arch-border-subtle shadow-card">
          <h2 className="text-xl font-bold text-arch-text-primary">System Architecture & Tech Stack</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-arch-surface-secondary/60 border border-arch-border-subtle space-y-2">
              <h3 className="font-bold text-sm text-arch-text-primary">Frontend Portal</h3>
              <p className="text-xs text-arch-text-secondary">Next.js 16 (App Router), React 19, Tailwind CSS OKLCH design system.</p>
            </div>
            <div className="p-4 rounded-xl bg-arch-surface-secondary/60 border border-arch-border-subtle space-y-2">
              <h3 className="font-bold text-sm text-arch-text-primary">Database & Auth</h3>
              <p className="text-xs text-arch-text-secondary">PostgreSQL via Supabase with mandatory Row Level Security (RLS) policies.</p>
            </div>
            <div className="p-4 rounded-xl bg-arch-surface-secondary/60 border border-arch-border-subtle space-y-2">
              <h3 className="font-bold text-sm text-arch-text-primary">Caching & Queue</h3>
              <p className="text-xs text-arch-text-secondary">Redis Cluster for department slug caching, rate limiting & telemetry metrics.</p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
