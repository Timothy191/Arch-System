"use client";

import { useNonControlRoomSummary } from "@/hooks/useDashboardQueries";
import { GlassCard } from "@repo/ui/GlassCard";

interface NonControlRoomSummaryGridClientProps {
  deptId: string;
  today: string;
}

export function NonControlRoomSummaryGridClient({
  deptId,
  today,
}: NonControlRoomSummaryGridClientProps) {
  const { data } = useNonControlRoomSummary(deptId, today);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm">Today&apos;s Log</p>
        <p className="text-2xl font-bold text-[var(--text-heading)] mt-1">
          {data.hasLogs
            ? `${data.shiftCount} shift${data.shiftCount > 1 ? "s" : ""} logged`
            : "Not logged"}
        </p>
        {data.latestShift && (
          <p className="text-[var(--text-muted)] text-xs mt-1">Latest: {data.latestShift}</p>
        )}
      </GlassCard>
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm">Active Machines</p>
        <p className="text-2xl font-bold text-[var(--text-heading)] mt-1">{data.machineCount}</p>
      </GlassCard>
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm">Status</p>
        <p className="text-2xl font-bold text-[var(--accent-green)] mt-1">
          {data.machineCount > 0
            ? `${data.machineCount} machine${data.machineCount > 1 ? "s" : ""} active`
            : "No machines online"}
        </p>
      </GlassCard>
    </div>
  );
}
