import { Car, ChevronRight, type LucideIcon, Users, Wrench } from 'lucide-react';
import { useMemo } from 'react';

interface EntityRow {
  type: string;
  total: number;
  active: number;
  expiring: number;
  expired: number;
}

interface DashboardEntityStatusProps {
  entityStatus: EntityRow[];
}

const typeToIcon: Record<string, LucideIcon> = {
  Employees: Users,
  Vehicles: Car,
  Equipment: Wrench,
};

export default function DashboardEntityStatus({ entityStatus }: DashboardEntityStatusProps) {
  // Optimization: Single-pass accumulation of entity totals to avoid 3 separate .reduce() traversals on render
  const summaryCards = useMemo(() => {
    let totalActive = 0;
    let totalExpiring = 0;
    let totalExpired = 0;

    for (const r of entityStatus) {
      totalActive += r.active;
      totalExpiring += r.expiring;
      totalExpired += r.expired;
    }

    return [
      {
        id: 'sum-active',
        label: 'Total Active',
        value: totalActive.toLocaleString(),
        color: 'text-success',
      },
      {
        id: 'sum-expiring',
        label: 'Expiring',
        value: totalExpiring.toLocaleString(),
        color: 'text-warning',
      },
      {
        id: 'sum-expired',
        label: 'Expired',
        value: totalExpired.toLocaleString(),
        color: 'text-danger',
      },
    ];
  }, [entityStatus]);

  return (
    <div className="h-full rounded-xl border border-border bg-card shadow-card">
      <div className="border-border border-b px-5 py-4">
        <h2 className="font-bold text-foreground text-sm">Entity QR Status</h2>
        <p className="mt-0.5 text-muted-foreground text-xs">Coverage across all entity types</p>
      </div>
      <div className="divide-y divide-border">
        {entityStatus.map((row) => {
          const Icon = typeToIcon[row.type] ?? Wrench;
          const coveragePct = row.total > 0 ? Math.round((row.active / row.total) * 100) : 0;
          return (
            <div
              key={row.type}
              className="group cursor-pointer px-5 py-4 transition-colors duration-100 hover:bg-secondary/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{row.type}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {row.total} total
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  className="text-muted-foreground transition-colors group-hover:text-foreground"
                />
              </div>
              <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500"
                  style={{ width: `${coveragePct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-semibold text-success tabular-nums">{row.active} active</span>
                <span className="text-warning tabular-nums">{row.expiring} expiring</span>
                <span className="text-danger tabular-nums">{row.expired} expired</span>
                <span className="font-bold text-foreground tabular-nums">{coveragePct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-border border-t px-5 py-4">
        <div className="grid grid-cols-3 gap-3">
          {summaryCards.map((s) => (
            <div key={s.id} className="text-center">
              <p className={`font-bold text-lg tabular-nums ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
