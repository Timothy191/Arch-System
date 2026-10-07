import { Divider } from '@repo/ui/Divider';
import { CheckSquare, ClipboardCheck, Clock, Cpu } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { getDepartmentContext } from '~/lib/dept-context';

import { ControlRoomSummaryGridClient } from '../[department]/ControlRoomSummaryGridClient';

// AGENT-TRACE: ControlRoomWidgets dynamic island — co-locates all control-room
// specific widgets (ScadaPanel, AlertPanel, ActivityFeed, Checklist, ShiftCoverage, EquipmentDashboard)
const ControlRoomWidgets = dynamic(
  () => import('../[department]/ControlRoomWidgets').then((m) => m.ControlRoomWidgets),
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

function SummaryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
      <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
      <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
      <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
      <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
    </div>
  );
}

export default async function ControlRoomPage() {
  const { deptId, today } = await getDepartmentContext({ department: 'control-room' });

  return (
    <ErrorBoundary context="Control Room Dashboard">
      <div className="space-y-6">
        {/* Page Title & Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-heading)]">
              Control Room Dashboard
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Live SCADA monitoring, production metrics, and shift dispatch.
            </p>
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            {new Date().toLocaleDateString('en-ZA', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <Divider variant="fading" />

        {/* Control Room Summary Grid - Client-side with React Query */}
        <Suspense fallback={<SummaryGridSkeleton />}>
          <ControlRoomSummaryGridClient deptId={deptId} today={today} />
        </Suspense>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/control-room/machine-operations"
            className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2"
          >
            <Cpu className="w-4 h-4" />
            Machine Operations
          </Link>
          <Link
            href="/control-room/hourly-loads"
            className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Update Loads
          </Link>
          <Link
            href="/control-room/shift-compilation"
            className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2"
          >
            <ClipboardCheck className="w-4 h-4" />
            Shift Handover
          </Link>
          <Link
            href="/control-room/shift-closeout"
            className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2"
          >
            <CheckSquare className="w-4 h-4" />
            Shift Closeout
          </Link>
        </div>

        {/* Consolidated Dynamic Control Room Widgets */}
        <ControlRoomWidgets deptId={deptId} deptSlug="control-room" today={today} />
      </div>
    </ErrorBoundary>
  );
}
