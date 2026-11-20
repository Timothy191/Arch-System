'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { CalendarDays, Download, FileText, Loader2, Printer } from 'lucide-react';
import Link from 'next/link';
import { type CSSProperties, useMemo, useState } from 'react';
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
} from './plant-inventory-analytics';
import { downloadPlantInventoryPdf } from './plant-inventory-export';
import {
  formatQty,
  getStockStatusBadgeClass,
  type PlantInventoryStockItem,
  type PlantInventoryUsageEntry,
} from './plant-inventory-seeds';

// ─── Types & constants ──────────────────────────────────────────────────────

type ReportScope = 'all' | 'replenishment';
type ZoomLevel = 'fit' | '100' | '75';

interface SegmentOption<TOption extends string> {
  readonly value: TOption;
  readonly label: string;
}

export interface PlantInventoryPdfReportViewProps {
  readonly today: string;
  readonly stockItems: readonly PlantInventoryStockItem[];
  readonly usageHistory: readonly PlantInventoryUsageEntry[];
}

const MAX_PREVIEW_CONSUMPTION_ROWS = 12;
const FULL_BAR_PCT = 100;
const DASHBOARD_HREF = '/plant-inventory/reports';
const PDF_REPORT_HREF = '/plant-inventory/reports?tab=pdf-report';
const ALL_CATEGORIES_LABEL = 'All Categories';
const ALL_EQUIPMENT_LABEL = 'All Equipment';

const SCOPE_OPTIONS: readonly SegmentOption<ReportScope>[] = [
  { value: 'all', label: 'All Stock Lines' },
  { value: 'replenishment', label: 'Replenishment Only' },
];

const SCOPE_LABELS: Record<ReportScope, string> = {
  all: 'All Stock Lines',
  replenishment: 'Replenishment Only (Below Par)',
};

const ZOOM_OPTIONS: readonly SegmentOption<ZoomLevel>[] = [
  { value: 'fit', label: 'Fit' },
  { value: '100', label: '100%' },
  { value: '75', label: '75%' },
];

