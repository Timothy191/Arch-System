import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { getPlantProcessingWorkspaceData } from '~/features/departments/components/plant-processing/actions';
import { PlantHourlySheetClient } from '~/features/departments/components/plant-processing/PlantHourlySheetClient';
import {
  MonthlyProductionTargetBanner,
  ProductionDashboard,
} from '~/features/departments/components/production/ProductionDashboard';
import { getDepartmentContext } from '~/lib/dept-context';
import { ControlRoomQuickNav } from '../control-room/components/ControlRoomQuickNav';
import { ControlRoomSummaryGridClient } from './ControlRoomSummaryGridClient';
import { NonControlRoomSummaryGridClient } from './NonControlRoomSummaryGridClient';

// AGENT-TRACE: ControlRoomWidgets consolidated dynamic island — co-locates all control-room
// specific widgets (ScadaPanel, AlertPanel, ActivityFeed, Checklist, ShiftCoverage) to prevent
// bundle fragmentation and reduce React reconciliation passes on non-control room pages.
const ControlRoomWidgets = dynamic(
  () => import('./ControlRoomWidgets').then((m) => m.ControlRoomWidgets),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
        <div className="h-96 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
          <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
        </div>
        <div className="h-[400px] animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
      </div>
    ),
  }
);

interface InventoryKpiMetric {
  id: string;
  label: string;
  value: string;
  capacityMeta: string;
  secondaryMeta: string;
  accent: 'blue' | 'green' | 'alert' | 'charcoal';
}

interface StockpileSiloBay {
  id: string;
  name: string;
  materialSpec: string;
  currentVolume: string;
  targetThreshold: string;
  levelPercent: number;
  status: 'Optimal' | 'Blending' | 'Reclaiming' | 'Replenish Soon';
}

interface CriticalWearSpare {
  id: string;
  partName: string;
  partCode: string;
  circuitZone: string;
  stockOnHand: number;
  reorderMin: number;
  unit: string;
  leadTimeDays: number;
}

const PLANT_INVENTORY_KPIS: readonly InventoryKpiMetric[] = [
  {
    id: 'rom-stockpile',
    label: 'ROM Stockpile Total',
    value: '42,850 t',
    capacityMeta: '71.4% Capacity',
    secondaryMeta: '+1,420 t shift delta',
    accent: 'blue',
  },
  {
    id: 'clean-coal-product',
    label: 'Clean Coal Product Stockpile',
    value: '18,640 t',
    capacityMeta: '62.1% Capacity',
    secondaryMeta: 'CV 27.4 MJ/kg',
    accent: 'green',
  },
  {
    id: 'magnetite-reserve',
    label: 'Magnetite Medium Reserve',
    value: '148.5 t',
    capacityMeta: 'Silo 1 & 2 Active',
    secondaryMeta: '0.68 kg/t consumption',
    accent: 'alert',
  },
  {
    id: 'reagent-autonomy',
    label: 'Flocculant & Reagent Autonomy',
    value: '14.2 Days',
    capacityMeta: 'Anionic Floc + Frother',
    secondaryMeta: 'All dosing skids nominal',
    accent: 'charcoal',
  },
];

const STOCKPILE_SILO_BAYS: readonly StockpileSiloBay[] = [
  {
    id: 'rom-pad-a',
    name: 'ROM Pad A - High Grade',
    materialSpec: 'Seam 4 Upper • Ash 16.2% • Sizings <300mm',
    currentVolume: '24,100 t / 30,000 t',
    targetThreshold: 'Min 12,000 t • Max 28,500 t',
    levelPercent: 80,
    status: 'Optimal',
  },
  {
    id: 'rom-pad-b',
    name: 'ROM Pad B - Blend',
    materialSpec: 'Seam 2 Mixed • Ash 22.8% • Feed Ratio 40%',
    currentVolume: '18,750 t / 30,000 t',
    targetThreshold: 'Min 10,000 t • Max 27,000 t',
    levelPercent: 63,
    status: 'Blending',
  },
  {
    id: 'product-north',
    name: 'Product Stockpile North',
    materialSpec: 'RB1 Export Thermal • CV 27.4 MJ/kg • H2O 8.1%',
    currentVolume: '18,640 t / 30,000 t',
    targetThreshold: 'Train Loadout Buffer: 15,000 t',
    levelPercent: 62,
    status: 'Reclaiming',
  },
  {
    id: 'magnetite-silo-1',
    name: 'Magnetite Bulk Silo #1',
    materialSpec: 'Superfine Grade 96% Fe3O4 • 45μm PSD',
    currentVolume: '86.0 t / 100.0 t',
    targetThreshold: 'Auto-transfer at 35.0 t',
    levelPercent: 86,
    status: 'Optimal',
  },
  {
    id: 'magnetite-silo-2',
    name: 'Magnetite Bulk Silo #2',
    materialSpec: 'Superfine Grade 96% Fe3O4 • 45μm PSD',
    currentVolume: '62.5 t / 100.0 t',
    targetThreshold: 'Refill trigger at 40.0 t',
    levelPercent: 63,
    status: 'Optimal',
  },
  {
    id: 'floc-tank-a',
    name: 'Flocculant Mix Tank A',
    materialSpec: 'SNF AN-934SH • 0.25% Solution Concentration',
    currentVolume: '14,800 L / 20,000 L',
    targetThreshold: 'Thickener Underflow Target: 1.32 SG',
    levelPercent: 74,
    status: 'Optimal',
  },
];

