import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import { BarChart3, ClipboardCheck } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import { getPlantProcessingWorkspaceData } from '~/features/departments/components/plant-processing/actions';
import { PlantHourlySheetClient } from '~/features/departments/components/plant-processing/PlantHourlySheetClient';
import {
  MonthlyProductionTargetBanner,
  ProductionDashboard,
} from '~/features/departments/components/production/ProductionDashboard';
import { getDepartmentContext } from '~/lib/dept-context';
import { ControlRoomQuickNav } from '../control-room/components/ControlRoomQuickNav';
import { ControlRoomSummaryGridClient } from './ControlRoomSummaryGridClient';
import { NonControlRoomSummaryGridClient } from './NonControlRoomSummaryGridClient';
import ReportsPage from './reports/page';

// AGENT-TRACE: ControlRoomWidgets consolidated dynamic island — co-locates all control-room
// specific widgets (ScadaPanel, AlertPanel, ActivityFeed, Checklist, ShiftCoverage) to prevent
// bundle fragmentation and reduce React reconciliation passes on non-control room pages.
const ControlRoomWidgets = dynamic(
  () => import('./ControlRoomWidgets').then((m) => m.ControlRoomWidgets),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
        <div className="h-96 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-[400px] animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
          <div className="h-[400px] animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
        </div>
        <div className="h-[400px] animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
      </div>
    ),
  }
);

function PlantInventoryDashboard({ today }: { today: string }) {
  return (
    <ErrorBoundary context="Department Dashboard: plant-inventory">
      <PlantInventoryWorkspaceClient mode="dashboard" today={today} />
    </ErrorBoundary>
  );
}

export default async function DepartmentDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ from?: string; to?: string; tab?: string }>;
}) {
  const { department: deptSlug } = await params;

  if (deptSlug === 'availability-utilization') {
    return (
      <ReportsPage
        params={params}
        searchParams={searchParams ?? Promise.resolve({ tab: 'machine-30d' })}
      />
    );
  }

  const { dept, deptId, today } = await getDepartmentContext({
    department: deptSlug,
  });

  if (deptSlug === 'plant-processing') {
    const plantData = await getPlantProcessingWorkspaceData(today);
    return (
      <PlantHourlySheetClient
        initialDate={plantData.currentDate}
        initialSheets={plantData.initialSheets}
        initialDelays={plantData.initialDelays}
        mode="dashboard"
      />
    );
  }

  if (deptSlug === 'plant-inventory') {
    return <PlantInventoryDashboard today={today} />;
  }

  if (deptSlug === 'production') {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-transparent">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/20 border-t-[var(--accent-blue)]" />
          </div>
        }
      >
        <ProductionDashboard deptId={deptId} />
      </Suspense>
    );
  }

  const isControlRoom = dept.type === 'control_room';

  return (
    // AGENT-TRACE: ErrorBoundary wraps entire dashboard for graceful degradation
    // Context helps identify which department/feature failed
    <ErrorBoundary context={`Department Dashboard: ${deptSlug}`}>
      <div className="space-y-6">
        {isControlRoom ? (
          <>
            <GlassCard hover accent="charcoal">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                    Control Room Dashboard
                  </h2>
                  <p className="mt-1 text-[var(--text-secondary)] text-sm">
                    Live SCADA monitoring, production metrics, and shift dispatch.
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <ControlRoomQuickNav />
                  <p className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                    {new Date().toLocaleDateString('en-ZA', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Dashboard Sub-tabs: SCADA Dashboard & Shift Operations (Previous / Current Shift) */}
              <div
                aria-label="Control Room Dashboard Sub-tabs"
                className="mt-4 flex flex-wrap items-center gap-2 border-[var(--border-subtle)]/60 border-t pt-3"
              >
                <Link
                  href={`/${deptSlug}`}
                  aria-current="page"
                  className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg bg-[var(--accent-blue)]/10 px-3.5 py-1.5 font-semibold text-[var(--accent-blue)] text-xs transition-all"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>SCADA Dashboard</span>
                </Link>
                <Link
                  href={`/${deptSlug}/shift-compilation`}
                  className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3.5 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-all hover:border-[var(--border-subtle)] hover:bg-black/[0.04] hover:text-[var(--accent-blue)]"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 text-[var(--text-heading)]" />
                  <span>Shift Operations</span>
                </Link>
              </div>
            </GlassCard>

            <Divider variant="fading" />

            {/* Control Room Summary Grid - Client-side with React Query */}
            <Suspense
              fallback={
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
                  <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
                  <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
                  <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
                  <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
                </div>
              }
            >
              <ControlRoomSummaryGridClient deptId={deptId} today={today} />
            </Suspense>

            {/* Cross-Department Monthly Coal & Waste Target Pulled from Production */}
            <Suspense
              fallback={<div className="h-20 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />}
            >
              <MonthlyProductionTargetBanner />
            </Suspense>

            {/* AGENT-TRACE: Quick Actions - UX improvements based on heuristics:
                 - Single primary action (machine operations) to reduce cognitive load
                 - Removed duplicate "Log Delay" button that went to same destination
                 - Clear visual hierarchy: primary (blue) vs secondary (outline) buttons
                 - Action labels are self-evident and match system capabilities
            */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${deptSlug}/machine-operations`}
                className="gold-steel-border gold-steel-border-slim rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-medium text-sm text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--accent-blue)]/90 active:scale-[0.98]"
              >
                Machine Operations
              </Link>
              <Link
                href={`/${deptSlug}/hourly-loads`}
                className="gold-steel-border gold-steel-border-slim rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 font-medium text-[var(--text-secondary)] text-sm transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)] active:scale-[0.98]"
              >
                Update Loads
              </Link>
            </div>

            {/* Consolidated Dynamic Control Room Widgets */}
            <ControlRoomWidgets deptId={deptId} deptSlug={deptSlug} today={today} />
          </>
        ) : (
          <>
            <GlassCard hover accent="charcoal">
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">Dashboard</h2>
            </GlassCard>

            <Divider variant="fading" />

            {/* Non-Control Room Summary Grid - Client-side with React Query */}
            <Suspense
              fallback={
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
                  <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
                  <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
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
