'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Gauge,
  History,
  Layers,
  type LucideIcon,
  Moon,
  RotateCcw,
  Search,
  ShieldCheck,
  Sun,
  TrendingDown,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ALL_FILTER,
  buildPlantInventoryAnalytics,
  type CategoryHealthSummary,
  type EnrichedPlantStockItem,
  type EquipmentAnalyticsSummary,
  filterPlantInventoryItems,
  PLANT_INVENTORY_CATEGORIES,
  type PlantHealthTone,
  type PlantInventoryAnalytics,
  type PlantInventoryStatusFilter,
  resolveHealthTone,
} from './plant-inventory-analytics';
import { downloadPlantInventoryCsv, downloadPlantInventoryPdf } from './plant-inventory-export';
import {
  formatQty,
  getStockStatusBadgeClass,
  type PlantInventoryStockItem,
  type PlantInventoryUsageEntry,
} from './plant-inventory-seeds';

// ── Constants ────────────────────────────────────────────────────────────────

const FULL_PCT = 100;
const MAX_AUDIT_LOG_ROWS = 8;
const MAX_TOP_CONSUMERS = 4;
const REPLENISHMENT_COLUMN_COUNT = 5;
const CONSUMPTION_COLUMN_COUNT = 5;
const AUDIT_LOG_COLUMN_COUNT = 6;
const REPORTS_DASHBOARD_HREF = '/plant-inventory/reports';
const REPORTS_PDF_HREF = '/plant-inventory/reports?tab=pdf-report';
const FULL_HISTORY_HREF = '/plant-inventory/tools';
const ALL_EQUIPMENT_SCOPE_LABEL = 'All Plant Equipment';
const NO_FILTER_LABEL = 'All stock lines';

const STATUS_FILTER_OPTIONS: readonly {
  readonly statusValue: PlantInventoryStatusFilter;
  readonly label: string;
}[] = [
  { statusValue: 'ALL', label: 'All Statuses' },
  { statusValue: 'BELOW_PAR', label: 'Below Par' },
  { statusValue: 'CRITICAL_OR_OOS', label: 'Critical / Out of Stock' },
  { statusValue: 'NOMINAL', label: 'Nominal & Surplus' },
];

const STATUS_FILTER_LABELS: Record<PlantInventoryStatusFilter, string> = {
  ALL: 'All Statuses',
  BELOW_PAR: 'Below Par',
  CRITICAL_OR_OOS: 'Critical / Out of Stock',
  NOMINAL: 'Nominal & Surplus',
};

const TONE_BAR_CLASS: Record<PlantHealthTone, string> = {
  healthy: 'bg-[var(--accent-green)]',
  watch: 'bg-[var(--accent-amber)]',
  critical: 'bg-[var(--accent-alert)]',
};

const TONE_TEXT_CLASS: Record<PlantHealthTone, string> = {
  healthy: 'text-[var(--accent-green)]',
  watch: 'text-[var(--accent-amber)]',
  critical: 'text-[var(--accent-alert)]',
};

const TONE_BADGE_CLASS: Record<PlantHealthTone, string> = {
  healthy:
    'rounded-full border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 px-2 py-0.5 font-semibold text-[11px] text-[var(--accent-green)]',
  watch:
    'rounded-full border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 px-2 py-0.5 font-semibold text-[11px] text-[var(--accent-amber)]',
  critical:
    'rounded-full border border-[var(--accent-alert)]/30 bg-[var(--accent-alert)]/10 px-2 py-0.5 font-semibold text-[11px] text-[var(--accent-alert)]',
};

const TONE_LABELS: Record<PlantHealthTone, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  critical: 'Critical',
};

// ── Shared class strings ─────────────────────────────────────────────────────

const SECTION_CARD_CLASS = 'overflow-hidden p-0';
const SECTION_HEADER_CLASS =
  'flex flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-b px-5 py-4';
const SECTION_TITLE_CLASS =
  'flex items-center gap-2 font-bold text-[var(--text-heading)] text-base';
const SECTION_SUBTITLE_CLASS = 'text-[var(--text-muted)] text-xs';
const TABLE_HEAD_ROW_CLASS = 'border-[var(--border-default)] border-b bg-[var(--bg-secondary)]';
const TH_CLASS =
  'whitespace-nowrap px-4 py-3 font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider';