const CRITICAL_WEAR_SPARES: readonly CriticalWearSpare[] = [
  {
    id: 'jaw-toggle-plates',
    partName: 'Primary Jaw Toggle Plates',
    partCode: 'CR-JW-1104-TP',
    circuitZone: 'Primary Crushing Station',
    stockOnHand: 4,
    reorderMin: 2,
    unit: 'sets',
    leadTimeDays: 14,
  },
  {
    id: 'banana-screen-panels',
    partName: 'Banana Screen Polyurethane Panels (32mm)',
    partCode: 'SC-PU-305x610-32',
    circuitZone: 'Desliming & Sizing Deck',
    stockOnHand: 48,
    reorderMin: 36,
    unit: 'panels',
    leadTimeDays: 7,
  },
  {
    id: 'dmc-vortex-finders',
    partName: 'Dense Medium Cyclone Vortex Finders',
    partCode: 'DMC-850-VF-NI',
    circuitZone: 'Primary & Secondary DMC Module',
    stockOnHand: 2,
    reorderMin: 3,
    unit: 'units',
    leadTimeDays: 21,
  },
  {
    id: 'warman-impellers',
    partName: 'Warman 10/8 Slurry Pump Impellers',
    partCode: 'WP-10/8-AH-A05',
    circuitZone: 'Correct Medium & Tailings Transfer',
    stockOnHand: 3,
    reorderMin: 2,
    unit: 'units',
    leadTimeDays: 10,
  },
];

