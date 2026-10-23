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
    <GlassCard className="border border-[var(--border-subtle)] p-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-700">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-[var(--text-heading)] text-sm">
                Monthly Production Targets — {monthLabel}
              </h3>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                Pulled from /production
              </span>
            </div>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Live MTD progress against monthly ROM Coal and Overburden Waste targets
            </p>
          </div>
        </div>

        <div className="grid max-w-3xl flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
            <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
              Coal Target ({totals.coalTargetProgressPct}%)
            </div>
            <div className="mt-0.5 font-bold font-mono text-emerald-700 text-sm">
              {totals.coalTonnes.toLocaleString()} / {target.coal_target_tonnes.toLocaleString()} t
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
            <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
              Waste Target ({totals.wasteTargetProgressPct}%)
            </div>
            <div className="mt-0.5 font-bold font-mono text-blue-700 text-sm">
              {totals.wasteTonnes.toLocaleString()} / {target.waste_target_tonnes.toLocaleString()}{' '}
              t
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
            <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
              Bank Volume ({totals.bcmTargetProgressPct}%)
            </div>
            <div className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
              {totals.totalBcm.toLocaleString()} / {target.bcm_target.toLocaleString()} BCM
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5">
            <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
              Strip Ratio (W:C)
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
                {totals.stripRatio.toFixed(2)}:1
              </span>
              <Link
                href="/production"
                className="font-semibold text-[10px] text-[var(--accent-blue)] hover:underline"
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
