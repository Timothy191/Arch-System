import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getDepartmentContext } from "~/lib/dept-context";
import { getCurrentShift } from "@repo/utils";
import { ErrorBoundary } from "~/components/ErrorBoundary";

const ScadaPanel = dynamic(() => import("@/features/departments").then((m) => m.ScadaPanel), {
  loading: () => <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
});

const AlertPanel = dynamic(() => import("@/features/departments").then((m) => m.AlertPanel), {
  loading: () => <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
});

const ControlRoomActivityFeed = dynamic(
  () => import("@/features/departments").then((m) => m.ControlRoomActivityFeed),
  {
    loading: () => <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
  },
);

const ControlRoomChecklistWidget = dynamic(
  () => import("@/features/departments").then((m) => m.ControlRoomChecklistWidget),
  {
    loading: () => <div className="h-96 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
  },
);

const WeatherWidget = dynamic(
  () => import("@/components/weather/WeatherWidget").then((mod) => mod.WeatherWidget),
  {
    loading: () => <div className="h-32 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
  },
);

const SatelliteMonitoringDashboard = dynamic(
  () => import("@/features/departments").then((mod) => mod.SatelliteMonitoringDashboard),
  {
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-8 h-8 border-2 border-[var(--accent-blue)]/20 border-t-[var(--accent-blue)] rounded-full animate-spin" />
      </div>
    ),
  },
);

import { SafetyDashboard } from "~/features/departments/components/safety/SafetyDashboard";
import { ProductionDashboard } from "~/features/departments/components/production/ProductionDashboard";
import { ControlRoomSummaryGridClient } from "./ControlRoomSummaryGridClient";
import { NonControlRoomSummaryGridClient } from "./NonControlRoomSummaryGridClient";
import { ShiftCoverageSectionClient } from "./ShiftCoverageSectionClient";

export default async function DepartmentDashboard({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  const { dept, deptId, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // 1. Early returns for satellite and safety — skip shared queries entirely
  if (dept.type === "satellite") {
    return <SatelliteMonitoringDashboard />;
  }

  if (dept.type === "safety") {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
            <div className="w-8 h-8 border-2 border-[var(--accent-green)]/20 border-t-[var(--accent-green)] rounded-full animate-spin" />
          </div>
        }
      >
        <SafetyDashboard deptId={deptId} />
      </Suspense>
    );
  }

  if (deptSlug === "production") {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
            <div className="w-8 h-8 border-2 border-[var(--accent-blue)]/20 border-t-[var(--accent-blue)] rounded-full animate-spin" />
          </div>
        }
      >
        <ProductionDashboard deptId={deptId} />
      </Suspense>
    );
  }

  const isControlRoom = dept.type === "control_room";

  return (
    // AGENT-TRACE: ErrorBoundary wraps entire dashboard for graceful degradation
    // Context helps identify which department/feature failed
    <ErrorBoundary context={`Department Dashboard: ${deptSlug}`}>
      <div className="space-y-6">
        {isControlRoom ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--text-heading)]">
                Control Room Dashboard
              </h2>
              <p className="text-[var(--text-muted)] text-sm">
                {new Date().toLocaleDateString("en-ZA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Control Room Summary Grid - Client-side with React Query */}
            <Suspense
              fallback={
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                </div>
              }
            >
              <ControlRoomSummaryGridClient deptId={deptId} today={today} />
            </Suspense>

            {/* Weather Conditions */}
            <Suspense
              fallback={<div className="h-32 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
            >
              <WeatherWidget variant="compact" />
            </Suspense>

            {/* AGENT-TRACE: Quick Actions - UX improvements based on heuristics:
                 - Single primary action (machine operations) to reduce cognitive load
                 - Removed duplicate "Log Delay" button that went to same destination
                 - Clear visual hierarchy: primary (blue) vs secondary (outline) buttons
                 - Action labels are self-evident and match system capabilities
            */}
            <div className="flex flex-wrap gap-3">
              <a
                href={`/${deptSlug}/machine-operations`}
                className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                Machine Operations
              </a>
              <a
                href={`/${deptSlug}/hourly-loads`}
                className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                Update Loads
              </a>
            </div>

            {/* Shift Coverage - Client-side with React Query */}
            <Suspense
              fallback={<div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
            >
              <ShiftCoverageSectionClient deptId={deptId} deptSlug={deptSlug} today={today} />
            </Suspense>

            {/* Control Room Shift Checklist & Operational KPIs */}
            <Suspense
              fallback={<div className="h-96 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
            >
              <ControlRoomChecklistWidget
                departmentId={deptId}
                departmentSlug={deptSlug}
                date={today}
                shift={getCurrentShift()}
              />
            </Suspense>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Suspense
                fallback={
                  <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                }
              >
                <ScadaPanel departmentId={deptId} />
              </Suspense>
              <Suspense
                fallback={
                  <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                }
              >
                <AlertPanel departmentId={deptId} />
              </Suspense>
            </div>
            <Suspense
              fallback={
                <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
              }
            >
              <ControlRoomActivityFeed departmentId={deptId} />
            </Suspense>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-[var(--text-heading)]">Dashboard</h2>

            {/* Weather for drilling department - critical for outdoor operations */}
            {deptSlug === "drilling" && (
              <Suspense
                fallback={
                  <div className="h-32 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                }
              >
                <WeatherWidget variant="full" />
              </Suspense>
            )}

            {/* Non-Control Room Summary Grid - Client-side with React Query */}
            <Suspense
              fallback={
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                </div>
              }
            >
              <NonControlRoomSummaryGridClient deptId={deptId} today={today} />
            </Suspense>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
