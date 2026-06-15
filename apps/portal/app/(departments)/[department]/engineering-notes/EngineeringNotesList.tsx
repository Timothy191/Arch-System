import { GlassCard } from "@repo/ui/GlassCard";

interface EngineeringNote {
  id: string;
  shift_type: "day" | "night";
  issue_type: string;
  severity: "low" | "medium" | "high" | "critical";
  machine_id: string | null;
  description: string;
  action_taken: string | null;
  requires_follow_up: boolean;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  machine?: {
    name: string;
    sites?: { name: string }[] | { name: string } | null;
  } | null;
}

interface EngineeringNotesListProps {
  notes: EngineeringNote[];
}

const ISSUE_TYPE_COLORS: Record<string, string> = {
  mechanical: "#1c1c1e",
  electrical: "#27272a",
  structural: "#3f3f46",
  hydraulic: "#52525b",
  other: "#71717a",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#71717a",
  high: "#ef4444",
  critical: "#dc2626",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#1c1c1e",
  in_progress: "#27272a",
  resolved: "#10b981",
  closed: "#71717a",
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EngineeringNotesList({ notes }: EngineeringNotesListProps) {
  if (notes.length === 0) {
    return (
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm text-center py-8">
          No engineering issues logged today.
        </p>
      </GlassCard>
    );
  }

  // Group by shift
  const dayNotes = notes.filter((n) => n.shift_type === "day");
  const nightNotes = notes.filter((n) => n.shift_type === "night");

  return (
    <div className="space-y-4">
      {dayNotes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-accent-blue flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-blue"></span>
            Day Shift
          </h4>
          <div className="space-y-2">
            {dayNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}

      {nightNotes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-accent-blue flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-blue"></span>
            Night Shift
          </h4>
          <div className="space-y-2">
            {nightNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note }: { note: EngineeringNote }) {
  const issueColor = ISSUE_TYPE_COLORS[note.issue_type] || "var(--text-muted)";
  const severityColor = SEVERITY_COLORS[note.severity] || "var(--text-muted)";
  const statusColor = STATUS_COLORS[note.status] || "var(--text-muted)";

  return (
    <GlassCard
      className={`py-3 ${note.severity === "critical" ? "border-accent-red/30" : ""}`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Issue Type */}
          <span
            className="px-2 py-1 rounded text-xs font-medium text-[var(--bg-secondary)]"
            style={{ backgroundColor: issueColor }}
          >
            {note.issue_type.charAt(0).toUpperCase() + note.issue_type.slice(1)}
          </span>

          {/* Severity */}
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: `${severityColor}20`,
              color: severityColor,
              border: `1px solid ${severityColor}40`,
            }}
          >
            {note.severity.toUpperCase()}
          </span>

          {/* Status */}
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
            }}
          >
            {note.status.replace("_", " ").toUpperCase()}
          </span>

          {/* Machine & Site */}
          {note.machine &&
            (() => {
              const siteName = Array.isArray(note.machine!.sites)
                ? note.machine!.sites[0]?.name
                : (note.machine!.sites as { name: string } | null | undefined)
                    ?.name;
              return (
                <span className="text-[var(--text-muted)] text-xs flex items-center gap-1.5">
                  {note.machine!.name}
                  {siteName && (
                    <>
                      <span className="text-[var(--border-emphasis)]">·</span>
                      <span className="text-[var(--accent-cyan)]">
                        {siteName}
                      </span>
                    </>
                  )}
                </span>
              );
            })()}

          {/* Time */}
          <span className="text-[var(--text-muted)] text-xs ml-auto">
            {formatTime(note.created_at)}
          </span>
        </div>

        {/* Description */}
        <p className="text-[var(--text-heading)] text-sm">{note.description}</p>

        {/* Action Taken */}
        {note.action_taken && (
          <div className="text-sm">
            <span className="text-[var(--accent-cyan)]">Action:</span>{" "}
            <span className="text-[var(--text-secondary)]">
              {note.action_taken}
            </span>
          </div>
        )}

        {/* Follow-up Flag */}
        {note.requires_follow_up && (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-blue"></span>
            <span className="text-accent-blue text-xs">Follow-up required</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
