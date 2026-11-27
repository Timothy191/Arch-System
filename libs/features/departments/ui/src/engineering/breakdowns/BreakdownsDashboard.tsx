'use client';

import {
  EngineeringHydraulicWrenchIcon,
  EngineeringReliabilityPulseIcon,
  EngineeringWorkshopBayIcon,
} from '@repo/ui/engineering-icons';
import { GoldenPanel, type GoldenPanelHeaderItem } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutDashboard, LogIn, LogOut, Search, SlidersHorizontal, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { BookInForm } from './BookInForm';
import { BookOutForm } from './BookOutForm';
import { BreakdownStats } from './BreakdownStats';
import { BreakdownsTable } from './BreakdownsTable';
import type {
  Breakdown,
  BreakdownDiagnosticResult,
  BreakdownMetrics,
  Machine,
  MTBFDataPoint,
  ServiceTrigger,
} from './types';

const BreakdownCharts = dynamic(() => import('./BreakdownCharts').then((m) => m.BreakdownCharts), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-card bg-white/60" />,
});

type Tab = 'overview' | 'bookin' | 'bookout' | 'query';

interface BreakdownsDashboardProps {
  departmentId: string;
  breakdowns: Breakdown[];
  metrics: BreakdownMetrics;
  machines: Machine[];
  onSearchDiagnostics?: (
    query: string
  ) => Promise<{ success: boolean; data?: BreakdownDiagnosticResult[]; error?: string }>;
}

const TAB_BAR_SHELL_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim flex flex-wrap gap-1.5 rounded-card border border-white/35 bg-[var(--material-regular)] p-1.5 shadow-diffusion-sm backdrop-blur-md';

const TAB_BTN_BASE_CLASS =
  'relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60';

const DRAWER_STAT_CARD_CLASS =
  'rounded-xl border border-[var(--accent-gold-border)] bg-white/90 p-3 shadow-2xs';

