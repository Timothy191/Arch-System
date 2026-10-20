import { GlassCard } from '@repo/ui/GlassCard';
import { Target } from 'lucide-react';
import Link from 'next/link';
import { getProductionDepartmentData } from './actions';
import { ProductionCommandCenterClient } from './ProductionCommandCenterClient';

export async function ProductionDashboard({ deptId, month }: { deptId: string; month?: string }) {
  const initialData = await getProductionDepartmentData(month, deptId);

  return <ProductionCommandCenterClient initialData={initialData} deptId={deptId} />;
}

/**
 * Shared cross-department Monthly Production Target Banner so Control Room, Drilling,
 * and other departments automatically pull the monthly Coal & Waste targets set in Production.
 */
export async function MonthlyProductionTargetBanner() {
  const data = await getProductionDepartmentData();
  const { target, totals, monthLabel } = data;

  return (
    <GlassCard className="p-4 border border-[var(--border-subtle)]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/25">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--text-heading)]">
                Monthly Production Targets — {monthLabel}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                Pulled from /production
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Live MTD progress against monthly ROM Coal and Overburden Waste targets
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 max-w-3xl">
          <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
              Coal Target ({totals.coalTargetProgressPct}%)
            </div>
            <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
              {totals.coalTonnes.toLocaleString()} / {target.coal_target_tonnes.toLocaleString()} t
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
              Waste Target ({totals.wasteTargetProgressPct}%)
            </div>
            <div className="text-sm font-bold font-mono text-blue-700 mt-0.5">
              {totals.wasteTonnes.toLocaleString()} / {target.waste_target_tonnes.toLocaleString()}{' '}
              t
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
              Bank Volume ({totals.bcmTargetProgressPct}%)
            </div>
            <div className="text-sm font-bold font-mono text-[var(--text-heading)] mt-0.5">
              {totals.totalBcm.toLocaleString()} / {target.bcm_target.toLocaleString()} BCM
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
              Strip Ratio (W:C)
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-sm font-bold font-mono text-[var(--text-heading)]">
                {totals.stripRatio.toFixed(2)}:1
              </span>
              <Link
                href="/production"
                className="text-[10px] font-semibold text-[var(--accent-blue)] hover:underline"
              >
                Adjust →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
