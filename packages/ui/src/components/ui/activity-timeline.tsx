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
          className={cn('p-6 text-center text-xs text-[var(--text-secondary)] italic', className)}
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
        className={cn('relative pl-6 space-y-6', className)}
        {...props}
      >
        {/* Continuous vertical timeline connector line */}
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-black/[0.08]" aria-hidden="true" />

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
              className="relative flex items-start gap-3 group text-xs"
            >
              {/* Timeline bullet / icon node */}
              <div
                className={cn(
                  'absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border shadow-2xs z-10 transition-transform group-hover:scale-110',
                  item.status === 'critical'
                    ? 'bg-[var(--accent-red)]/15 border-[var(--accent-red)]/40 text-[var(--accent-red)]'
                    : item.status === 'warning'
                      ? 'bg-[var(--accent-amber)]/15 border-[var(--accent-amber)]/40 text-[var(--accent-amber)]'
                      : 'bg-white border-black/10 text-[var(--accent-blue)]'
                )}
                aria-hidden="true"
              >
                {item.icon ?? <StatusIconComponent className="w-2.5 h-2.5" />}
              </div>

              {/* Timeline Item Content */}
              <div className="flex-1 min-w-0 bg-white/70 backdrop-blur-md p-3 rounded-xl border border-black/[0.06] shadow-2xs group-hover:border-black/15 transition-all">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h5 className="font-semibold text-[13px] text-[var(--text-heading)] truncate">
                    {item.title}
                  </h5>
                  <time
                    dateTime={item.timestamp}
                    className="text-[10px] font-mono text-[var(--text-secondary)] shrink-0"
                  >
                    {item.timestamp}
                  </time>
                </div>

                {item.description && (
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
                    {item.description}
                  </p>
                )}

                {item.user && (
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-black/[0.04] text-[11px] text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-heading)]">{item.user.name}</span>
                    {item.user.role && (
                      <span className="px-1.5 py-0.2 rounded bg-black/[0.04] font-mono text-[9.5px]">
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
