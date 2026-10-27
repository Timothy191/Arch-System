import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import { BarChart3, CheckSquare, ClipboardCheck, Clock, Cpu } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { getDepartmentContext } from '~/lib/dept-context';
import { ControlRoomSummaryGridClient } from '../[department]/ControlRoomSummaryGridClient';
import { ControlRoomQuickNav } from './components/ControlRoomQuickNav';

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
  const { deptId, today } = await getDepartmentContext({ department: 'control-room' });

  return (
    <ErrorBoundary context="Control Room Dashboard">
      <div className="space-y-6">
        {/* Page Title & Header */}
        <GlassCard hover accent="charcoal">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                Control Room Dashboard
              </h1>
              <p className="mt-1 text-[var(--text-secondary)] text-sm">
                Live SCADA monitoring, production metrics, and shift dispatch.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <ControlRoomQuickNav />
              <time
                className="whitespace-nowrap text-[var(--text-muted)] text-sm"
                dateTime={new Date().toISOString()}
              >
                {new Date().toLocaleString('en-ZA', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          </div>

          {/* Dashboard Sub-tabs: SCADA Dashboard & Shift Operations (Previous / Current Shift) */}
          <div
            aria-label="Control Room Dashboard Sub-tabs"
            className="mt-4 flex flex-wrap items-center gap-2 border-[var(--border-subtle)]/60 border-t pt-3"
          >
            <Link
              href="/control-room"
              aria-current="page"
              className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg bg-[var(--accent-blue)]/10 px-3.5 py-1.5 font-semibold text-[var(--accent-blue)] text-xs transition-all"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>SCADA Dashboard</span>
            </Link>
            <Link
              href="/control-room/shift-compilation"
              className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3.5 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-all hover:border-[var(--border-subtle)] hover:bg-black/[0.04] hover:text-[var(--accent-blue)]"
            >
              <ClipboardCheck className="h-3.5 w-3.5 text-[var(--text-heading)]" />
              <span>Shift Operations</span>
            </Link>
          </div>
        </GlassCard>

        <Divider variant="fading" />

        {/* Control Room Summary Grid - Client-side with React Query */}
        <Suspense fallback={<SummaryGridSkeleton />}>
          <ControlRoomSummaryGridClient deptId={deptId} today={today} />
        </Suspense>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/control-room/machine-operations"
            className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-medium text-sm text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--accent-blue)]/90 active:scale-[0.98]"
          >
            <Cpu className="h-4 w-4" />
            Machine Operations
          </Link>
          <Link
            href="/control-room/hourly-loads"
            className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 font-medium text-[var(--text-secondary)] text-sm transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)] active:scale-[0.98]"
          >
            <Clock className="h-4 w-4" />
            Update Loads
          </Link>
          <Link
            href="/control-room/shift-compilation"
            className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 font-medium text-[var(--text-secondary)] text-sm transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)] active:scale-[0.98]"
          >
            <ClipboardCheck className="h-4 w-4" />
            Shift Operations
          </Link>
          <Link
            href="/control-room/shift-compilation?tab=closeout"
            className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 font-medium text-[var(--text-secondary)] text-sm transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)] active:scale-[0.98]"
          >
            <CheckSquare className="h-4 w-4" />
            Shift Closeout
          </Link>
        </div>

        {/* Consolidated Dynamic Control Room Widgets */}
        <ControlRoomWidgets deptId={deptId} deptSlug="control-room" today={today} />
      </div>
    </ErrorBoundary>
  );
}
