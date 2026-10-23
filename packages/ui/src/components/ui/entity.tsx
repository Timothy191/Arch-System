import type React from 'react';
import { cn } from '../../lib/utils';

export interface EntityProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  thumbnail?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Entity({
  thumbnail,
  title,
  description,
  actions,
  className,
  ...props
}: EntityProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm',
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-4">
        {thumbnail && <div className="flex-shrink-0">{thumbnail}</div>}
        <div className="flex min-w-0 flex-col">
          <div className="truncate font-medium text-base">{title}</div>
          {description && (
            <div className="truncate text-muted-foreground text-sm">{description}</div>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
