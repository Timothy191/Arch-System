'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { memo } from 'react';
import { useNonControlRoomSummary } from '@/hooks/useDashboardQueries';

interface NonControlRoomSummaryGridClientProps {
  deptId: string;
  today: string;
}

// AGENT-TRACE: Memoized to prevent re-renders when parent Dashboard re-renders.
// Props (deptId, today) are stable strings — re-renders only from React Query data updates.
function NonControlRoomSummaryGridClientBase({
  deptId,
  today,
}: NonControlRoomSummaryGridClientProps) {
  const { data } = useNonControlRoomSummary(deptId, today);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm">Today&apos;s Log</p>
        <p className="mt-1 font-bold text-2xl text-[var(--text-heading)]">
          {data.hasLogs
            ? `${data.shiftCount} shift${data.shiftCount > 1 ? 's' : ''} logged`
            : 'Not logged'}
        </p>
        {data.latestShift && (
          <p className="mt-1 text-[var(--text-muted)] text-xs">Latest: {data.latestShift}</p>
        )}
      </GlassCard>
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm">Active Machines</p>
        <p className="mt-1 font-bold text-2xl text-[var(--text-heading)]">{data.machineCount}</p>
      </GlassCard>
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm">Status</p>
        <p className="mt-1 font-bold text-2xl text-[var(--accent-green)]">
          {data.machineCount > 0
            ? `${data.machineCount} machine${data.machineCount > 1 ? 's' : ''} active`
            : 'No machines online'}
        </p>
      </GlassCard>
    </div>
  );
}

export const NonControlRoomSummaryGridClient = memo(NonControlRoomSummaryGridClientBase);
