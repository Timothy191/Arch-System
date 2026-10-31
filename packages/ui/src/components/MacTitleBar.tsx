'use client';

import { cn } from '../lib/utils';
import { Logo } from './Logo';

interface MacTitleBarProps {
  title?: string;
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  rightSlot?: React.ReactNode;
}

export function MacTitleBar({ title, className, rightSlot }: MacTitleBarProps) {
  return (
    <div
      className={cn(
        'group/titlebar relative flex flex-col justify-center px-4 pt-2 pb-1.5',
        'border-black/[0.06] border-b bg-white/75 backdrop-blur-md',
        'shrink-0 select-none',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Arch Logo with Circle like used on the Login Page */}
        <div
          data-testid="mac-titlebar-arch-logo"
          className="gold-steel-border gold-steel-border-slim flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] shadow-2xs"
        >
          <Logo
            variant="gold"
            className="h-6 w-6 shrink-0 scale-110 text-[var(--accent-blue)] drop-shadow-xs"
          />
        </div>

        {/* Centered title + Golden Separator under header */}
        {title && (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
            <span className="max-w-full truncate text-center font-bold text-[13px] text-[var(--text-heading)] tracking-wide">
              {title}
            </span>
            <div
              data-testid="titlebar-golden-separator"
              aria-hidden="true"
              className="mt-1 flex w-28 items-center justify-center gap-1.5"
            >
              <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-r from-transparent via-[var(--accent-blue)] to-[var(--accent-blue)]" />
              <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] border border-[var(--accent-blue)] bg-[var(--accent-blue)]/40 shadow-2xs" />
              <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-l from-transparent via-[var(--accent-blue)] to-[var(--accent-blue)]" />
            </div>
          </div>
        )}

        {/* Right slot (e.g. toolbar buttons) */}
        {rightSlot && <div className="flex shrink-0 items-center gap-1.5">{rightSlot}</div>}

        {/* Empty spacer to balance title centering when no rightSlot */}
        {title && !rightSlot && <div className="w-8 shrink-0" />}
      </div>
    </div>
  );
}
