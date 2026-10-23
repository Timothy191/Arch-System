import { AutoAnimateList } from '@repo/ui/AnimatedList';
import { cn } from '@repo/ui/lib/utils';
import { AlertTriangle, Clock, Wrench } from 'lucide-react';
import Link from 'next/link';

export interface AlertEvent {
  id: string;
  type: 'incident' | 'breakdown' | 'offline';
  title: string;
  description?: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  href: string;
}

interface AlertTickerProps {
  events: AlertEvent[];
}

function timeAgo(dateString: string): string {
  // Supabase timestamps are UTC but may lack a Z suffix — force UTC parsing
  const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateString);
  const utcString = hasTz ? dateString : `${dateString}Z`;
  const date = new Date(utcString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return 'just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const severityConfig = {
  critical: {
    iconBg: 'bg-accent-red/10 text-accent-red',
    border: 'border-accent-red/20',
    dot: 'bg-accent-red',
    label: 'CRITICAL',
  },
  warning: {
    iconBg: 'bg-accent-amber/10 text-accent-amber',
    border: 'border-accent-amber/20',
    dot: 'bg-accent-amber',
    label: 'WARN',
  },
  info: {
    iconBg: 'bg-accent-blue/10 text-accent-blue',
    border: 'border-accent-blue/20',
    dot: 'bg-accent-blue',
    label: 'INFO',
  },
};

export function AlertTicker({ events }: AlertTickerProps) {
  if (events.length === 0) {
    return (
      <div className="flex w-fit items-center gap-2 rounded-full border border-accent-green/20 bg-accent-green/5 px-3.5 py-1.5 shadow-sm backdrop-blur-xl">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green" />
        <p className="font-medium text-accent-green text-xs">All systems operational</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'liquid-glass-light w-full overflow-hidden rounded-2xl border border-white/40 shadow-window'
      )}
    >
      <div className="flex items-center gap-2 border-white/20 border-b bg-white/10 px-4 py-2.5">
        <AlertTriangle className="h-3.5 w-3.5 text-accent-amber" />
        <span className="font-semibold text-arch-text-primary text-xs uppercase tracking-wider">
          Live Alerts
        </span>
        <span className="ml-auto font-mono text-[10px] text-arch-text-tertiary">
          {events.length} active
        </span>
      </div>

      <AutoAnimateList className="max-h-[220px] divide-y divide-arch-border-subtle/60 overflow-y-auto">
        {events.map((event) => {
          const config = severityConfig[event.severity];
          const Icon = event.type === 'breakdown' ? Wrench : AlertTriangle;

          return (
            <Link
              key={event.id}
              href={event.href}
              className={cn(
                'flex items-start gap-3 px-4 py-3',
                'transition-colors duration-150 hover:bg-arch-surface-secondary/50'
              )}
            >
              <div className={cn('mt-0.5 shrink-0 rounded-lg p-1.5', config.iconBg)}>
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="truncate font-medium text-arch-text-primary text-xs sm:text-sm">
                    {event.title}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 font-medium text-[9px] tracking-wider',
                      config.iconBg
                    )}
                  >
                    {config.label}
                  </span>
                </div>
                {event.description && (
                  <p className="mb-1 line-clamp-1 text-arch-text-secondary text-xs">
                    {event.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-arch-text-tertiary">
                  <Clock className="h-3 w-3" />
                  {timeAgo(event.timestamp)}
                </div>
              </div>
            </Link>
          );
        })}
      </AutoAnimateList>
    </div>
  );
}
