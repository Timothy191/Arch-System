import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { STATUS_ICON_REGISTRY } from '../../icons/department-icons';
import { cn } from '../../lib/utils';

export interface ActivityTimelineItem {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  user?: {
    name: string;
    avatarUrl?: string;
    role?: string;
  };
  type?: 'create' | 'update' | 'delete' | 'warning' | 'audit' | 'status';
  status?: 'nominal' | 'warning' | 'critical' | 'info';
  icon?: React.ReactNode;
}

export interface ActivityTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  items: ActivityTimelineItem[];
  emptyMessage?: string;
}

export const ActivityTimeline = React.forwardRef<HTMLDivElement, ActivityTimelineProps>(
  ({ className, items, emptyMessage = 'No activity recorded.', ...props }, ref) => {
    if (!items || items.length === 0) {
      return (
        <div
          ref={ref}
          className={cn('p-6 text-center text-[var(--text-secondary)] text-xs italic', className)}
          {...props}
        >
          {emptyMessage}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role="feed"
        aria-label="Audit Activity Timeline"
        className={cn('relative space-y-6 pl-6', className)}
        {...props}
      >
        {/* Continuous vertical timeline connector line */}
        <div className="absolute top-2 bottom-2 left-2.5 w-px bg-black/[0.08]" aria-hidden="true" />

        {items.map((item, index) => {
          const statusIcon =
            item.status === 'warning'
              ? STATUS_ICON_REGISTRY.warning
              : item.status === 'critical'
                ? STATUS_ICON_REGISTRY.critical
                : STATUS_ICON_REGISTRY.confirmed;

          const StatusIconComponent: LucideIcon = statusIcon;

          return (
            <article
              key={item.id ?? index}
              className="group relative flex items-start gap-3 text-xs"
            >
              {/* Timeline bullet / icon node */}
              <div
                className={cn(
                  'absolute top-0.5 -left-6 z-10 flex h-5 w-5 items-center justify-center rounded-full border shadow-2xs transition-transform group-hover:scale-110',
                  item.status === 'critical'
                    ? 'border-[var(--accent-red)]/40 bg-[var(--accent-red)]/15 text-[var(--accent-red)]'
                    : item.status === 'warning'
                      ? 'border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]'
                      : 'border-black/10 bg-white text-[var(--accent-blue)]'
                )}
                aria-hidden="true"
              >
                {item.icon ?? <StatusIconComponent className="h-2.5 w-2.5" />}
              </div>

              {/* Timeline Item Content */}
              <div className="gold-steel-border gold-steel-border-slim min-w-0 flex-1 rounded-xl border border-black/[0.06] bg-white/70 p-3 shadow-2xs backdrop-blur-md transition-all group-hover:border-black/15">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h5 className="truncate font-semibold text-[13px] text-[var(--text-heading)]">
                    {item.title}
                  </h5>
                  <time
                    dateTime={item.timestamp}
                    className="shrink-0 font-mono text-[10px] text-[var(--text-secondary)]"
                  >
                    {item.timestamp}
                  </time>
                </div>

                {item.description && (
                  <p className="mt-0.5 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                )}

                {item.user && (
                  <div className="mt-2 flex items-center gap-1.5 border-black/[0.04] border-t pt-2 text-[11px] text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-heading)]">{item.user.name}</span>
                    {item.user.role && (
                      <span className="rounded bg-black/[0.04] px-1.5 py-0.2 font-mono text-[9.5px]">
                        {item.user.role}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  }
);
ActivityTimeline.displayName = 'ActivityTimeline';
