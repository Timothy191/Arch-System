import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// AGENT-TRACE: ControlRoomWidgets groups all dynamic widgets exclusive to the control room dashboard.
// Co-locating them prevents bundle fragmentation on non-control room department routes.

const ScadaPanel = dynamic(() => import('@/features/departments').then((m) => m.ScadaPanel), {
  loading: () => <div className="h-[400px] animate-pulse rounded-card bg-bg-tertiary" />,
});

const AlertPanel = dynamic(() => import('@/features/departments').then((m) => m.AlertPanel), {
  loading: () => <div className="h-[400px] animate-pulse rounded-card bg-bg-tertiary" />,
});

const ControlRoomActivityFeed = dynamic(
  () => import('@/features/departments').then((m) => m.ControlRoomActivityFeed),
  {
    loading: () => <div className="h-[400px] animate-pulse rounded-card bg-bg-tertiary" />,
  }
);

interface ControlRoomWidgetsProps {
  deptId: string;
  deptSlug?: string;
  today?: string;
}

export function ControlRoomWidgets({ deptId }: ControlRoomWidgetsProps) {
  return (
    <div className="space-y-6">
      {/* SCADA and Alert Telemetry Panels (Elevated to top for 24/7 Situational Awareness) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense
          fallback={<div className="h-[400px] animate-pulse rounded-card bg-bg-tertiary" />}
        >
          <ScadaPanel departmentId={deptId} />
        </Suspense>
        <Suspense
          fallback={<div className="h-[400px] animate-pulse rounded-card bg-bg-tertiary" />}
        >
          <AlertPanel departmentId={deptId} />
        </Suspense>
      </div>

      {/* Activity Feed */}
      <Suspense fallback={<div className="h-[400px] animate-pulse rounded-card bg-bg-tertiary" />}>
        <ControlRoomActivityFeed departmentId={deptId} />
      </Suspense>
    </div>
  );
}
