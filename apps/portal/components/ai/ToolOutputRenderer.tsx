"use client";

/**
 * Formatted tool output renderer for the AI chat UI.
 * Replaces raw JSON.stringify with human-readable, department-specific formatting.
 */

import { ClipboardList, Clock, AlertTriangle } from "lucide-react";

interface ToolOutputProps {
  toolName: string;
  output: unknown;
}

function MachineStatusOutput({ output }: { output: Record<string, unknown> }) {
  const machines = (output.machines as Array<Record<string, unknown>>) ?? [];
  if (output.error) {
    return (
      <div className="flex items-center gap-2 text-arch-accent-red text-xs">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{String(output.error)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-arch-text-tertiary uppercase tracking-wider">
        Machine Status ({machines.length})
      </p>
      <div className="space-y-1">
        {machines.map((m, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-xs px-2 py-1 rounded bg-arch-surface-tertiary/50"
          >
            <span className="text-arch-text-primary font-medium">{String(m.name ?? "—")}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                m.active
                  ? "bg-accent-green/15 text-accent-green"
                  : "bg-accent-red/15 text-accent-red"
              }`}
            >
              {m.active ? "Active" : "Offline"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftLogsOutput({ output }: { output: Record<string, unknown> }) {
  const logs = (output.logs as Array<Record<string, unknown>>) ?? [];
  if (output.error) {
    return (
      <div className="flex items-center gap-2 text-arch-accent-red text-xs">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{String(output.error)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-arch-text-tertiary uppercase tracking-wider">
        Shift Logs ({logs.length})
      </p>
      <div className="space-y-1">
        {logs.map((log, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-arch-surface-tertiary/50"
          >
            <ClipboardList className="w-3 h-3 text-arch-accent-blue shrink-0" />
            <span className="text-arch-text-secondary">{String(log.log_date ?? "—")}</span>
            <span className="text-arch-text-tertiary">{String(log.shift ?? "—")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DelaysOutput({ output }: { output: Record<string, unknown> }) {
  const delays = (output.delays as Array<Record<string, unknown>>) ?? [];
  const totalMinutes = delays.reduce(
    (sum, d) => sum + (typeof d.delay_minutes === "number" ? d.delay_minutes : 0),
    0,
  );

  if (output.error) {
    return (
      <div className="flex items-center gap-2 text-arch-accent-red text-xs">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{String(output.error)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-arch-text-tertiary uppercase tracking-wider">
          Operational Delays
        </p>
        {totalMinutes > 0 && (
          <span className="text-[10px] text-arch-accent-blue font-semibold">
            {totalMinutes} min total
          </span>
        )}
      </div>
      <div className="space-y-1">
        {delays.map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-arch-surface-tertiary/50"
          >
            <Clock className="w-3 h-3 text-arch-accent-blue shrink-0" />
            <span className="text-arch-text-secondary">{String(d.reason ?? "—")}</span>
            <span className="text-arch-text-tertiary ml-auto">
              {typeof d.delay_minutes === "number" ? `${d.delay_minutes} min` : "—"}
            </span>
            <span
              className={`px-1 py-0.5 rounded text-[10px] font-semibold ${
                d.status === "active"
                  ? "bg-accent-red/15 text-accent-red"
                  : "bg-accent-green/15 text-accent-green"
              }`}
            >
              {String(d.status ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ToolOutputRenderer({ toolName, output }: ToolOutputProps) {
  const out = (output ?? {}) as Record<string, unknown>;

  if (toolName === "machineStatus") {
    return <MachineStatusOutput output={out} />;
  }
  if (toolName === "shiftLogs") {
    return <ShiftLogsOutput output={out} />;
  }
  if (toolName === "delays") {
    return <DelaysOutput output={out} />;
  }

  // Fallback for unknown tools
  return (
    <pre className="text-[10px] text-arch-text-tertiary overflow-x-auto">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}
