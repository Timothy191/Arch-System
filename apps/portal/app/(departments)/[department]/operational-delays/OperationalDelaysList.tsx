import { GlassCard } from "@repo/ui/GlassCard";

interface OperationalDelay {
  id: string;
  shift_type: "day" | "night";
  delay_type: string;
  delay_minutes: number;
  description: string;
  impact_description: string | null;
  recovery_action: string | null;
  status: "active" | "recovered" | "extended";
  created_at: string;
  category?: {
    name: string;
    color: string;
    icon: string;
  } | null;
  machine?: {
    name: string;
    sites?: { name: string }[] | { name: string } | null;
  } | null;
}

interface OperationalDelaysListProps {
  delays: OperationalDelay[];
}

const DELAY_TYPE_COLORS: Record<string, string> = {
  equipment: "#1c1c1e",
  weather: "#27272a",
  safety: "#ef4444",
  material: "#3f3f46",
  shift_change: "#10b981",
  operator: "#52525b",
  other: "#71717a",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#1c1c1e",
  recovered: "#10b981",
  extended: "#ef4444",
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OperationalDelaysList({ delays }: OperationalDelaysListProps) {
  if (delays.length === 0) {
    return (
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm text-center py-8">
          No delays recorded today.
        </p>
      </GlassCard>
    );
  }

  // Group by shift
  const dayDelays = delays.filter((d) => d.shift_type === "day");
  const nightDelays = delays.filter((d) => d.shift_type === "night");

  return (
    <div className="space-y-4">
      {dayDelays.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-accent-blue flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-blue"></span>
            Day Shift Delays
          </h4>
          <div className="space-y-2">
            {dayDelays.map((delay) => (
              <DelayCard key={delay.id} delay={delay} />
            ))}
          </div>
        </div>
      )}

      {nightDelays.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-accent-blue flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-blue"></span>
            Night Shift Delays
          </h4>
          <div className="space-y-2">
            {nightDelays.map((delay) => (
              <DelayCard key={delay.id} delay={delay} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DelayCard({ delay }: { delay: OperationalDelay }) {
  const typeColor = DELAY_TYPE_COLORS[delay.delay_type] || "var(--text-muted)";
  const statusColor = STATUS_COLORS[delay.status] || "var(--text-muted)";

  return (
    <GlassCard className="py-3">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Delay Type */}
          <span
            className="px-2 py-1 rounded text-xs font-medium text-[var(--bg-secondary)]"
            style={{ backgroundColor: typeColor }}
          >
            {delay.delay_type.replace("_", " ").toUpperCase()}
          </span>

          {/* Category */}
          {delay.category && (
            <span className="text-xs" style={{ color: delay.category.color }}>
              {delay.category.name}
            </span>
          )}

          {/* Status */}
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
            }}
          >
            {delay.status.toUpperCase()}
          </span>

          {/* Duration */}
          <span className="px-2 py-0.5 bg-accent-blue/10 text-accent-blue text-xs rounded-full">
            {delay.delay_minutes} min
          </span>

          {/* Time */}
          <span className="text-[var(--text-muted)] text-xs ml-auto">
            {formatTime(delay.created_at)}
          </span>
        </div>

        {/* Machine & Site */}
        {delay.machine &&
          (() => {
            const siteName = Array.isArray(delay.machine.sites)
              ? delay.machine.sites[0]?.name
              : delay.machine.sites?.name;
            return (
              <p className="text-[var(--text-muted)] text-xs flex items-center gap-2">
                <span>
                  Machine:{" "}
                  <span className="text-[var(--text-secondary)]">
                    {delay.machine.name}
                  </span>
                </span>
                {siteName && (
                  <>
                    <span className="text-[var(--border-emphasis)]">·</span>
                    <span className="text-[var(--accent-cyan)]">
                      {siteName}
                    </span>
                  </>
                )}
              </p>
            );
          })()}

        {/* Description */}
        <p className="text-[var(--text-heading)] text-sm">
          {delay.description}
        </p>

        {/* Impact */}
        {delay.impact_description && (
          <p className="text-sm">
            <span className="text-accent-blue">Impact:</span>{" "}
            <span className="text-[var(--text-secondary)]">
              {delay.impact_description}
            </span>
          </p>
        )}

        {/* Recovery */}
        {delay.recovery_action && (
          <p className="text-sm">
            <span className="text-[var(--accent-cyan)]">Recovery:</span>{" "}
            <span className="text-[var(--text-secondary)]">
              {delay.recovery_action}
            </span>
          </p>
        )}
      </div>
    </GlassCard>
  );
}
