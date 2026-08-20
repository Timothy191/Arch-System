"use client";

import { useControlRoomSummary } from "@/hooks/useDashboardQueries";
import { GlassCard } from "@repo/ui/GlassCard";

interface ControlRoomSummaryGridClientProps {
  deptId: string;
  today: string;
}

export function ControlRoomSummaryGridClient({ deptId, today }: ControlRoomSummaryGridClientProps) {
  const { data } = useControlRoomSummary(deptId, today);

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <GlassCard hover accent="blue">
        <p className="system-label">Hours Today</p>
        <p className="text-2xl font-bold text-[var(--accent-blue)] mt-1">
          {data.totalHours.toFixed(1)}h
        </p>
        {data.activeOperations > 0 && (
          <p className="text-[var(--accent-blue)] text-xs mt-1">
            {data.activeOperations} in progress
          </p>
        )}
      </GlassCard>
      <GlassCard hover accent="none">
        <p className="system-label">Total Loads</p>
        <p className="text-2xl font-bold text-[var(--text-heading)] mt-1">
          {data.totalLoads.toLocaleString()}
        </p>
      </GlassCard>
      <GlassCard hover accent="red">
        <p className="system-label">Delay Hours</p>
        <p className="text-2xl font-bold text-accent-red mt-1">
          {data.totalDelayHours.toFixed(1)}h
        </p>
        {data.draftDelayHours > 0 && (
          <p className="text-[var(--accent-yellow)] text-xs mt-1">
            {data.draftDelayHours.toFixed(1)}h draft
          </p>
        )}
      </GlassCard>
      <GlassCard hover accent="green">
        <p className="system-label">Machines</p>
        <p className="text-2xl font-bold text-accent-green mt-1">{data.machineCount}</p>
        <p className="system-label mt-1">Active</p>
      </GlassCard>
      <GlassCard hover accent="cyan">
        <p className="system-label">Delay Entries</p>
        <p className="text-2xl font-bold text-[var(--accent-blue)] mt-1">
          {data.delayEntriesCount}
        </p>
        {data.committedDelayHours > 0 && (
          <p className="text-accent-green text-xs mt-1">
            {data.committedDelayHours.toFixed(1)}h committed
          </p>
        )}
      </GlassCard>
    </div>
  );
}
