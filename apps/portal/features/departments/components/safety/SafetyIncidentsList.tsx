"use client";

import { GlassCard } from "@repo/ui/GlassCard";
import { cn } from "@repo/ui/lib/utils";

interface Incident {
  id: string;
  incident_type: string;
  severity_id: string | null;
  severity_color: string | null;
  category_name: string | null;
  description: string;
  location: string | null;
  injured_parties: number;
  status: string;
  incident_date: string;
  shift_type: string;
  created_at: string;
}

interface SafetyIncidentsListProps {
  incidents: Incident[];
}

const statusColors: Record<string, string> = {
  open: "text-accent-blue",
  "under-investigation": "text-accent-blue",
  resolved: "text-accent-green",
  closed: "text-[var(--text-secondary)]",
};

export function SafetyIncidentsList({ incidents }: SafetyIncidentsListProps) {
  if (incidents.length === 0) {
    return (
      <GlassCard className="py-8">
        <p className="text-[var(--text-secondary)] text-sm text-center">
          No incidents recorded today
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => (
        <GlassCard
          key={incident.id}
          className="hover:border-[var(--border-emphasis)] transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    incident.severity_color
                      ? "text-white"
                      : "text-[var(--text-secondary)]",
                  )}
                  style={
                    incident.severity_color
                      ? { backgroundColor: incident.severity_color + "30" }
                      : {}
                  }
                >
                  {incident.severity_color ? "● " : ""}
                  {incident.incident_type}
                </span>
                {incident.category_name && (
                  <span className="text-[var(--text-secondary)] text-xs">
                    {incident.category_name}
                  </span>
                )}
                <span
                  className={cn(
                    "text-xs font-medium capitalize",
                    statusColors[incident.status] ||
                      "text-[var(--text-secondary)]",
                  )}
                >
                  {incident.status.replace("-", " ")}
                </span>
              </div>

              <p className="text-[var(--text-heading)] text-sm mt-2">
                {incident.description}
              </p>

              {incident.location && (
                <p className="text-[var(--text-secondary)] text-xs mt-1">
                  📍 {incident.location}
                </p>
              )}

              {incident.injured_parties > 0 && (
                <p className="text-accent-red text-xs mt-1">
                  ⚠ {incident.injured_parties} injured
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className="text-[var(--text-secondary)] text-xs">
                {new Date(incident.created_at).toLocaleDateString("en-ZA", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-[var(--text-secondary)] text-xs mt-1">
                {incident.shift_type} shift
              </p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
