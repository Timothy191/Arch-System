'use client';

import { useThrottledState } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { AnimatedFeed } from '@repo/ui/AnimatedList';
import { GlassCard } from '@repo/ui/GlassCard';
import { useEffect, useState } from 'react';

type ActivityType = 'insert' | 'update' | 'delete';

interface ActivityItem {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: number;
}

interface ControlRoomActivityFeedProps {
  departmentId: string;
}

export function ControlRoomActivityFeed({ departmentId }: ControlRoomActivityFeedProps) {
  const [activities, setActivities] = useThrottledState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const channel = supabase
      .channel('control-room-activity')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines',
          filter: `department_id=eq.${departmentId}`,
        },
        (payload) => {
          const rawEvent = payload.eventType;
          const eventType: ActivityType =
            rawEvent === 'INSERT' ? 'insert' : rawEvent === 'UPDATE' ? 'update' : 'delete';
          const machine = (payload.new || payload.old) as {
            name?: string;
          };
          const message = `${machine.name || 'Machine'} ${eventType === 'insert' ? 'registered' : eventType === 'update' ? 'updated' : 'removed'}`;

          setActivities((prev) => [
            {
              id: `${payload.commit_timestamp || Date.now()}-${Math.random()}`,
              type: eventType,
              message,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 49),
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, setActivities]);

  const filtered = filter === 'all' ? activities : activities.filter((a) => a.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-[var(--text-heading)] text-xl">Activity Feed</h2>
        {/* AGENT-TRACE: Accessibility - Added role="group" and aria-pressed for filter toggle buttons */}
        <div className="flex items-center gap-2" role="group" aria-label="Activity filter">
          {(['all', 'insert', 'update', 'delete'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-lg px-3 py-1 font-medium text-xs transition-colors ${
                filter === f
                  ? 'border border-arch-accent-green bg-[var(--bg-tertiary)] text-[var(--text-heading)]'
                  : 'border border-[var(--border-emphasis)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto pr-1">
        <AnimatedFeed className="gap-2">
          {filtered.map((activity) => (
            <GlassCard key={activity.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      activity.type === 'insert'
                        ? 'bg-accent-green'
                        : activity.type === 'update'
                          ? 'bg-accent-blue'
                          : 'bg-accent-red'
                    }`}
                  />
                  <p className="text-[var(--text-heading)] text-sm">{activity.message}</p>
                </div>
                <span className="text-[var(--text-secondary)] text-xs">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </GlassCard>
          ))}

          {activities.length === 0 && (
            <GlassCard>
              <p className="py-8 text-center text-[var(--text-secondary)] text-sm">
                Waiting for activity...
              </p>
            </GlassCard>
          )}
        </AnimatedFeed>
      </div>
    </div>
  );
}
