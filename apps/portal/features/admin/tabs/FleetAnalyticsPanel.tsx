'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, CheckCircle2, Clock, Factory, Layers, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_MARGIN, paletteColor } from '@/app/hub/executive/chart-theme';
import type { FleetAnalyticsSummary } from './fleet-utils';

const KPI_CARD_BASE =
  'gold-steel-border gold-steel-border-slim cursor-pointer rounded-2xl border bg-white/85 px-4 py-3.5 text-left transition-all hover:bg-white';
const CHART_CARD_CLASS = 'gold-steel-border gold-steel-border-slim p-4';
const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  fontSize: 12,
} as const;

type StatusFilter = 'all' | 'active' | 'inactive';
type RightChartMode = 'manufacturer' | 'smr';

export function FleetAnalyticsPanel(options: {
  readonly analytics: FleetAnalyticsSummary;
  readonly statusFilter: StatusFilter;
  readonly selectedType: string;
  readonly selectedManufacturer: string;
  readonly onStatusFilterChange: (next: StatusFilter) => void;
  readonly onSelectType: (machineType: string) => void;
  readonly onSelectManufacturer: (manufacturer: string) => void;
}) {
  const {
    analytics,
    statusFilter,
    selectedType,
    selectedManufacturer,
    onStatusFilterChange,
    onSelectType,
    onSelectManufacturer,
  } = options;

  const [rightChartMode, setRightChartMode] = useState<RightChartMode>('manufacturer');

  return (
    <div className="space-y-4" data-testid="fleet-analytics-panel">
      {/* Interactive KPI Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onStatusFilterChange('all')}
          className={`${KPI_CARD_BASE} ${
            statusFilter === 'all'
              ? 'border-accent-gold/60 ring-1 ring-accent-gold/30'
              : 'border-[var(--border-default)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs">Total Fleet</span>
            <Layers className="h-4 w-4 text-accent-gold" aria-hidden="true" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
              {analytics.totalMachines}
            </span>
            <span className="font-mono text-[11px] text-accent-gold">
              {analytics.manufacturerCount} OEMs
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-[var(--accent-green)] transition-all"
              style={{ width: `${analytics.availabilityPercent}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange(statusFilter === 'active' ? 'all' : 'active')}
          className={`${KPI_CARD_BASE} ${
            statusFilter === 'active'
              ? 'border-[var(--accent-green)] ring-1 ring-[var(--accent-green)]/30'
              : 'border-[var(--border-default)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs">Active Fleet</span>
            <CheckCircle2 className="h-4 w-4 text-accent-green" aria-hidden="true" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-semibold text-2xl text-accent-green tabular-nums">
              {analytics.activeCount}
            </span>
            <span className="rounded-full bg-accent-green/10 px-2 py-0.5 font-mono text-[11px] text-accent-green">
              {analytics.availabilityPercent}% online
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Click to filter active machinery
          </p>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange(statusFilter === 'inactive' ? 'all' : 'inactive')}
          className={`${KPI_CARD_BASE} ${
            statusFilter === 'inactive'
              ? 'border-accent-amber ring-1 ring-accent-amber/30'
              : 'border-[var(--border-default)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs">Inactive / Exempt</span>
            <ShieldAlert className="h-4 w-4 text-accent-amber" aria-hidden="true" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
              {analytics.inactiveCount}
            </span>
            <span className="rounded-full bg-accent-amber/10 px-2 py-0.5 font-mono text-[11px] text-accent-amber">
              {analytics.exemptCount} exempt
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Click to inspect offline assets
          </p>
        </button>

        <div className="gold-steel-border gold-steel-border-slim rounded-2xl border border-[var(--border-default)] bg-white/85 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-muted)] text-xs">Fleet Starting SMR</span>
            <Clock className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
              {analytics.averageStartingSmr.toLocaleString('en-US', {
                maximumFractionDigits: 0,
              })}
              <span className="ml-1 font-normal text-[var(--text-muted)] text-xs">avg hrs</span>
            </span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              {analytics.missingSmrCount === 0
                ? '100% seeded'
                : `${analytics.missingSmrCount} unset`}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-[var(--text-muted)]">
            Total:{' '}
            {analytics.totalStartingSmr.toLocaleString('en-US', { maximumFractionDigits: 0 })} hrs
          </p>
        </div>
      </div>

      {/* Interactive Fleet Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard className={CHART_CARD_CLASS}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent-gold" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Fleet by Machine Type
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Click any bar to filter the fleet table
                </p>
              </div>
            </div>
            {selectedType && (
              <button
                type="button"
                onClick={() => onSelectType('')}
                className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 font-medium text-[11px] text-[var(--text-heading)]"
              >
                {selectedType} ×
              </button>
            )}
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...analytics.byType]}
                margin={{ ...CHART_MARGIN, bottom: 24 }}
                onClick={(state) => {
                  const clickedLabel = state?.activeLabel;
                  if (typeof clickedLabel === 'string' && clickedLabel) {
                    onSelectType(selectedType === clickedLabel ? '' : clickedLabel);
                  }
                }}
              >
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={44}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  width={32}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Units" radius={[6, 6, 0, 0]} className="cursor-pointer">
                  {analytics.byType.map((entry, idx) => (
                    <Cell
                      key={entry.label}
                      fill={selectedType === entry.label ? 'var(--accent-gold)' : paletteColor(idx)}
                      fillOpacity={!selectedType || selectedType === entry.label ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className={CHART_CARD_CLASS}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-accent-gold" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  {rightChartMode === 'manufacturer'
                    ? 'Manufacturer Distribution'
                    : 'Top Starting SMR Leaders'}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {rightChartMode === 'manufacturer'
                    ? 'Click an OEM pill or slice to filter'
                    : 'Highest baseline hour-meter machines'}
                </p>
              </div>
            </div>
            <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRightChartMode('manufacturer')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  rightChartMode === 'manufacturer'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-heading)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                OEM Mix
              </button>
              <button
                type="button"
                onClick={() => setRightChartMode('smr')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  rightChartMode === 'smr'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-heading)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                SMR Hours
              </button>
            </div>
          </div>

          {rightChartMode === 'manufacturer' ? (
            <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-12">
              <div className="h-52 sm:col-span-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[...analytics.byManufacturer]}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={44}
                      outerRadius={76}
                      paddingAngle={2}
                      onClick={(entry) => {
                        const mfgName = typeof entry?.name === 'string' ? entry.name : '';
                        if (mfgName) {
                          onSelectManufacturer(selectedManufacturer === mfgName ? '' : mfgName);
                        }
                      }}
                    >
                      {analytics.byManufacturer.map((entry, idx) => (
                        <Cell
                          key={entry.label}
                          fill={
                            selectedManufacturer === entry.label
                              ? 'var(--accent-gold)'
                              : paletteColor(idx)
                          }
                          fillOpacity={
                            !selectedManufacturer || selectedManufacturer === entry.label ? 1 : 0.35
                          }
                          className="cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:col-span-6">
                {analytics.byManufacturer.map((entry, idx) => {
                  const isActive = selectedManufacturer === entry.label;
                  return (
                    <button
                      key={entry.label}
                      type="button"
                      onClick={() => onSelectManufacturer(isActive ? '' : entry.label)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors ${
                        isActive
                          ? 'border-accent-gold bg-accent-gold/10 font-semibold text-[var(--text-heading)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-body)] hover:border-accent-gold/50'
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: paletteColor(idx) }}
                        aria-hidden="true"
                      />
                      <span>{entry.label}</span>
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {entry.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...analytics.topSmrLeaders]}
                  layout="vertical"
                  margin={CHART_MARGIN}
                >
                  <CartesianGrid
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="machineId"
                    tick={{ fill: 'var(--text-heading)', fontSize: 11 }}
                    width={64}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar
                    dataKey="startingSmr"
                    name="Starting SMR (hrs)"
                    fill="var(--accent-gold)"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
