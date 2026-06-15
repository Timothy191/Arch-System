"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, LogIn, LogOut, Search, Zap } from "lucide-react";
import type { Breakdown, BreakdownMetrics, Machine } from "./types";
import { BreakdownStats } from "./BreakdownStats";
import { BookInForm } from "./BookInForm";
import { BookOutForm } from "./BookOutForm";
import { BreakdownsTable } from "./BreakdownsTable";
import dynamic from "next/dynamic";

const BreakdownCharts = dynamic(
  () => import("./BreakdownCharts").then((m) => m.BreakdownCharts),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-xl" />
    ),
  },
);

type Tab = "overview" | "bookin" | "bookout" | "query";

interface BreakdownsDashboardProps {
  departmentId: string;
  breakdowns: Breakdown[];
  metrics: BreakdownMetrics;
  machines: Machine[];
}

export function BreakdownsDashboard({
  departmentId,
  breakdowns,
  metrics,
  machines,
}: BreakdownsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { id: "bookin" as const, label: "Book In", icon: LogIn },
    { id: "bookout" as const, label: "Book Out", icon: LogOut },
    { id: "query" as const, label: "Query Data", icon: Search },
  ];

  const activeBreakdowns = breakdowns.filter((b) => b.status === "active");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-heading)]">
            Breakdown Management
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">
            Track machine breakdowns, book-in/out and monitor fleet health.
          </p>
        </div>
        {activeBreakdowns.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-red/10 border border-accent-red/20">
            <Zap className="w-4 h-4 text-accent-red" />
            <span className="text-accent-red text-sm font-medium">
              {activeBreakdowns.length} Active
            </span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-[var(--bg-tertiary)] text-[var(--text-heading)] shadow-card"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)]/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "bookout" && activeBreakdowns.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-accent-red/20 text-accent-red border border-accent-red/30">
                  {activeBreakdowns.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && (
            <div className="space-y-6">
              <BreakdownStats metrics={metrics} />

              <BreakdownCharts
                statusData={[
                  {
                    name: "Operational",
                    value:
                      metrics.active === 0
                        ? 100
                        : Math.max(0, 100 - metrics.active),
                  },
                  { name: "Broken Down", value: metrics.active },
                ]}
                mttrData={[
                  { machine: "Excavators", hours: 4.2 },
                  { machine: "Haul Trucks", hours: 6.8 },
                  { machine: "Dozers", hours: 3.1 },
                  { machine: "Drills", hours: 5.5 },
                ]}
              />

              <div>
                <h3 className="text-lg font-medium text-[var(--text-heading)] mb-3">
                  Active Breakdowns
                </h3>
                <BreakdownsTable
                  breakdowns={activeBreakdowns}
                  showStatus={false}
                />
              </div>
            </div>
          )}

          {activeTab === "bookin" && (
            <BookInForm
              departmentId={departmentId}
              activeBreakdowns={activeBreakdowns}
              machines={machines}
            />
          )}

          {activeTab === "bookout" && (
            <BookOutForm
              departmentId={departmentId}
              activeBreakdowns={activeBreakdowns}
            />
          )}

          {activeTab === "query" && (
            <BreakdownsTable breakdowns={breakdowns} showStatus={true} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