const TH_RIGHT_CLASS = `${TH_CLASS} text-right`;
const TBODY_CLASS = 'divide-y divide-[var(--border-default)]';
const TR_CLASS = 'transition-colors hover:bg-[var(--bg-secondary)]/60';
const TD_CLASS = 'px-4 py-3 align-top text-[var(--text-secondary)] text-sm';
const TD_PRIMARY_CLASS = 'px-4 py-3 align-top font-semibold text-[var(--text-heading)] text-sm';
const TD_MONO_RIGHT_CLASS =
  'whitespace-nowrap px-4 py-3 text-right align-top font-mono text-[var(--text-heading)] text-sm';
const TD_EMPTY_CLASS = 'px-4 py-8 text-center text-[var(--text-muted)] text-sm';
const CODE_TEXT_CLASS = 'font-mono text-[11px] text-[var(--text-muted)]';
const PROGRESS_TRACK_CLASS = 'h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]';
const PROGRESS_FILL_CLASS = 'h-full rounded-full transition-all duration-500';
const PILL_BASE_CLASS =
  'rounded-full border px-3 py-1 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40';
const PILL_ACTIVE_CLASS =
  'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white shadow-sm';
const PILL_IDLE_CLASS =
  'border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/50';
const FIELD_CLASS =
  'h-9 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none';
const PRIMARY_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-2 font-semibold text-white text-xs shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3.5 py-2 font-semibold text-[var(--text-heading)] text-xs shadow-sm transition-colors hover:bg-[var(--bg-secondary)]';
const RESTOCK_BUTTON_CLASS =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[var(--accent-green)]/40 bg-[var(--accent-green)]/10 px-2.5 py-1 font-semibold text-[11px] text-[var(--accent-green)] transition-colors hover:bg-[var(--accent-green)]/20';
const SEGMENT_BASE_CLASS =
  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold text-xs transition-colors';
const SEGMENT_ACTIVE_CLASS = `${SEGMENT_BASE_CLASS} bg-[var(--bg-primary)] text-[var(--accent-blue)] shadow-sm`;
const SEGMENT_IDLE_CLASS = `${SEGMENT_BASE_CLASS} text-[var(--text-secondary)] hover:text-[var(--text-heading)]`;
const KPI_LABEL_CLASS =
  'font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider';
const KPI_VALUE_CLASS = 'mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]';
const KPI_DETAIL_CLASS =
  'flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]';
const ICON_SM_CLASS = 'h-4 w-4';
const ICON_XS_CLASS = 'h-3.5 w-3.5';
const LINK_CLASS =
  'inline-flex items-center gap-1 font-semibold text-[var(--accent-blue)] text-xs hover:underline';

// ── Helpers ──────────────────────────────────────────────────────────────────

function clampPct(rawPct: number): number {
  if (!Number.isFinite(rawPct)) return 0;
  return Math.min(FULL_PCT, Math.max(0, rawPct));
}

function sharePct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * FULL_PCT);
}

function cx(...classNames: readonly (string | false | undefined)[]): string {
  return classNames.filter(Boolean).join(' ');
}

