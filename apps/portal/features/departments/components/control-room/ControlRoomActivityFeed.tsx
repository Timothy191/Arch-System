"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { GlassCard } from "@repo/ui/GlassCard";
import { AnimatedFeed } from "@repo/ui/AnimatedList";
import { useThrottledState } from "@/hooks/useThrottledState";

type ActivityType = "insert" | "update" | "delete";

interface ActivityItem {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: number;
}

interface ControlRoomActivityFeedProps {
  departmentId: string;
}

export function ControlRoomActivityFeed({
  departmentId,
}: ControlRoomActivityFeedProps) {
  const [activities, setActivities] = useThrottledState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const channel = supabase
      .channel("control-room-activity")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "machines",
          filter: `department_id=eq.${departmentId}`,
        },
        (payload) => {
          const rawEvent = payload.eventType;
          const eventType: ActivityType =
            rawEvent === "INSERT"
              ? "insert"
              : rawEvent === "UPDATE"
                ? "update"
                : "delete";
          const machine = (payload.new || payload.old) as {
            name?: string;
          };
          const message = `${machine.name || "Machine"} ${eventType === "insert" ? "registered" : eventType === "update" ? "updated" : "removed"}`;

          setActivities((prev) => [
            {
              id: `${payload.commit_timestamp || Date.now()}-${Math.random()}`,
              type: eventType,
              message,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 49),
          ]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  const filtered =
    filter === "all" ? activities : activities.filter((a) => a.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-[var(--text-heading)]">
          Activity Feed
        </h2>
        <div className="flex items-center gap-2">
          {(["all", "insert", "update", "delete"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-[var(--bg-tertiary)] text-[var(--text-heading)] border border-arch-accent-green"
                  : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-emphasis)] hover:text-[var(--text-heading)]"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto pr-1">
        <AnimatedFeed className="gap-2">
          {filtered.map((activity) => (
            <GlassCard key={activity.id} className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activity.type === "insert"
                        ? "bg-accent-green"
                        : activity.type === "update"
                          ? "bg-accent-blue"
                          : "bg-accent-red"
                    }`}
                  />
                  <p className="text-[var(--text-heading)] text-sm">
                    {activity.message}
                  </p>
                </div>
                <span className="text-[var(--text-secondary)] text-xs">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </GlassCard>
          ))}

          {activities.length === 0 && (
            <GlassCard>
              <p className="text-[var(--text-secondary)] text-sm text-center py-8">
                Waiting for activity...
              </p>
            </GlassCard>
          )}
        </AnimatedFeed>
      </div>
    </div>
  );
}
