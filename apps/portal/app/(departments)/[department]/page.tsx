import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
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

// AGENT-TRACE: ControlRoomWidgets consolidated dynamic island — co-locates all control-room
// specific widgets (ScadaPanel, AlertPanel, ActivityFeed, Checklist, ShiftCoverage) to prevent
// bundle fragmentation and reduce React reconciliation passes on non-control room pages.
const ControlRoomWidgets = dynamic(
  () => import('./ControlRoomWidgets').then((m) => m.ControlRoomWidgets),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
        <div className="h-96 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
          <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
        </div>
        <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
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
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  const { dept, deptId, today } = await getDepartmentContext({
    department: deptSlug,
  });

  if (deptSlug === 'plant-processing') {
    const plantData = await getPlantProcessingWorkspaceData(today);
    return (
      <PlantHourlySheetClient
        initialDate={plantData.currentDate}
        initialSheets={plantData.initialSheets}
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
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-[var(--accent-blue)] rounded-full animate-spin" />
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--text-heading)]">
                    Control Room Dashboard
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Live SCADA monitoring, production metrics, and shift dispatch.
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <ControlRoomQuickNav />
                  <p className="text-[var(--text-muted)] text-sm whitespace-nowrap">
                    {new Date().toLocaleDateString('en-ZA', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </GlassCard>

            <Divider variant="fading" />

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

            {/* Cross-Department Monthly Coal & Waste Target Pulled from Production */}
            <Suspense
              fallback={<div className="h-20 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
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
                className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98] gold-steel-border gold-steel-border-slim"
              >
                Machine Operations
              </Link>
              <Link
                href={`/${deptSlug}/hourly-loads`}
                className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98] gold-steel-border gold-steel-border-slim"
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
              <h2 className="text-2xl font-bold text-[var(--text-heading)]">Dashboard</h2>
            </GlassCard>

            <Divider variant="fading" />

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
