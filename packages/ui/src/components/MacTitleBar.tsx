'use client';

import { cn } from '../lib/utils';

interface MacTitleBarProps {
  title?: string;
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  rightSlot?: React.ReactNode;
}

export function MacTitleBar({
  title,
  className,
  onClose,
  onMinimize,
  onMaximize,
  rightSlot,
}: MacTitleBarProps) {
  return (
    <div
      className={cn(
        'group/titlebar flex h-11 items-center gap-3 px-4',
        'border-black/[0.06] border-b bg-white/50 backdrop-blur-sm',
        'shrink-0 select-none',
        className
      )}
    >
      {/* Traffic lights */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className="relative h-3 w-3 rounded-full border border-black/[0.06] bg-[var(--mac-close)] opacity-70 transition-opacity focus:outline-none group-hover/titlebar:opacity-100"
          aria-label="Close window"
        >
          <span className="absolute inset-0 flex items-center justify-center font-medium text-[7px] text-red-900/70 leading-none opacity-0 transition-opacity group-hover/titlebar:opacity-100">
            ×
          </span>
        </button>
        <button
          type="button"
          onClick={onMinimize}
          className="relative h-3 w-3 rounded-full border border-black/[0.06] bg-[var(--mac-minimize)] opacity-70 transition-opacity focus:outline-none group-hover/titlebar:opacity-100"
          aria-label="Minimize window"
        >
          <span className="absolute inset-0 flex items-center justify-center font-medium text-[7px] text-yellow-900/70 leading-none opacity-0 transition-opacity group-hover/titlebar:opacity-100">
            −
          </span>
        </button>
        <button
          type="button"
          onClick={onMaximize}
          className="relative h-3 w-3 rounded-full border border-black/[0.06] bg-[var(--mac-zoom)] opacity-70 transition-opacity focus:outline-none group-hover/titlebar:opacity-100"
          aria-label="Maximize window"
        >
          <span className="absolute inset-0 flex items-center justify-center font-medium text-[7px] text-green-900/70 leading-none opacity-0 transition-opacity group-hover/titlebar:opacity-100">
            +
          </span>
        </button>
      </div>

      {/* Centered title */}
      {title && (
        <span className="flex-1 truncate text-center font-semibold text-[13px] text-[var(--text-heading)]">
          {title}
        </span>
      )}

      {/* Right slot (e.g. toolbar buttons) */}
      {rightSlot && <div className="flex shrink-0 items-center gap-1.5">{rightSlot}</div>}

      {/* Empty spacer to balance title centering when no rightSlot */}
      {title && !rightSlot && <div className="w-[54px] shrink-0" />}
    </div>
  );
}
