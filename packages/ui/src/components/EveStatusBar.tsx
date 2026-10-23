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
        'liquid-glass-light z-50 mt-6 flex h-12 w-[90%] max-w-3xl items-center justify-between rounded-full border border-white/20 bg-white/10 px-6 shadow-lg backdrop-blur-md',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <EveLogo className="h-4 w-auto text-sky-800" />
          <span className="font-medium text-black text-xs">Arch OS</span>
        </div>

        <div className="hidden h-4 w-[1px] bg-black/10 sm:block" />

        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="truncate font-semibold text-[10px] text-black/70 tracking-wide">
            eve agentic system
          </span>
          <span className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-medium font-mono text-[9px] text-emerald-800">
            ONLINE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="mr-2 hidden items-center gap-3 font-mono text-[9px] text-black/60 md:flex">
          {STATUS_CHIPS.map((chip) => (
            <div key={chip.label} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
              <span>{chip.label}</span>
            </div>
          ))}
        </div>

        <div className="hidden h-4 w-[1px] bg-black/10 md:block" />

        <Clock testId="taskbar-clock" format="time" className="font-medium text-black/80 text-xs" />
      </div>
    </div>
  );
}
