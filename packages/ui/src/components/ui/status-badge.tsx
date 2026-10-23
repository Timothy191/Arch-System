import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { STATUS_ICON_REGISTRY } from '../../icons/department-icons';
import { cn } from '../../lib/utils';

export type MachineOperationalStatus =
  | 'active'
  | 'online'
  | 'standby'
  | 'maintenance'
  | 'offline'
  | 'alert'
  | 'critical';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-xs transition-all duration-150',
  {
    variants: {
      status: {
        active:
          'border-[var(--accent-green)]/25 bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
        online:
          'border-[var(--accent-green)]/25 bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
        standby:
          'border-[var(--accent-amber)]/25 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]',
        maintenance:
          'border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
        offline: 'border-black/10 bg-black/5 text-[var(--text-secondary)]',
        alert:
          'border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/15 font-semibold text-[var(--accent-amber)]',
        critical:
          'animate-pulse border-[var(--accent-red)]/25 bg-[var(--accent-red)]/10 font-semibold text-[var(--accent-red)]',
      },
      size: {
        sm: 'gap-1 px-2 py-0.5 text-[10px]',
        md: 'gap-1.5 px-2.5 py-0.5 text-xs',
        lg: 'gap-2 px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      status: 'online',
      size: 'md',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: MachineOperationalStatus;
  label?: string;
  showIcon?: boolean;
  pulse?: boolean;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, size, label, showIcon = true, pulse = false, ...props }, ref) => {
    const Icon: LucideIcon = React.useMemo(() => {
      switch (status) {
        case 'active':
          return STATUS_ICON_REGISTRY.active;
        case 'online':
          return STATUS_ICON_REGISTRY.online;
        case 'standby':
          return STATUS_ICON_REGISTRY.standby;
        case 'maintenance':
          return STATUS_ICON_REGISTRY.maintenance;
        case 'offline':
          return STATUS_ICON_REGISTRY.offline;
        case 'alert':
          return STATUS_ICON_REGISTRY.warning;
        case 'critical':
          return STATUS_ICON_REGISTRY.critical;
        default:
          return STATUS_ICON_REGISTRY.info;
      }
    }, [status]);

    const formattedLabel = label ?? status.charAt(0).toUpperCase() + status.slice(1);

    return (
      <span
        ref={ref}
        role="status"
        aria-label={`Status: ${formattedLabel}`}
        className={cn(
          statusBadgeVariants({ status, size }),
          pulse && status === 'active' && 'relative',
          className
        )}
        {...props}
      >
        {showIcon && (
          <Icon
            className={cn(
              'shrink-0',
              size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'
            )}
            aria-hidden="true"
          />
        )}
        <span>{formattedLabel}</span>
      </span>
    );
  }
);
StatusBadge.displayName = 'StatusBadge';
