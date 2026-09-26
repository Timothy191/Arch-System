import { cn } from '../lib/utils';
import { Clock } from './Clock';
import { EveLogo } from './EveLogo';

interface EveStatusBarProps {
  className?: string;
}

const STATUS_CHIPS = [
  { label: 'Portal Watch' },
  { label: 'Backend Ops' },
  { label: 'RFID Ingest' },
] as const;

/**
 * Combined Pill-shaped status bar for the eve agentic system and Arch OS.
 * Rendered below the login card.
 */
export function EveStatusBar({ className }: EveStatusBarProps) {
  return (
    <div
      data-testid="eve-status-bar"
      className={cn(
        'mt-6 w-[90%] max-w-3xl h-12 rounded-full bg-white/10 border border-white/20 backdrop-blur-md shadow-lg flex items-center justify-between px-6 liquid-glass-light z-50',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <EveLogo className="h-4 w-auto text-sky-800" />
          <span className="text-xs font-medium text-black">Arch OS</span>
        </div>

        <div className="h-4 w-[1px] bg-black/10 hidden sm:block" />

        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-black/70 truncate">
            eve agentic system
          </span>
          <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 shrink-0">
            ONLINE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-3 text-[9px] font-mono text-black/60 mr-2">
          {STATUS_CHIPS.map((chip) => (
            <div key={chip.label} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              <span>{chip.label}</span>
            </div>
          ))}
        </div>

        <div className="h-4 w-[1px] bg-black/10 hidden md:block" />

        <Clock testId="taskbar-clock" format="time" className="text-xs text-black/80 font-medium" />
      </div>
    </div>
  );
}