export function BreakdownsDashboard({
  departmentId,
  breakdowns,
  metrics,
  machines,
}: BreakdownsDashboardProps) {
  const prefersReduced = useReducedMotion();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [activeHeaderItemId, setActiveHeaderItemId] = useState<string | null>(null);
  const [mttrTargetHours, setMttrTargetHours] = useState<number>(4);

  // #7 Removed 'AI Diagnostics' tab per design feedback
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'bookin' as const, label: 'Book In', icon: LogIn },
    { id: 'bookout' as const, label: 'Book Out', icon: LogOut },
    { id: 'query' as const, label: 'Query Data', icon: Search },
  ];

  const activeBreakdowns = useMemo(
    () => breakdowns.filter((b) => b.status === 'active'),
    [breakdowns]
  );

  // AGENT-TRACE: Dynamic computation of MTBF and automated preventative service triggers
  const { mtbfData, serviceTriggers } = useMemo(() => {
    const categoryMap = new Map<
      string,
      { totalRepairHours: number; repairCount: number; failureCount: number; dates: number[] }
    >();
    const machineFailureCount = new Map<string, { count: number; name: string; type: string }>();

    for (const b of breakdowns) {
      const mKey = b.fleet_id || b.machine_name || 'Unknown';
      const existingM = machineFailureCount.get(mKey) || {
        count: 0,
        name: b.machine_name || b.fleet_id,
        type: b.machine_type,
      };
      existingM.count += 1;
      machineFailureCount.set(mKey, existingM);

      const cat = b.machine_type || 'General Equipment';
      const existing = categoryMap.get(cat) || {
        totalRepairHours: 0,
        repairCount: 0,
        failureCount: 0,
        dates: [],
      };

      existing.failureCount += 1;
      if (b.date_in) {
        existing.dates.push(new Date(b.date_in).getTime());
      }

      if (b.status === 'completed' && b.date_out && b.time_out && b.date_in && b.time_in) {
        const start = new Date(`${b.date_in}T${b.time_in}`).getTime();
        const end = new Date(`${b.date_out}T${b.time_out}`).getTime();
        const hrs = (end - start) / 3600000;
        if (hrs > 0 && hrs < 240) {
          existing.totalRepairHours += hrs;
          existing.repairCount += 1;
        }
      }

      categoryMap.set(cat, existing);
    }

    const calculatedMtbf: MTBFDataPoint[] = Array.from(categoryMap.entries()).map(([cat, data]) => {
      const avgMttr = data.repairCount > 0 ? data.totalRepairHours / data.repairCount : 4.5;
      const estimatedMtbf =
        data.failureCount > 0 ? Math.max(35, Math.round((720 / data.failureCount) * 10) / 10) : 180;
      return {
        category: cat,
        mttrHours: Math.round(avgMttr * 10) / 10,
        mtbfHours: estimatedMtbf,
        failureCount: data.failureCount,
      };
    });

    const triggers: ServiceTrigger[] = [];
    for (const [mId, mData] of machineFailureCount.entries()) {
      if (mData.count >= 2) {
        triggers.push({
          id: `trigger-${mId}`,
          machine_name: mData.name,
          machine_type: mData.type,
          trigger_type: mData.count >= 4 ? 'failure_frequency' : 'mtbf_threshold',
          severity: mData.count >= 4 ? 'high' : 'medium',
          reason: `${mData.count} breakdowns logged recently (${mData.type})`,
          metric_value: `Freq: ${mData.count} events`,
          recommended_action: 'Schedule 250h Full Bay Overhaul',
        });
      }
    }

    return { mtbfData: calculatedMtbf, serviceTriggers: triggers };
  }, [breakdowns]);

  const fleetAvailabilityPct =
    machines.length > 0
      ? Math.max(
          0,
          Math.round(((machines.length - activeBreakdowns.length) / machines.length) * 100)
        )
      : 100;

  // #6 Interactive animated header panel items
  const headerItems: readonly GoldenPanelHeaderItem[] = [
    {
      id: 'fleet-pulse',
      label: 'Fleet Health Pulse',
      icon: <EngineeringReliabilityPulseIcon className="h-3.5 w-3.5 text-accent-gold" />,
      badge: `${fleetAvailabilityPct}%`,
      panelContent: (
        <div
          data-testid="breakdown-header-pulse-panel"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div className={DRAWER_STAT_CARD_CLASS}>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Operational Readiness
            </p>
            <p className="mt-1 font-bold text-emerald-700 text-lg tabular-nums">
              {fleetAvailabilityPct}% Available
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {Math.max(0, machines.length - activeBreakdowns.length)} of {machines.length} active
              machines ready
            </p>
          </div>
          <div className={DRAWER_STAT_CARD_CLASS}>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Preventative Alerts
            </p>
            <p className="mt-1 font-bold text-[var(--text-heading)] text-lg tabular-nums">
              {serviceTriggers.length} Flagged Units
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Automated 250h bay overhaul triggers
            </p>
          </div>
          <div className={DRAWER_STAT_CARD_CLASS}>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Quick Bay Action
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('bookin');
                  setActiveHeaderItemId(null);
                }}
                className="rounded-lg bg-[var(--accent-charcoal)] px-3 py-1.5 font-semibold text-white text-xs transition-opacity hover:opacity-90"
              >
                Open Book-In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('bookout');
                  setActiveHeaderItemId(null);
                }}
                className="rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]"
              >
                Open Book-Out
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'bay-thresholds',
      label: 'SLA Configuration',
      icon: <SlidersHorizontal className="h-3.5 w-3.5 text-dept-engineering" />,
      badge: `${mttrTargetHours}h`,
      panelContent: (
        <div
          data-testid="breakdown-header-sla-panel"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-[var(--text-heading)] text-xs">
              Target Workshop MTTR SLA Threshold
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Current fleet average repair time is {metrics.avgRepairHours.toFixed(1)}h vs{' '}
              {mttrTargetHours}h target SLA.
            </p>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="MTTR target hours">
            {[2, 4, 6, 8].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setMttrTargetHours(hrs)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 font-mono font-semibold text-xs transition-colors',
                  mttrTargetHours === hrs
                    ? 'border-[var(--accent-gold)] bg-[var(--accent-gold-subtle)] text-[var(--text-heading)]'
                    : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                )}
              >
                {hrs}h SLA
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* #6 Interactive Animated Header GoldenPanel */}
      <GoldenPanel
        variant="elevated"
        showLogo
        headingLevel="h2"
        title="Breakdown Management"
        subtitle="Track machine breakdowns, book-in/out and monitor fleet health."
        icon={<EngineeringWorkshopBayIcon className="h-6 w-6 text-dept-engineering" />}
        headerItems={headerItems}
        activeHeaderItemId={activeHeaderItemId}
        onSelectHeaderItem={setActiveHeaderItemId}
        statusBadge={
          activeBreakdowns.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/12 px-2.5 py-0.5 font-semibold text-rose-800 text-xs">
              <Zap className="h-3.5 w-3.5 text-rose-700" aria-hidden="true" />
              {activeBreakdowns.length} Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-0.5 font-semibold text-emerald-800 text-xs">
              <EngineeringHydraulicWrenchIcon className="h-3.5 w-3.5 text-emerald-700" />
              All Bays Clear
            </span>
          )
        }
      />

      {/* #9 Golden-Bordered Tab Navigation Bar (with #7 AI Diagnostics removed) */}
      <div className={TAB_BAR_SHELL_CLASS} role="tablist" aria-label="Breakdown workflow views">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                TAB_BTN_BASE_CLASS,
                isActive
                  ? 'text-[var(--text-heading)]'
                  : 'text-[var(--text-secondary)] hover:bg-white/60 hover:text-[var(--text-heading)]'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="breakdowns-active-tab-pill"
                  transition={
                    prefersReduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 420, damping: 34 }
                  }
                  className="gold-steel-border gold-steel-border-slim absolute inset-0 -z-10 rounded-xl border border-[var(--accent-gold-border)] bg-white shadow-card"
                />
              )}
              <Icon
                className={cn(
                  'h-4 w-4',
                  isActive ? 'text-accent-gold' : 'text-[var(--text-muted)]'
                )}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
              {tab.id === 'bookout' && activeBreakdowns.length > 0 && (
                <span className="ml-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 font-mono font-semibold text-rose-800 text-xs">
                  {activeBreakdowns.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <BreakdownStats metrics={metrics} />

              <BreakdownCharts
                statusData={[
                  {
                    name: 'Operational',
                    value: metrics.active === 0 ? 100 : Math.max(0, 100 - metrics.active),
                  },
                  { name: 'Broken Down', value: metrics.active },
                ]}
                mtbfData={mtbfData}
                serviceTriggers={serviceTriggers}
              />

              {/* #12 & #13 Standalone 'Active Breakdowns' h3 & 'No records found.' removed */}
              <BreakdownsTable breakdowns={activeBreakdowns} showStatus={false} />
            </div>
          )}

          {activeTab === 'bookin' && (
            <BookInForm
              departmentId={departmentId}
              activeBreakdowns={activeBreakdowns}
              machines={machines}
            />
          )}

          {activeTab === 'bookout' && (
            <BookOutForm departmentId={departmentId} activeBreakdowns={activeBreakdowns} />
          )}

          {activeTab === 'query' && <BreakdownsTable breakdowns={breakdowns} showStatus={true} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
