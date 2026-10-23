import { AutoAnimateList } from '@repo/ui/AnimatedList';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  type LucideIcon,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import StatusBadge, { type AccessStatus } from '@/features/access-control/components/StatusBadge';

interface ActivityEntry {
  id: string;
  entityName: string;
  entityType: string;
  zone: string;
  status: string;
  time: string;
  qrId: string;
}

const statusIcons: Record<string, LucideIcon> = {
  Granted: CheckCircle2,
  Denied: XCircle,
  'Expired Credential': Clock,
  'Tailgate Alert': AlertTriangle,
};

const entityTypePill: Record<string, string> = {
  Employee: 'bg-primary/10 text-primary',
  Vehicle: 'bg-accent/10 text-accent',
  Equipment: 'bg-secondary text-secondary-foreground',
};

interface DashboardActivityFeedProps {
  activity: ActivityEntry[];
}

export default function DashboardActivityFeed({ activity }: DashboardActivityFeedProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-border border-b px-5 py-4">
        <div>
          <h2 className="font-bold text-foreground text-sm">Recent Access Events</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Last {activity.length} scan events across all zones
          </p>
        </div>
        <Link
          href="/access-control/access-logs"
          className="flex items-center gap-1 font-semibold text-primary text-xs transition-colors hover:text-primary/80"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <AutoAnimateList className="divide-y divide-border">
        {activity.map((entry) => {
          const StatusIcon = statusIcons[entry.status] ?? CheckCircle2;
          return (
            <div
              key={entry.id}
              className="group flex items-center gap-3 px-5 py-3 transition-colors duration-100 hover:bg-secondary/40"
            >
              <div className="shrink-0">
                <StatusIcon
                  size={16}
                  className={
                    entry.status === 'Granted'
                      ? 'text-success'
                      : entry.status === 'Denied' || entry.status === 'Expired Credential'
                        ? 'text-danger'
                        : 'text-warning'
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-foreground text-sm">
                    {entry.entityName}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-semibold text-[10px] ${entityTypePill[entry.entityType]}`}
                  >
                    {entry.entityType}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{entry.zone}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{entry.qrId}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={entry.status as AccessStatus} size="sm" />
                <span className="font-mono text-[10px] text-muted-foreground">{entry.time}</span>
              </div>
            </div>
          );
        })}
      </AutoAnimateList>
    </div>
  );
}