function PlantInventoryDashboard({ today }: { today: string }) {
  return (
    <ErrorBoundary context="Department Dashboard: plant-inventory">
      <div className="space-y-6">
        <GlassCard hover accent="charcoal">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-bold tracking-tight text-[var(--text-heading)]">
                  Plant Inventory &amp; Reagents Control
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--accent-blue)]">
                  CHPP Stockpiles &amp; Dense Medium
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Real-time ROM pad balances, washed product stockpiles, magnetite medium silos, and
                critical wear spares ledger.
              </p>
            </div>
            <div className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-lg self-start sm:self-auto">
              Operational Date:{' '}
              <span className="text-[var(--text-heading)] font-semibold">{today}</span>
            </div>
          </div>
        </GlassCard>

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANT_INVENTORY_KPIS.map((kpi) => (
            <GlassCard key={kpi.id} hover accent={kpi.accent}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {kpi.label}
              </p>
              <p className="text-2xl font-bold font-mono text-[var(--text-heading)] mt-1.5">
                {kpi.value}
              </p>
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--text-secondary)]">{kpi.capacityMeta}</span>
                <span className="font-mono text-[var(--accent-blue)]">{kpi.secondaryMeta}</span>
              </div>
            </GlassCard>
          ))}
        </div>

        <Divider variant="fading" />

        {/* Stockpile & Silo Bay Matrix */}
        <GlassCard>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-heading)]">
                Stockpile &amp; Silo Bay Matrix
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Live volumetric telemetry, quality specs, and automated feed/reclaim status across
                plant storage bays.
              </p>
            </div>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              6 Active Storage Bays Monitored
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {STOCKPILE_SILO_BAYS.map((bay) => (
              <div
                key={bay.id}
                className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-heading)]">{bay.name}</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{bay.materialSpec}</p>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] shrink-0">
                    {bay.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[var(--text-heading)]">
                      {bay.currentVolume}
                    </span>
                    <span className="font-mono text-[var(--accent-blue)]">{bay.levelPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden border border-[var(--border-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-blue)] transition-all duration-300"
                      style={{ width: `${bay.levelPercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">{bay.targetThreshold}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Critical Wear Spares & Screen Media Ledger */}
        <GlassCard>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-heading)]">
                Critical Wear Spares &amp; Screen Media Ledger
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                On-site CHPP mechanical stores stock-on-hand versus minimum reorder thresholds.
              </p>
            </div>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              Store Location: CHPP Main Bay #2
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2.5 pr-4">Component / Wear Part</th>
                  <th className="py-2.5 px-4">Circuit Zone</th>
                  <th className="py-2.5 px-4">Stock on Hand</th>
                  <th className="py-2.5 px-4">Reorder Min</th>
                  <th className="py-2.5 pl-4 text-right">Replenishment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                {CRITICAL_WEAR_SPARES.map((spare) => {
                  const isBelowMin = spare.stockOnHand < spare.reorderMin;
                  return (
                    <tr
                      key={spare.id}
                      className="hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[var(--text-heading)]">
                          {spare.partName}
                        </div>
                        <div className="text-xs font-mono text-[var(--text-muted)]">
                          {spare.partCode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {spare.circuitZone}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--text-heading)]">
                        {spare.stockOnHand} {spare.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[var(--text-muted)]">
                        {spare.reorderMin} {spare.unit}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            isBelowMin
                              ? 'bg-[var(--bg-tertiary)] border-[var(--accent-amber)] text-[var(--accent-amber)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--accent-green)]'
                          }`}
                        >
                          {isBelowMin
                            ? `Reorder Triggered (${spare.leadTimeDays}d lead)`
                            : 'Stock Healthy'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </ErrorBoundary>
  );
}

export default async function DepartmentDashboard({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  const { dept, deptId, today } = await getDepartmentContext({
    department: deptSlug,
  });

  if (deptSlug === 'plant-processing') {
    const plantData = await getPlantProcessingWorkspaceData(today);
    return (
      <PlantHourlySheetClient
        initialDate={plantData.currentDate}
        initialSheets={plantData.initialSheets}
        mode="dashboard"
      />
    );
  }

  if (deptSlug === 'plant-inventory') {
    return <PlantInventoryDashboard today={today} />;
  }

  if (deptSlug === 'production') {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-transparent">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-[var(--accent-blue)] rounded-full animate-spin" />
          </div>
        }
      >
        <ProductionDashboard deptId={deptId} />
      </Suspense>
    );
  }

  const isControlRoom = dept.type === 'control_room';

  return (
    // AGENT-TRACE: ErrorBoundary wraps entire dashboard for graceful degradation
    // Context helps identify which department/feature failed
    <ErrorBoundary context={`Department Dashboard: ${deptSlug}`}>
      <div className="space-y-6">
        {isControlRoom ? (
          <>
            <GlassCard hover accent="charcoal">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--text-heading)]">
                    Control Room Dashboard
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Live SCADA monitoring, production metrics, and shift dispatch.
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <ControlRoomQuickNav />
                  <p className="text-[var(--text-muted)] text-sm whitespace-nowrap">
                    {new Date().toLocaleDateString('en-ZA', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </GlassCard>

            <Divider variant="fading" />

            {/* Control Room Summary Grid - Client-side with React Query */}
            <Suspense
              fallback={
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                </div>
              }
            >
              <ControlRoomSummaryGridClient deptId={deptId} today={today} />
            </Suspense>

            {/* Cross-Department Monthly Coal & Waste Target Pulled from Production */}
            <Suspense
              fallback={<div className="h-20 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
            >
              <MonthlyProductionTargetBanner />
            </Suspense>

            {/* AGENT-TRACE: Quick Actions - UX improvements based on heuristics:
                 - Single primary action (machine operations) to reduce cognitive load
                 - Removed duplicate "Log Delay" button that went to same destination
                 - Clear visual hierarchy: primary (blue) vs secondary (outline) buttons
                 - Action labels are self-evident and match system capabilities
            */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${deptSlug}/machine-operations`}
                className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                Machine Operations
              </Link>
              <Link
                href={`/${deptSlug}/hourly-loads`}
                className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                Update Loads
              </Link>
            </div>

            {/* Consolidated Dynamic Control Room Widgets */}
            <ControlRoomWidgets deptId={deptId} deptSlug={deptSlug} today={today} />
          </>
        ) : (
          <>
            <GlassCard hover accent="charcoal">
              <h2 className="text-2xl font-bold text-[var(--text-heading)]">Dashboard</h2>
            </GlassCard>

            <Divider variant="fading" />

            {/* Non-Control Room Summary Grid - Client-side with React Query */}
            <Suspense
              fallback={
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                  <div className="h-28 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
                </div>
              }
            >
              <NonControlRoomSummaryGridClient deptId={deptId} today={today} />
            </Suspense>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
