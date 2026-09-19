import { getCurrentShift } from "@repo/utils";
import dynamic from "next/dynamic";
import { Suspense } from "react";

// AGENT-TRACE: ControlRoomWidgets groups all dynamic widgets exclusive to the control room dashboard.
// Co-locating them prevents bundle fragmentation on non-control room department routes.

const ShiftCoverageSectionClient = dynamic(
  () => import("./ShiftCoverageSectionClient").then((m) => m.ShiftCoverageSectionClient),
  {
    loading: () => <div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
  },
);

const ControlRoomChecklistWidget = dynamic(
  () => import("@/features/departments").then((m) => m.ControlRoomChecklistWidget),
  {
    loading: () => <div className="h-96 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
  },
);

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

interface ControlRoomWidgetsProps {
  deptId: string;
  deptSlug: string;
  today: string;
}

export function ControlRoomWidgets({ deptId, deptSlug, today }: ControlRoomWidgetsProps) {
  return (
    <div className="space-y-6">
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

      {/* SCADA and Alert Telemetry Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense
          fallback={<div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
        >
          <ScadaPanel departmentId={deptId} />
        </Suspense>
        <Suspense
          fallback={<div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
        >
          <AlertPanel departmentId={deptId} />
        </Suspense>
      </div>

      {/* Activity Feed */}
      <Suspense
        fallback={<div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
      >
        <ControlRoomActivityFeed departmentId={deptId} />
      </Suspense>
    </div>
  );
}
