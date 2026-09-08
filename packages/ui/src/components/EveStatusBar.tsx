import { cn } from "../lib/utils";
import { EveLogo } from "./EveLogo";

interface EveStatusBarProps {
  className?: string;
}

const STATUS_CHIPS = [
  { label: "Portal Watch" },
  { label: "Backend Ops" },
  { label: "RFID Ingest" },
] as const;

/**
 * Slim status strip for the eve agentic system, rendered below the login card.
 * Brand rule: the framework is always referred to as lowercase "eve".
 */
export function EveStatusBar({ className }: EveStatusBarProps) {
  return (
    <div
      data-testid="eve-status-bar"
      className={cn(
        "mt-3 px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-white/60 backdrop-blur-sm shadow-sm select-none",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-green)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-green)]" />
          </span>
          <EveLogo className="h-3.5 w-auto text-[var(--text-heading)] shrink-0" />
          <span className="text-[10px] font-semibold tracking-wide text-[var(--text-secondary)] truncate">
            eve agentic system
          </span>
        </div>
        <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-[var(--accent-green)]/10 text-[var(--text-secondary)] border border-[var(--border-subtle)] shrink-0">
          ONLINE
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 pt-2 text-[9px] font-mono text-[var(--text-muted)]">
        {STATUS_CHIPS.map((chip) => (
          <div
            key={chip.label}
            className="flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-white/50 border border-[var(--border-subtle)] text-center"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
            <span>{chip.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
