import { BarChart3, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';

export const CONTROL_ROOM_ACTIVE_SUBTAB_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim inline-flex items-center gap-2 rounded-lg border border-white/40 bg-[var(--accent-blue)]/15 px-3.5 py-1.5 font-semibold text-[var(--accent-blue)] text-xs shadow-diffusion-sm shadow-window backdrop-blur-md transition-all active:scale-95';

export const CONTROL_ROOM_INACTIVE_SUBTAB_CLASS =
  'inline-flex items-center gap-2 rounded-lg border border-transparent px-3.5 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-all hover:border-[var(--border-subtle)] hover:bg-black/[0.04] hover:text-[var(--accent-blue)]';

export interface ControlRoomSubtabsProps {
  readonly departmentSlug?: string;
  readonly activeTab: 'scada' | 'shift-operations';
  readonly borderTop?: boolean;
}

export function ControlRoomSubtabs({
  departmentSlug = 'control-room',
  activeTab,
  borderTop = true,
}: ControlRoomSubtabsProps) {
  return (
    <div
      aria-label="Control Room Dashboard Sub-tabs"
      className={
        borderTop
          ? 'mt-4 flex flex-wrap items-center gap-2 border-[var(--border-subtle)]/60 border-t pt-3'
          : 'flex flex-wrap items-center gap-2'
      }
    >
      <Link
        href={`/${departmentSlug}`}
        aria-current={activeTab === 'scada' ? 'page' : undefined}
        className={
          activeTab === 'scada'
            ? CONTROL_ROOM_ACTIVE_SUBTAB_CLASS
            : CONTROL_ROOM_INACTIVE_SUBTAB_CLASS
        }
      >
        <BarChart3 className="h-3.5 w-3.5" />
        <span>SCADA Dashboard</span>
      </Link>
      <Link
        href={`/${departmentSlug}/shift-compilation`}
        aria-current={activeTab === 'shift-operations' ? 'page' : undefined}
        className={
          activeTab === 'shift-operations'
            ? CONTROL_ROOM_ACTIVE_SUBTAB_CLASS
            : CONTROL_ROOM_INACTIVE_SUBTAB_CLASS
        }
      >
        <ClipboardCheck className="h-3.5 w-3.5" />
        <span>Shift Operations</span>
      </Link>
    </div>
  );
}