const ZOOM_STYLES: Record<ZoomLevel, CSSProperties> = {
  fit: { width: '210mm', maxWidth: '100%' },
  '100': { width: '210mm', transform: 'scale(1)', transformOrigin: 'top center' },
  '75': { width: '210mm', transform: 'scale(0.75)', transformOrigin: 'top center' },
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

const EYEBROW_CLASS =
  'font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-[0.18em]';
const PILL_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 font-medium text-[var(--text-secondary)] text-xs';
const SEGMENT_GROUP_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1';
const SEGMENT_BASE_CLASS = 'rounded-md px-3 py-1.5 font-medium text-xs transition';
const SEGMENT_ACTIVE_CLASS = 'bg-[var(--accent-blue)] text-[var(--bg-primary)] shadow-sm';
const SEGMENT_INACTIVE_CLASS =
  'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]';
const FIELD_LABEL_CLASS =
  'flex flex-col gap-1 font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wide';
const SELECT_CLASS =
  'min-w-44 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs normal-case tracking-normal shadow-sm focus:border-[var(--accent-blue)] focus:outline-none';
const BTN_SECONDARY_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs shadow-sm transition hover:border-[var(--accent-blue)]';
const BTN_PRIMARY_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-[var(--bg-primary)] text-xs shadow-md transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60';
const PAPER_CLASS =
  'mx-auto flex min-h-[297mm] flex-col gap-6 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] p-[12mm] text-[var(--text-heading)] shadow-md print:rounded-none print:border-0 print:shadow-none';
const SECTION_TITLE_CLASS =
  'mb-2 border-[var(--border-default)] border-b pb-1 font-bold text-[11px] text-[var(--text-heading)] uppercase tracking-wide';
const TH_CLASS =
  'border-[var(--border-default)] border-b bg-[var(--bg-secondary)] px-2 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase';
const TD_CLASS = 'border-[var(--border-subtle)] border-b px-2 py-1.5 align-top text-[11px]';
const TD_NUM_CLASS = `${TD_CLASS} text-right tabular-nums`;
const KPI_CARD_CLASS =
  'flex flex-col gap-0.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2';
const MUTED_TEXT_CLASS = 'text-[10px] text-[var(--text-muted)]';
const EMPTY_CELL_CLASS = 'px-2 py-3 text-[11px] text-[var(--accent-green)]';

// ─── Report model hook ──────────────────────────────────────────────────────

function filterUsageForReport(
  usageHistory: readonly PlantInventoryUsageEntry[],
  options: {
    readonly stockItems: readonly PlantInventoryStockItem[];
    readonly category: string;
    readonly equipment: string;
  }
): PlantInventoryUsageEntry[] {
  const categoryStockIds = new Set(
    options.stockItems
      .filter((stockItem) => stockItem.category === options.category)
      .map((stockItem) => stockItem.id)
  );
  return usageHistory.filter((entry) => {
    if (options.category !== ALL_FILTER && !categoryStockIds.has(entry.stockId)) return false;
    return options.equipment === ALL_FILTER || entry.plantEquipment === options.equipment;
  });
}

function usePlantPdfReportModel({ stockItems, usageHistory }: PlantInventoryPdfReportViewProps) {
  const [category, setCategory] = useState<string>(ALL_FILTER);
  const [equipment, setEquipment] = useState<string>(ALL_FILTER);
  const [scope, setScope] = useState<ReportScope>('all');

  const equipmentOptions = useMemo(
    () => [...new Set(stockItems.map((stockItem) => stockItem.plantEquipment))].sort(),
    [stockItems]
  );

  const reportUsage = useMemo(
    () => filterUsageForReport(usageHistory, { stockItems, category, equipment }),
    [usageHistory, stockItems, category, equipment]
  );

  const analytics = useMemo(() => {
    const filteredItems = filterPlantInventoryItems(stockItems, {
      query: '',
      category,
      equipment,
      statusFilter: scope === 'replenishment' ? 'BELOW_PAR' : 'ALL',
    });
    return buildPlantInventoryAnalytics({ stockItems: filteredItems, usageHistory: reportUsage });
  }, [stockItems, category, equipment, scope, reportUsage]);

  const categoryLabel = category === ALL_FILTER ? ALL_CATEGORIES_LABEL : category;
  const equipmentLabel = equipment === ALL_FILTER ? ALL_EQUIPMENT_LABEL : equipment;

  return {
    filters: { category, equipment, scope, setCategory, setEquipment, setScope },
    equipmentOptions,
    reportUsage,
    analytics,
    scopeLabel: SCOPE_LABELS[scope],
    filterLabel: `Category: ${categoryLabel} · Equipment: ${equipmentLabel}`,
  };
}

type PlantPdfReportModel = ReturnType<typeof usePlantPdfReportModel>;

// ─── Toolbar ────────────────────────────────────────────────────────────────

function SegmentedControl<TOption extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly SegmentOption<TOption>[];
  selected: TOption;
  onSelect: (next: TOption) => void;
}) {
  return (
    <div role="group" aria-label={label} className={SEGMENT_GROUP_CLASS}>
      {options.map((option) => {
        const isActive = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(option.value)}
            className={`${SEGMENT_BASE_CLASS} ${isActive ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ReportTabLinks() {
  return (
    <nav aria-label="Plant inventory report views" className={SEGMENT_GROUP_CLASS}>
      <Link href={DASHBOARD_HREF} className={`${SEGMENT_BASE_CLASS} ${SEGMENT_INACTIVE_CLASS}`}>
        Dashboard
      </Link>
      <Link
        href={PDF_REPORT_HREF}
        aria-current="page"
        className={`${SEGMENT_BASE_CLASS} ${SEGMENT_ACTIVE_CLASS}`}
      >
        PDF Report
      </Link>
    </nav>
  );
}

function ToolbarHeading({ today }: { today: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className={EYEBROW_CLASS}>PLANT INVENTORY · PDF STUDIO</span>
        <h2 className="font-bold text-[var(--text-heading)] text-xl">Plant Inventory PDF Report</h2>
        <p className="max-w-2xl text-[var(--text-secondary)] text-sm">
          Configure scope and filters, review the live A4 preview, then print or download the
          executive stock control report.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className={PILL_CLASS}>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Operational Date: {today}
        </span>
        <ReportTabLinks />
      </div>
    </div>
  );
}

function FilterSelects({ model }: { model: PlantPdfReportModel }) {
  const { filters } = model;
  return (
    <>
      <label className={FIELD_LABEL_CLASS}>
        Category
        <select
          aria-label="Report category"
          value={filters.category}
          onChange={(event) => filters.setCategory(event.target.value)}
          className={SELECT_CLASS}
        >
          <option value={ALL_FILTER}>{ALL_CATEGORIES_LABEL}</option>
          {PLANT_INVENTORY_CATEGORIES.map((categoryName) => (
            <option key={categoryName} value={categoryName}>
              {categoryName}
            </option>
          ))}
        </select>
      </label>
      <label className={FIELD_LABEL_CLASS}>
        Equipment
        <select
          aria-label="Report equipment"
          value={filters.equipment}
          onChange={(event) => filters.setEquipment(event.target.value)}
          className={SELECT_CLASS}
        >
          <option value={ALL_FILTER}>{ALL_EQUIPMENT_LABEL}</option>
          {model.equipmentOptions.map((equipmentName) => (
            <option key={equipmentName} value={equipmentName}>
              {equipmentName}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function ToolbarActions({
  isGenerating,
  onDownload,
}: {
  isGenerating: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => window.print()} className={BTN_SECONDARY_CLASS}>
        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
        Print A4
      </button>
      <button
        type="button"
        onClick={onDownload}
        disabled={isGenerating}
        className={BTN_PRIMARY_CLASS}
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isGenerating ? 'Preparing PDF…' : 'Download PDF Report'}
      </button>
    </div>
  );
}

function StudioToolbar(props: {
  today: string;
  model: PlantPdfReportModel;
  zoom: ZoomLevel;
  onZoom: (next: ZoomLevel) => void;
  isGenerating: boolean;
  onDownload: () => void;
}) {
  const { filters } = props.model;
  return (
    <GlassCard variant="window" className="print:hidden">
      <div className="flex flex-col gap-4 p-5">
        <ToolbarHeading today={props.today} />
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelects model={props.model} />
          <SegmentedControl
            label="Report scope"
            options={SCOPE_OPTIONS}
            selected={filters.scope}
            onSelect={filters.setScope}
          />
          <SegmentedControl
            label="Preview zoom"
            options={ZOOM_OPTIONS}
            selected={props.zoom}
            onSelect={props.onZoom}
          />
          <ToolbarActions isGenerating={props.isGenerating} onDownload={props.onDownload} />
        </div>
      </div>
    </GlassCard>
  );
}

// ─── A4 preview sections ────────────────────────────────────────────────────

function PreviewHeader(props: { today: string; scopeLabel: string; filterLabel: string }) {
  return (
    <header className="flex items-end justify-between gap-6 border-[var(--text-heading)] border-b-2 pb-3">
      <div className="flex items-center gap-3">
        <Logo className="h-10 w-10" />
        <div className="flex flex-col">
          <span className={EYEBROW_CLASS}>ARCH OS · PLANT INVENTORY &amp; STOCK CONTROL</span>
          <h3 className="font-bold text-2xl text-[var(--text-heading)]">
            Plant Inventory Executive Report
          </h3>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 text-right text-[10px]">
        <dt className="text-[var(--text-muted)]">Operational Date</dt>
        <dd className="font-semibold">{props.today}</dd>
        <dt className="text-[var(--text-muted)]">Document ID</dt>
        <dd className="font-semibold">PI-RPT-{props.today}</dd>
        <dt className="text-[var(--text-muted)]">Scope</dt>
        <dd className="font-semibold">{props.scopeLabel}</dd>
        <dt className="text-[var(--text-muted)]">Filters</dt>
        <dd className="font-semibold">{props.filterLabel}</dd>
      </dl>
    </header>
  );
}

function PreviewKpi({ label, metric, hint }: { label: string; metric: string; hint: string }) {
  return (
    <div className={KPI_CARD_CLASS}>
      <span className="font-semibold text-[9px] text-[var(--text-muted)] uppercase">{label}</span>
      <span className="font-bold text-[var(--text-heading)] text-lg tabular-nums">{metric}</span>
      <span className={MUTED_TEXT_CLASS}>{hint}</span>
    </div>
  );
}

function PreviewKpis({ analytics }: { analytics: PlantInventoryAnalytics }) {
  return (
    <section aria-label="Key performance indicators" className="grid grid-cols-5 gap-2">
      <PreviewKpi
        label="Total Stock Lines"
        metric={String(analytics.totalLines)}
        hint={`${analytics.nominalCount} at or above par`}
      />
      <PreviewKpi
        label="Par Compliance"
        metric={`${analytics.parCompliancePct}%`}
        hint={`${analytics.surplusCount} surplus lines`}
      />
      <PreviewKpi
        label="Avg Coverage"
        metric={`${analytics.avgCoveragePct}%`}
        hint="Capped at 100% per line"
      />
      <PreviewKpi
        label="Replenishment Alerts"
        metric={String(analytics.belowParCount)}
        hint={`${analytics.criticalOrOosCount} critical / out of stock`}
      />
      <PreviewKpi
        label="Equipment Tracked"
        metric={String(analytics.trackedEquipmentCount)}
        hint={`${analytics.equipmentAtRiskCount} at risk`}
      />
    </section>
  );
}

function CategoryCoverageBar({ summary }: { summary: CategoryHealthSummary }) {
  const barWidthPct = Math.min(FULL_BAR_PCT, summary.avgCoveragePct);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold">{summary.category}</span>
        <span className={`font-semibold ${TONE_TEXT_CLASS[summary.healthTone]}`}>
          {summary.avgCoveragePct}% · {summary.belowParLines}/{summary.totalLines} below par
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        <div
          className={`h-full rounded-full ${TONE_BAR_CLASS[summary.healthTone]}`}
          style={{ width: `${barWidthPct}%` }}
        />
      </div>
    </li>
  );
}

function PreviewCategoryHealth({ summaries }: { summaries: readonly CategoryHealthSummary[] }) {
  return (
    <section>
      <h4 className={SECTION_TITLE_CLASS}>Stock Health by Category</h4>
      {summaries.length === 0 ? (
        <p className={EMPTY_CELL_CLASS}>No categories match the selected filters.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {summaries.map((summary) => (
            <CategoryCoverageBar key={summary.category} summary={summary} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PreviewStockRow({ stockLine }: { stockLine: EnrichedPlantStockItem }) {
  return (
    <tr>
      <td className={TD_CLASS}>
        <span className="block font-semibold">{stockLine.stock}</span>
        <span className={MUTED_TEXT_CLASS}>{stockLine.code}</span>
      </td>
      <td className={TD_CLASS}>{stockLine.plantEquipment}</td>
      <td className={TD_NUM_CLASS}>{formatQty(stockLine.amountRequired)}</td>
      <td className={TD_NUM_CLASS}>{formatQty(stockLine.amountPresent)}</td>
      <td className={TD_NUM_CLASS}>
        {formatQty(stockLine.flags.shortfallAmount)} {stockLine.unit}
      </td>
      <td className={TD_NUM_CLASS}>{stockLine.flags.coveragePct}%</td>
      <td className={TD_CLASS}>
        <span className={getStockStatusBadgeClass(stockLine.flags.stockStatus)}>
          {stockLine.flags.statusLabel}
        </span>
      </td>
    </tr>
  );
}

const STOCK_COLUMNS = [
  'Stock / Code',
  'Plant Equipment',
  'Required',
  'Present',
  'Shortfall',
  'Coverage',
  'Status',
] as const;

function PreviewStockTable(props: {
  title: string;
  items: readonly EnrichedPlantStockItem[];
  emptyText: string;
}) {
  return (
    <section>
      <h4 className={SECTION_TITLE_CLASS}>{props.title}</h4>
      <table aria-label={props.title} className="w-full border-collapse">
        <thead>
          <tr>
            {STOCK_COLUMNS.map((column) => (
              <th key={column} scope="col" className={TH_CLASS}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.items.length === 0 ? (
            <tr>
              <td colSpan={STOCK_COLUMNS.length} className={EMPTY_CELL_CLASS}>
                {props.emptyText}
              </td>
            </tr>
          ) : null}
          {props.items.map((stockLine) => (
            <PreviewStockRow key={stockLine.id} stockLine={stockLine} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

const EQUIPMENT_COLUMNS = ['Plant Equipment', 'Lines', 'Below Par', 'Coverage', 'Draws'] as const;

function PreviewEquipmentDrawdown({
  summaries,
}: {
  summaries: readonly EquipmentAnalyticsSummary[];
}) {
  return (
    <section>
      <h4 className={SECTION_TITLE_CLASS}>Equipment Drawdown</h4>
      <table aria-label="Equipment Drawdown" className="w-full border-collapse">
        <thead>
          <tr>
            {EQUIPMENT_COLUMNS.map((column) => (
              <th key={column} scope="col" className={TH_CLASS}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={summary.equipment}>
              <td className={`${TD_CLASS} font-semibold`}>{summary.equipment}</td>
              <td className={TD_NUM_CLASS}>{summary.stockLines}</td>
              <td className={TD_NUM_CLASS}>{summary.belowParCount}</td>
              <td className={TD_NUM_CLASS}>{summary.avgCoveragePct}%</td>
              <td className={TD_NUM_CLASS}>{summary.usageCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PreviewConsumptionLog({
  usageHistory,
}: {
  usageHistory: readonly PlantInventoryUsageEntry[];
}) {
  const visibleEntries = usageHistory.slice(0, MAX_PREVIEW_CONSUMPTION_ROWS);
  return (
    <section>
      <h4 className={SECTION_TITLE_CLASS}>Recent Shift Consumption</h4>
      {visibleEntries.length === 0 ? (
        <p className={EMPTY_CELL_CLASS}>No consumption logged for the selected scope.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
          {visibleEntries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 py-1.5">
              <div className="flex flex-col">
                <span className="font-semibold text-[11px]">{entry.stock}</span>
                <span className={MUTED_TEXT_CLASS}>
                  {entry.date} · {entry.shift} · {entry.loggedBy}
                </span>
              </div>
              <span className="whitespace-nowrap font-semibold text-[11px] tabular-nums">
                {formatQty(entry.amountUsed)} {entry.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SIGN_OFF_ROLES = ['Stock Controller', 'Plant Superintendent', 'Approval Date'] as const;

function PreviewSignOff() {
  return (
    <section aria-label="Sign-off" className="mt-auto grid grid-cols-3 gap-8 pt-8">
      {SIGN_OFF_ROLES.map((role) => (
        <div key={role} className="border-[var(--text-heading)] border-t pt-1">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">{role}</span>
        </div>
      ))}
    </section>
  );
}

function PreviewFooter() {
  return (
    <footer className="flex justify-between border-[var(--border-default)] border-t pt-2">
      <span className={MUTED_TEXT_CLASS}>Plantcor / Arch OS · Confidential Operational Report</span>
      <span className={MUTED_TEXT_CLASS}>Page 1 of 1</span>
    </footer>
  );
}

function ReportPreview(props: { today: string; model: PlantPdfReportModel; zoom: ZoomLevel }) {
  const { analytics } = props.model;
  return (
    <div className="flex justify-center overflow-x-auto pb-6">
      <article
        aria-label="Plant Inventory PDF Report Preview"
        className={PAPER_CLASS}
        style={ZOOM_STYLES[props.zoom]}
      >
        <PreviewHeader
          today={props.today}
          scopeLabel={props.model.scopeLabel}
          filterLabel={props.model.filterLabel}
        />
        <PreviewKpis analytics={analytics} />
        <PreviewCategoryHealth summaries={analytics.categorySummaries} />
        <PreviewStockTable
          title="Prioritized Replenishment Demand"
          items={analytics.prioritizedReplenishment}
          emptyText="All stock lines are at or above par — no replenishment demand."
        />
        <PreviewStockTable
          title="Complete Stock Balance Register"
          items={analytics.enrichedItems}
          emptyText="No stock lines match the selected filters."
        />
        <div className="grid grid-cols-2 gap-6">
          <PreviewEquipmentDrawdown summaries={analytics.equipmentSummaries} />
          <PreviewConsumptionLog usageHistory={props.model.reportUsage} />
        </div>
        <PreviewSignOff />
        <PreviewFooter />
      </article>
    </div>
  );
}

// ─── Root view ──────────────────────────────────────────────────────────────

export function PlantInventoryPdfReportView(props: PlantInventoryPdfReportViewProps) {
  const model = usePlantPdfReportModel(props);
  const [zoom, setZoom] = useState<ZoomLevel>('fit');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await downloadPlantInventoryPdf({
        today: props.today,
        scopeLabel: model.scopeLabel,
        filterLabel: model.filterLabel,
        analytics: model.analytics,
        usageHistory: model.reportUsage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <StudioToolbar
        today={props.today}
        model={model}
        zoom={zoom}
        onZoom={setZoom}
        isGenerating={isGenerating}
        onDownload={() => void handleDownload()}
      />
      <p className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs print:hidden">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Live A4 preview — mirrors the downloadable vector PDF.
      </p>
      <ReportPreview today={props.today} model={model} zoom={zoom} />
    </div>
  );
}