function buildFilterLabel(filters: ReportFilterState): string {
  const parts = [
    filters.category !== ALL_FILTER ? `Category: ${filters.category}` : '',
    filters.equipment !== ALL_FILTER ? `Equipment: ${filters.equipment}` : '',
    filters.statusFilter !== 'ALL' ? `Status: ${STATUS_FILTER_LABELS[filters.statusFilter]}` : '',
    filters.query.trim() ? `Search: "${filters.query.trim()}"` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : NO_FILTER_LABEL;
}

function sortUsageNewestFirst(
  usageEntries: readonly PlantInventoryUsageEntry[]
): PlantInventoryUsageEntry[] {
  return [...usageEntries].sort((left, right) => right.date.localeCompare(left.date));
}

// ── Filter state hook ────────────────────────────────────────────────────────

interface ReportFilterState {
  readonly query: string;
  readonly category: string;
  readonly equipment: string;
  readonly statusFilter: PlantInventoryStatusFilter;
}

const DEFAULT_FILTERS: ReportFilterState = {
  query: '',
  category: ALL_FILTER,
  equipment: ALL_FILTER,
  statusFilter: 'ALL',
};

interface ReportFilterControls {
  readonly filters: ReportFilterState;
  readonly isFiltered: boolean;
  readonly updateFilters: (patch: Partial<ReportFilterState>) => void;
  readonly resetFilters: () => void;
}

function useReportFilters(): ReportFilterControls {
  const [filters, setFilters] = useState<ReportFilterState>(DEFAULT_FILTERS);
  const isFiltered =
    filters.query.trim() !== '' ||
    filters.category !== ALL_FILTER ||
    filters.equipment !== ALL_FILTER ||
    filters.statusFilter !== 'ALL';
  return {
    filters,
    isFiltered,
    updateFilters: (patch) => setFilters((previous) => ({ ...previous, ...patch })),
    resetFilters: () => setFilters(DEFAULT_FILTERS),
  };
}

interface ReportModel {
  readonly analytics: PlantInventoryAnalytics;
  readonly filteredUsage: readonly PlantInventoryUsageEntry[];
  readonly equipmentOptions: readonly string[];
}

function useReportModel(options: {
  readonly filters: ReportFilterState;
  readonly stockItems: readonly PlantInventoryStockItem[];
  readonly usageHistory: readonly PlantInventoryUsageEntry[];
}): ReportModel {
  const { filters, stockItems, usageHistory } = options;
  const equipmentOptions = useMemo(
    () => [...new Set(stockItems.map((stockItem) => stockItem.plantEquipment))].sort(),
    [stockItems]
  );
  const filteredItems = useMemo(
    () => filterPlantInventoryItems(stockItems, filters),
    [stockItems, filters]
  );
  const filteredUsage = useMemo(
    () =>
      filters.equipment === ALL_FILTER
        ? usageHistory
        : usageHistory.filter((entry) => entry.plantEquipment === filters.equipment),
    [usageHistory, filters.equipment]
  );
  const analytics = useMemo(
    () => buildPlantInventoryAnalytics({ stockItems: filteredItems, usageHistory: filteredUsage }),
    [filteredItems, filteredUsage]
  );
  return { analytics, filteredUsage, equipmentOptions };
}

// ── Primitive sub-components ─────────────────────────────────────────────────

function ProgressBar({
  pct,
  label,
  fillClassName,
}: {
  pct: number;
  label: string;
  fillClassName: string;
}) {
  const boundedPct = clampPct(pct);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(boundedPct)}
      aria-valuemin={0}
      aria-valuemax={FULL_PCT}
      className={PROGRESS_TRACK_CLASS}
    >
      <div className={cx(PROGRESS_FILL_CLASS, fillClassName)} style={{ width: `${boundedPct}%` }} />
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={SECTION_HEADER_CLASS}>
      <div>
        <h3 className={SECTION_TITLE_CLASS}>
          <Icon className={cx(ICON_SM_CLASS, iconClassName)} aria-hidden="true" />
          {title}
        </h3>
        <p className={SECTION_SUBTITLE_CLASS}>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={TD_EMPTY_CLASS}>
        <span className="inline-flex items-center gap-2 font-medium text-[var(--accent-green)]">
          <CheckCircle2 className={ICON_SM_CLASS} aria-hidden="true" />
          {message}
        </span>
      </td>
    </tr>
  );
}

// ── 1. Command header ────────────────────────────────────────────────────────

function ReportTabsNav() {
  return (
    <nav
      aria-label="Report views"
      className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1"
    >
      <Link href={REPORTS_DASHBOARD_HREF} aria-current="page" className={SEGMENT_ACTIVE_CLASS}>
        <BarChart3 className={ICON_XS_CLASS} aria-hidden="true" />
        Dashboard
      </Link>
      <Link href={REPORTS_PDF_HREF} className={SEGMENT_IDLE_CLASS}>
        <FileSpreadsheet className={ICON_XS_CLASS} aria-hidden="true" />
        PDF Report
      </Link>
    </nav>
  );
}

