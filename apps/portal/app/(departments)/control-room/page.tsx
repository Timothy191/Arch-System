import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import dynamic from 'next/dynamic';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { getDepartmentContext } from '~/lib/dept-context';
import { ControlRoomSummaryGridClient } from '../[department]/ControlRoomSummaryGridClient';
import { ControlRoomActionDropdown } from './components/ControlRoomActionDropdown';
import { ControlRoomQuickNav } from './components/ControlRoomQuickNav';
import { ControlRoomSubtabs } from './components/ControlRoomSubtabs';
import { SectionHeader } from './components/SectionHeader';

// AGENT-TRACE: ControlRoomWidgets dynamic island — co-locates all control-room
// specific widgets (ScadaPanel, AlertPanel, ActivityFeed, Checklist, ShiftCoverage, EquipmentDashboard)
const ControlRoomWidgets = dynamic(
  () => import('../[department]/ControlRoomWidgets').then((m) => m.ControlRoomWidgets),
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

function SummaryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
    </div>
  );
}

export default async function ControlRoomPage() {
  await connection();
  const { deptId, today } = await getDepartmentContext({ department: 'control-room' });

  return (
    <ErrorBoundary context="Control Room Dashboard">
      <div className="space-y-6">
        {/* Page Title & Header */}
        <GlassCard hover accent="charcoal">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <SectionHeader
              title="Control Room Dashboard"
              subtitle="Live SCADA monitoring, production metrics, and shift dispatch."
            />
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <ControlRoomQuickNav />
            </div>
          </div>

          {/* Dashboard Sub-tabs: SCADA Dashboard & Shift Operations (Previous / Current Shift) */}
          <ControlRoomSubtabs activeTab="scada" />
        </GlassCard>

        <Divider variant="fading" />

        {/* Control Room Summary Grid - Client-side with React Query */}
        <Suspense fallback={<SummaryGridSkeleton />}>
          <ControlRoomSummaryGridClient deptId={deptId} today={today} />
        </Suspense>

        {/* Quick Action Navigation Dropdown */}
        <div className="flex items-center">
          <ControlRoomActionDropdown />
        </div>

        {/* Consolidated Dynamic Control Room Widgets */}
        <ControlRoomWidgets deptId={deptId} deptSlug="control-room" today={today} />
      </div>
    </ErrorBoundary>
  );
}
