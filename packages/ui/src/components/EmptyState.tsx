import { cn } from '@repo/ui/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg p-8 text-center',
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-[var(--bg-tertiary)]/60 p-3">
          <Icon className="h-8 w-8 text-[var(--text-muted)]" />
        </div>
      )}
      <h3 className="mb-1 font-semibold text-[var(--text-heading)] text-fluid-lg">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-[var(--text-muted)] text-fluid-xs">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