function CommandHeader({
  today,
  isPdfPending,
  onExportCsv,
  onDownloadPdf,
}: {
  today: string;
  isPdfPending: boolean;
  onExportCsv: () => void;
  onDownloadPdf: () => void;
}) {
  return (
    <GlassCard variant="window" className="p-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div className="space-y-1.5">
          <p className="font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-[0.18em]">
            PLANT INVENTORY · EXECUTIVE ANALYTICS
          </p>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Reports</h2>
          <p className="max-w-2xl text-[var(--text-secondary)] text-sm">
            Par compliance, replenishment demand, and equipment consumption intelligence across Day
            and Night shifts.
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
            <CalendarDays className={ICON_XS_CLASS} aria-hidden="true" />
            Operational Date:
            <span className="font-semibold text-[var(--text-heading)]">{today}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportTabsNav />
          <button type="button" onClick={onExportCsv} className={SECONDARY_BUTTON_CLASS}>
            <FileSpreadsheet className={ICON_XS_CLASS} aria-hidden="true" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={isPdfPending}
            className={PRIMARY_BUTTON_CLASS}
          >
            <Download className={ICON_XS_CLASS} aria-hidden="true" />
            {isPdfPending ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

// ── 2. Filter bar ────────────────────────────────────────────────────────────

function CategoryPills({
  activeCategory,
  onSelect,
}: {
  activeCategory: string;
  onSelect: (category: string) => void;
}) {
  const categories = [ALL_FILTER, ...PLANT_INVENTORY_CATEGORIES];
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">Filter by category</legend>
      {categories.map((category) => {
        const isActive = category === activeCategory;
        return (
          <button
            key={category}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(category)}
            className={cx(PILL_BASE_CLASS, isActive ? PILL_ACTIVE_CLASS : PILL_IDLE_CLASS)}
          >
            {category === ALL_FILTER ? 'All' : category}
          </button>
        );
      })}
    </fieldset>
  );
}

function FilterSelects({
  controls,
  equipmentOptions,
}: {
  controls: ReportFilterControls;
  equipmentOptions: readonly string[];
}) {
  const { filters, updateFilters } = controls;
  return (
    <>
      <select
        aria-label="Filter by equipment"
        value={filters.equipment}
        onChange={(event) => updateFilters({ equipment: event.target.value })}
        className={FIELD_CLASS}
      >
        <option value={ALL_FILTER}>All Equipment</option>
        {equipmentOptions.map((equipment) => (
          <option key={equipment} value={equipment}>
            {equipment}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by status"
        value={filters.statusFilter}
        onChange={(event) =>
          updateFilters({ statusFilter: event.target.value as PlantInventoryStatusFilter })
        }
        className={FIELD_CLASS}
      >
        {STATUS_FILTER_OPTIONS.map((option) => (
          <option key={option.statusValue} value={option.statusValue}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}

function FilterBar({
  controls,
  equipmentOptions,
  shownCount,
  totalCount,
}: {
  controls: ReportFilterControls;
  equipmentOptions: readonly string[];
  shownCount: number;
  totalCount: number;
}) {
  const { filters, isFiltered, updateFilters, resetFilters } = controls;
  return (
    <GlassCard className="space-y-3 p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search reports"
            placeholder="Search stock, code, description, or equipment…"
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
            className={cx(FIELD_CLASS, 'w-full pl-9')}
          />
        </div>
        <FilterSelects controls={controls} equipmentOptions={equipmentOptions} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CategoryPills
          activeCategory={filters.category}
          onSelect={(category) => updateFilters({ category })}
        />
        <div className="flex items-center gap-3">
          <p aria-live="polite" className="font-medium text-[var(--text-muted)] text-xs">
            Showing {shownCount} of {totalCount} stock lines
          </p>
          {isFiltered && (
            <button type="button" onClick={resetFilters} className={LINK_CLASS}>
              <RotateCcw className={ICON_XS_CLASS} aria-hidden="true" />
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ── 3. KPI cards ─────────────────────────────────────────────────────────────

interface KpiCardSpec {
  readonly label: string;
  readonly valueText: string;
  readonly icon: LucideIcon;
  readonly tone: PlantHealthTone;
  readonly progressPct: number;
  readonly progressLabel: string;
  readonly detail: React.ReactNode;
}

function KpiCard({ spec }: { spec: KpiCardSpec }) {
  const Icon = spec.icon;
  return (
    <GlassCard className="flex flex-col justify-between gap-3 p-4">
      <div>
        <div className="flex items-center justify-between">
          <span className={KPI_LABEL_CLASS}>{spec.label}</span>
          <Icon className={cx(ICON_SM_CLASS, TONE_TEXT_CLASS[spec.tone])} aria-hidden="true" />
        </div>
        <p className={KPI_VALUE_CLASS}>{spec.valueText}</p>
      </div>
      <div className="space-y-1.5">
        <ProgressBar
          pct={spec.progressPct}
          label={spec.progressLabel}
          fillClassName={TONE_BAR_CLASS[spec.tone]}
        />
        <div className={KPI_DETAIL_CLASS}>{spec.detail}</div>
      </div>
    </GlassCard>
  );
}

function buildStockKpis(analytics: PlantInventoryAnalytics): KpiCardSpec[] {
  const replenishCount = analytics.belowParCount - analytics.criticalOrOosCount;
  const belowParPct = sharePct(analytics.belowParCount, analytics.totalLines);
  return [
    {
      label: 'Par Compliance',
      valueText: `${analytics.parCompliancePct}%`,
      icon: ShieldCheck,
      tone: resolveHealthTone(analytics.parCompliancePct),
      progressPct: analytics.parCompliancePct,
      progressLabel: 'Par compliance percentage',
      detail: (
        <span>
          {analytics.nominalCount}/{analytics.totalLines} lines at par
        </span>
      ),
    },
    {
      label: 'Average Coverage',
      valueText: `${analytics.avgCoveragePct}%`,
      icon: Gauge,
      tone: resolveHealthTone(analytics.avgCoveragePct),
      progressPct: analytics.avgCoveragePct,
      progressLabel: 'Average stock coverage percentage',
      detail: <span>Capped at 100% per stock line</span>,
    },
    {
      label: 'Replenishment Alerts',
      valueText: String(analytics.belowParCount),
      icon: AlertTriangle,
      tone: analytics.criticalOrOosCount > 0 ? 'critical' : 'healthy',
      progressPct: belowParPct,
      progressLabel: 'Share of stock lines below par',
      detail: (
        <>
          <span className="text-[var(--accent-alert)]">
            {analytics.criticalOrOosCount} critical
          </span>
          <span>{replenishCount} replenish</span>
        </>
      ),
    },
  ];
}

function buildOperationsKpis(analytics: PlantInventoryAnalytics): KpiCardSpec[] {
  const atRiskPct = sharePct(analytics.equipmentAtRiskCount, analytics.trackedEquipmentCount);
  return [
    {
      label: 'Tracked Equipment',
      valueText: String(analytics.trackedEquipmentCount),
      icon: Wrench,
      tone: analytics.equipmentAtRiskCount > 0 ? 'watch' : 'healthy',
      progressPct: atRiskPct,
      progressLabel: 'Share of tracked equipment at risk',
      detail: <span>{analytics.equipmentAtRiskCount} at risk</span>,
    },
    {
      label: 'Shift Drawdowns',
      valueText: String(analytics.totalUsageEntries),
      icon: Activity,
      tone: 'healthy',
      progressPct: analytics.dayShiftPct,
      progressLabel: 'Day shift share of drawdowns',
      detail: (
        <>
          <span>Day {analytics.dayShiftEntries}</span>
          <span>Night {analytics.nightShiftEntries}</span>
        </>
      ),
    },
  ];
}

function KpiGrid({ analytics }: { analytics: PlantInventoryAnalytics }) {
  const specs = [...buildStockKpis(analytics), ...buildOperationsKpis(analytics)];
  return (
    <section
      aria-label="Key performance indicators"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {specs.map((spec) => (
        <KpiCard key={spec.label} spec={spec} />
      ))}
    </section>
  );
}

// ── 4. Intelligence row ──────────────────────────────────────────────────────

function CategoryHealthRow({ summary }: { summary: CategoryHealthSummary }) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[var(--text-heading)] text-sm">{summary.category}</span>
        <span className={TONE_BADGE_CLASS[summary.healthTone]}>
          {TONE_LABELS[summary.healthTone]}
        </span>
      </div>
      <ProgressBar
        pct={summary.avgCoveragePct}
        label={`${summary.category} average coverage`}
        fillClassName={TONE_BAR_CLASS[summary.healthTone]}
      />
      <div className={KPI_DETAIL_CLASS}>
        <span>
          {summary.nominalLines}/{summary.totalLines} at par · {summary.criticalLines} critical
        </span>
        <span className="font-mono">{summary.avgCoveragePct}%</span>
      </div>
    </li>
  );
}

function CategoryHealthPanel({ summaries }: { summaries: readonly CategoryHealthSummary[] }) {
  return (
    <GlassCard className={SECTION_CARD_CLASS}>
      <SectionHeader
        icon={Layers}
        iconClassName="text-[var(--accent-blue)]"
        title="Stock Health by Category"
        subtitle="Average capped coverage per category, weakest first"
      />
      <ul className="space-y-4 p-5">
        {summaries.map((summary) => (
          <CategoryHealthRow key={summary.category} summary={summary} />
        ))}
        {summaries.length === 0 && (
          <li className="text-center text-[var(--text-muted)] text-sm">
            No stock lines match the current filters.
          </li>
        )}
      </ul>
    </GlassCard>
  );
}

function ShiftRatioBar({ analytics }: { analytics: PlantInventoryAnalytics }) {
  const nightPct = analytics.totalUsageEntries > 0 ? FULL_PCT - analytics.dayShiftPct : 0;
  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-label="Day versus night shift drawdown ratio"
        aria-valuenow={Math.round(analytics.dayShiftPct)}
        aria-valuemin={0}
        aria-valuemax={FULL_PCT}
        className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]"
      >
        <div
          className="h-full bg-[var(--accent-amber)]"
          style={{ width: `${analytics.dayShiftPct}%` }}
        />
        <div className="h-full bg-[var(--accent-indigo)]" style={{ width: `${nightPct}%` }} />
      </div>
      <div className={KPI_DETAIL_CLASS}>
        <span className="inline-flex items-center gap-1">
          <Sun className={ICON_XS_CLASS} aria-hidden="true" />
          Day {analytics.dayShiftEntries} ({analytics.dayShiftPct}%)
        </span>
        <span className="inline-flex items-center gap-1">
          <Moon className={ICON_XS_CLASS} aria-hidden="true" />
          Night {analytics.nightShiftEntries} ({nightPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

function TopConsumerRow({ summary }: { summary: EquipmentAnalyticsSummary }) {
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-[var(--text-heading)]">{summary.equipment}</span>
        <span className="font-mono text-[var(--text-muted)]">{summary.usageCount} entries</span>
      </div>
      <ProgressBar
        pct={summary.shareOfMaxPct}
        label={`${summary.equipment} consumption share`}
        fillClassName="bg-[var(--accent-blue)]"
      />
    </li>
  );
}

function ShiftConsumptionPanel({ analytics }: { analytics: PlantInventoryAnalytics }) {
  const topConsumers = [...analytics.equipmentSummaries]
    .filter((summary) => summary.usageCount > 0)
    .sort((left, right) => right.usageCount - left.usageCount)
    .slice(0, MAX_TOP_CONSUMERS);
  return (
    <GlassCard className={SECTION_CARD_CLASS}>
      <SectionHeader
        icon={Activity}
        iconClassName="text-[var(--accent-blue)]"
        title="Shift Consumption Split"
        subtitle="Day versus Night drawdown entries and top consuming equipment"
      />
      <div className="space-y-5 p-5">
        <ShiftRatioBar analytics={analytics} />
        <div className="space-y-3">
          <p className={KPI_LABEL_CLASS}>Top Consuming Equipment</p>
          <ul className="space-y-3">
            {topConsumers.map((summary) => (
              <TopConsumerRow key={summary.equipment} summary={summary} />
            ))}
          </ul>
          {topConsumers.length === 0 && (
            <p className={SECTION_SUBTITLE_CLASS}>No drawdowns recorded for this scope.</p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ── 5. Tables ────────────────────────────────────────────────────────────────

function ReplenishmentRow({
  stockItem,
  onRestockItem,
}: {
  stockItem: EnrichedPlantStockItem;
  onRestockItem: (itemId: string) => void;
}) {
  const { flags } = stockItem;
  const tone = resolveHealthTone(flags.coveragePct);
  return (
    <tr className={TR_CLASS}>
      <td className={TD_PRIMARY_CLASS}>
        <div>{stockItem.stock}</div>
        <div className={CODE_TEXT_CLASS}>
          {stockItem.code} · {stockItem.category}
        </div>
      </td>
      <td className={TD_CLASS}>{stockItem.plantEquipment}</td>
      <td className={cx(TD_CLASS, 'min-w-36')}>
        <div className="mb-1 font-mono text-[var(--text-heading)] text-xs">
          {formatQty(stockItem.amountPresent)} / {formatQty(stockItem.amountRequired)}{' '}
          {stockItem.unit}
        </div>
        <ProgressBar
          pct={flags.coveragePct}
          label={`${stockItem.stock} coverage`}
          fillClassName={TONE_BAR_CLASS[tone]}
        />
      </td>
      <td className={TD_MONO_RIGHT_CLASS}>
        <div className="font-bold text-[var(--accent-alert)]">
          -{formatQty(flags.shortfallAmount)} {stockItem.unit}
        </div>
        <span className={getStockStatusBadgeClass(flags.stockStatus)}>{flags.statusLabel}</span>
      </td>
      <td className="px-4 py-3 text-right align-top">
        <button
          type="button"
          aria-label={`Mark Restocked ${stockItem.stock}`}
          onClick={() => onRestockItem(stockItem.id)}
          className={RESTOCK_BUTTON_CLASS}
        >
          <CheckCircle2 className={ICON_XS_CLASS} aria-hidden="true" />
          Mark Restocked
        </button>
      </td>
    </tr>
  );
}

function ReplenishmentTable({
  items,
  onRestockItem,
}: {
  items: readonly EnrichedPlantStockItem[];
  onRestockItem: (itemId: string) => void;
}) {
  return (
    <GlassCard className={SECTION_CARD_CLASS}>
      <SectionHeader
        icon={AlertTriangle}
        iconClassName="text-[var(--accent-alert)]"
        title="Replenishment Demand Report"
        subtitle="Prioritized by severity, coverage, and shortfall"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left" aria-label="Replenishment Demand Report">
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              <th scope="col" className={TH_CLASS}>
                Stock
              </th>
              <th scope="col" className={TH_CLASS}>
                Plant Equipment
              </th>
              <th scope="col" className={TH_CLASS}>
                Present / Required
              </th>
              <th scope="col" className={TH_RIGHT_CLASS}>
                Shortfall
              </th>
              <th scope="col" className={TH_RIGHT_CLASS}>
                Action
              </th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {items.map((stockItem) => (
              <ReplenishmentRow
                key={stockItem.id}
                stockItem={stockItem}
                onRestockItem={onRestockItem}
              />
            ))}
            {items.length === 0 && (
              <EmptyRow
                colSpan={REPLENISHMENT_COLUMN_COUNT}
                message="All filtered stock lines meet par quantities."
              />
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function ConsumptionRow({ summary }: { summary: EquipmentAnalyticsSummary }) {
  const tone: PlantHealthTone = summary.belowParCount > 0 ? 'critical' : 'healthy';
  return (
    <tr className={TR_CLASS}>
      <td className={TD_PRIMARY_CLASS}>{summary.equipment}</td>
      <td className={TD_MONO_RIGHT_CLASS}>{summary.stockLines}</td>
      <td className={TD_MONO_RIGHT_CLASS}>{summary.usageCount}</td>
      <td className="px-4 py-3 text-right align-top">
        <span className={TONE_BADGE_CLASS[tone]}>{summary.belowParCount} below par</span>
      </td>
      <td className={cx(TD_CLASS, 'min-w-28')}>
        <ProgressBar
          pct={summary.shareOfMaxPct}
          label={`${summary.equipment} activity`}
          fillClassName="bg-[var(--accent-blue)]"
        />
      </td>
    </tr>
  );
}

function ConsumptionTable({ summaries }: { summaries: readonly EquipmentAnalyticsSummary[] }) {
  return (
    <GlassCard className={SECTION_CARD_CLASS}>
      <SectionHeader
        icon={TrendingDown}
        iconClassName="text-[var(--accent-blue)]"
        title="Consumption by Plant Equipment"
        subtitle="Stock lines, drawdown activity, and par health per asset"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left" aria-label="Consumption by Plant Equipment">
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              <th scope="col" className={TH_CLASS}>
                Plant Equipment
              </th>
              <th scope="col" className={TH_RIGHT_CLASS}>
                Stock Lines
              </th>
              <th scope="col" className={TH_RIGHT_CLASS}>
                Drawdown Entries
              </th>
              <th scope="col" className={TH_RIGHT_CLASS}>
                Health
              </th>
              <th scope="col" className={TH_CLASS}>
                Activity
              </th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {summaries.map((summary) => (
              <ConsumptionRow key={summary.equipment} summary={summary} />
            ))}
            {summaries.length === 0 && (
              <EmptyRow
                colSpan={CONSUMPTION_COLUMN_COUNT}
                message="No plant equipment activity matches the current filters."
              />
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ── 6. Audit log ─────────────────────────────────────────────────────────────

function AuditLogRow({ entry }: { entry: PlantInventoryUsageEntry }) {
  const ShiftIcon = entry.shift === 'Day' ? Sun : Moon;
  return (
    <tr className={TR_CLASS}>
      <td className={cx(TD_CLASS, 'whitespace-nowrap font-mono')}>{entry.date}</td>
      <td className={TD_CLASS}>
        <span className="inline-flex items-center gap-1">
          <ShiftIcon className={ICON_XS_CLASS} aria-hidden="true" />
          {entry.shift}
        </span>
      </td>
      <td className={TD_PRIMARY_CLASS}>
        <div>{entry.stock}</div>
        <div className="font-normal text-[var(--text-muted)] text-xs">{entry.description}</div>
      </td>
      <td className={TD_CLASS}>{entry.plantEquipment}</td>
      <td className={TD_MONO_RIGHT_CLASS}>
        {formatQty(entry.amountUsed)} {entry.unit}
      </td>
      <td className={TD_CLASS}>{entry.loggedBy}</td>
    </tr>
  );
}

function AuditLogTable({ usageEntries }: { usageEntries: readonly PlantInventoryUsageEntry[] }) {
  const recentEntries = sortUsageNewestFirst(usageEntries).slice(0, MAX_AUDIT_LOG_ROWS);
  return (
    <GlassCard className={SECTION_CARD_CLASS}>
      <SectionHeader
        icon={History}
        iconClassName="text-[var(--accent-blue)]"
        title="Recent Shift Consumption Audit Log"
        subtitle={`Latest ${MAX_AUDIT_LOG_ROWS} drawdowns for the selected equipment scope`}
        action={
          <Link href={FULL_HISTORY_HREF} className={LINK_CLASS}>
            Open Full History
          </Link>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left" aria-label="Recent Shift Consumption Audit Log">
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              <th scope="col" className={TH_CLASS}>
                Date
              </th>
              <th scope="col" className={TH_CLASS}>
                Shift
              </th>
              <th scope="col" className={TH_CLASS}>
                Stock
              </th>
              <th scope="col" className={TH_CLASS}>
                Plant Equipment
              </th>
              <th scope="col" className={TH_RIGHT_CLASS}>
                Amount Used
              </th>
              <th scope="col" className={TH_CLASS}>
                Logged By
              </th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {recentEntries.map((entry) => (
              <AuditLogRow key={entry.id} entry={entry} />
            ))}
            {recentEntries.length === 0 && (
              <EmptyRow
                colSpan={AUDIT_LOG_COLUMN_COUNT}
                message="No consumption entries recorded for the selected equipment."
              />
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ── Export actions ───────────────────────────────────────────────────────────

function useReportExports(options: {
  readonly today: string;
  readonly filters: ReportFilterState;
  readonly model: ReportModel;
}) {
  const { today, filters, model } = options;
  const [isPdfPending, setIsPdfPending] = useState(false);

  const handleExportCsv = () => {
    downloadPlantInventoryCsv({ items: model.analytics.enrichedItems, today });
  };

  const handleDownloadPdf = async () => {
    setIsPdfPending(true);
    try {
      await downloadPlantInventoryPdf({
        today,
        scopeLabel:
          filters.equipment === ALL_FILTER ? ALL_EQUIPMENT_SCOPE_LABEL : filters.equipment,
        filterLabel: buildFilterLabel(filters),
        analytics: model.analytics,
        usageHistory: model.filteredUsage,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      toast.error(`Plant Inventory PDF export failed (${reason}).`);
    } finally {
      setIsPdfPending(false);
    }
  };

  return { isPdfPending, handleExportCsv, handleDownloadPdf };
}

// ── Root component ───────────────────────────────────────────────────────────

export function PlantInventoryReportsDashboard({
  today,
  stockItems,
  usageHistory,
  onRestockItem,
}: {
  today: string;
  stockItems: readonly PlantInventoryStockItem[];
  usageHistory: readonly PlantInventoryUsageEntry[];
  onRestockItem: (itemId: string) => void;
}) {
  const controls = useReportFilters();
  const model = useReportModel({ filters: controls.filters, stockItems, usageHistory });
  const exports = useReportExports({ today, filters: controls.filters, model });
  const { analytics } = model;

  return (
    <div className="space-y-6">
      <CommandHeader
        today={today}
        isPdfPending={exports.isPdfPending}
        onExportCsv={exports.handleExportCsv}
        onDownloadPdf={() => void exports.handleDownloadPdf()}
      />
      <FilterBar
        controls={controls}
        equipmentOptions={model.equipmentOptions}
        shownCount={analytics.totalLines}
        totalCount={stockItems.length}
      />
      <KpiGrid analytics={analytics} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryHealthPanel summaries={analytics.categorySummaries} />
        <ShiftConsumptionPanel analytics={analytics} />
      </div>
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <ReplenishmentTable
          items={analytics.prioritizedReplenishment}
          onRestockItem={onRestockItem}
        />
        <ConsumptionTable summaries={analytics.equipmentSummaries} />
      </div>
      <AuditLogTable usageEntries={model.filteredUsage} />
    </div>
  );
}
