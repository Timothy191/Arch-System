import type { PlantInventoryStockItem, PlantInventoryUsageEntry } from './plant-inventory-seeds';
import {
  computeStockAutomatedFlags,
  type PlantInventoryCategory,
  type PlantStockStatusFlag,
} from './stock-flags';

export type PlantInventoryReportTab = 'dashboard' | 'pdf-report';
export type PlantInventoryStatusFilter = 'ALL' | 'BELOW_PAR' | 'CRITICAL_OR_OOS' | 'NOMINAL';
export type PlantHealthTone = 'healthy' | 'watch' | 'critical';

export const PLANT_INVENTORY_CATEGORIES: readonly PlantInventoryCategory[] = [
  'Dense Medium',
  'Reagents',
  'Wear Spares',
  'Screening & Crushing',
  'Stockpiles',
];

export const ALL_FILTER = 'ALL';
const FULL_COVERAGE_PCT = 100;
const WATCH_COVERAGE_PCT = 85;
const CRITICAL_COVERAGE_PCT = 50;
const PERCENT_DECIMALS = 1;
/** Leading characters that spreadsheet apps interpret as formulas (CSV injection). */
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

const SEVERITY_RANK: Record<PlantStockStatusFlag, number> = {
  OUT_OF_STOCK: 0,
  CRITICAL: 1,
  REPLENISH: 2,
  NOMINAL: 3,
  SURPLUS: 4,
};

export type PlantStockFlags = ReturnType<typeof computeStockAutomatedFlags>;

export interface EnrichedPlantStockItem extends PlantInventoryStockItem {
  readonly flags: PlantStockFlags;
}

export interface CategoryHealthSummary {
  readonly category: PlantInventoryCategory;
  readonly totalLines: number;
  readonly nominalLines: number;
  readonly belowParLines: number;
  readonly criticalLines: number;
  readonly avgCoveragePct: number;
  readonly healthTone: PlantHealthTone;
}

export interface EquipmentAnalyticsSummary {
  readonly equipment: string;
  readonly totalDrawdown: number;
  readonly usageCount: number;
  readonly stockLines: number;
  readonly belowParCount: number;
  readonly avgCoveragePct: number;
  readonly shareOfMaxPct: number;
}

export interface PlantInventoryAnalytics {
  readonly enrichedItems: readonly EnrichedPlantStockItem[];
  readonly totalLines: number;
  readonly nominalCount: number;
  readonly belowParCount: number;
  readonly criticalOrOosCount: number;
  readonly surplusCount: number;
  readonly parCompliancePct: number;
  readonly avgCoveragePct: number;
  readonly trackedEquipmentCount: number;
  readonly equipmentAtRiskCount: number;
  readonly totalUsageEntries: number;
  readonly dayShiftEntries: number;
  readonly nightShiftEntries: number;
  readonly dayShiftPct: number;
  readonly categorySummaries: readonly CategoryHealthSummary[];
  readonly prioritizedReplenishment: readonly EnrichedPlantStockItem[];
  readonly equipmentSummaries: readonly EquipmentAnalyticsSummary[];
}

/** Props of the vector PDF document (lives here to keep export ↔ document acyclic). */
export interface PlantInventoryPdfExportOptions {
  readonly today: string;
  readonly scopeLabel: string;
  readonly filterLabel: string;
  readonly analytics: PlantInventoryAnalytics;
  readonly usageHistory: readonly PlantInventoryUsageEntry[];
}

export interface PlantInventoryFilterOptions {
  readonly query: string;
  readonly category: string;
  readonly equipment: string;
  readonly statusFilter: PlantInventoryStatusFilter;
}

function roundPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * FULL_COVERAGE_PCT).toFixed(PERCENT_DECIMALS));
}

/** Average coverage with each line capped at 100% so surpluses never mask shortages. */
function averageCappedCoverage(items: readonly EnrichedPlantStockItem[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce(
    (sum, entry) => sum + Math.min(FULL_COVERAGE_PCT, entry.flags.coveragePct),
    0
  );
  return Number((total / items.length).toFixed(PERCENT_DECIMALS));
}

export function isCriticalOrOutOfStock(status: PlantStockStatusFlag): boolean {
  return status === 'CRITICAL' || status === 'OUT_OF_STOCK';
}

export function resolveHealthTone(coveragePct: number): PlantHealthTone {
  if (coveragePct < CRITICAL_COVERAGE_PCT) return 'critical';
  if (coveragePct < WATCH_COVERAGE_PCT) return 'watch';
  return 'healthy';
}

export function enrichPlantStockItems(
  stockItems: readonly PlantInventoryStockItem[]
): EnrichedPlantStockItem[] {
  return stockItems.map((stockItem) => ({
    ...stockItem,
    flags: computeStockAutomatedFlags(stockItem.amountRequired, stockItem.amountPresent),
  }));
}

function buildCategorySummaries(items: readonly EnrichedPlantStockItem[]): CategoryHealthSummary[] {
  return PLANT_INVENTORY_CATEGORIES.map((category) => {
    const lines = items.filter((entry) => entry.category === category);
    const avgCoveragePct = averageCappedCoverage(lines);
    return {
      category,
      totalLines: lines.length,
      nominalLines: lines.filter((entry) => !entry.flags.needsReplenishment).length,
      belowParLines: lines.filter((entry) => entry.flags.needsReplenishment).length,
      criticalLines: lines.filter((entry) => isCriticalOrOutOfStock(entry.flags.stockStatus))
        .length,
      avgCoveragePct,
      healthTone: resolveHealthTone(avgCoveragePct),
    };
  })
    .filter((summary) => summary.totalLines > 0)
    .sort((left, right) => left.avgCoveragePct - right.avgCoveragePct);
}

function buildEquipmentSummaries(
  items: readonly EnrichedPlantStockItem[],
  usageHistory: readonly PlantInventoryUsageEntry[]
): EquipmentAnalyticsSummary[] {
  const equipmentNames = [
    ...new Set([
      ...items.map((entry) => entry.plantEquipment),
      ...usageHistory.map((entry) => entry.plantEquipment),
    ]),
  ];
  const baseSummaries = equipmentNames.map((equipment) => {
    const lines = items.filter((entry) => entry.plantEquipment === equipment);
    const usage = usageHistory.filter((entry) => entry.plantEquipment === equipment);
    return {
      equipment,
      totalDrawdown: usage.reduce((sum, entry) => sum + entry.amountUsed, 0),
      usageCount: usage.length,
      stockLines: lines.length,
      belowParCount: lines.filter((entry) => entry.flags.needsReplenishment).length,
      avgCoveragePct: averageCappedCoverage(lines),
    };
  });
  const maxUsageCount = Math.max(0, ...baseSummaries.map((summary) => summary.usageCount));
  return baseSummaries
    .map((summary) => ({ ...summary, shareOfMaxPct: roundPct(summary.usageCount, maxUsageCount) }))
    .sort(
      (left, right) =>
        right.belowParCount - left.belowParCount || right.usageCount - left.usageCount
    );
}

export function sortByReplenishmentPriority(
  items: readonly EnrichedPlantStockItem[]
): EnrichedPlantStockItem[] {
  return items
    .filter((entry) => entry.flags.needsReplenishment)
    .sort(
      (left, right) =>
        SEVERITY_RANK[left.flags.stockStatus] - SEVERITY_RANK[right.flags.stockStatus] ||
        left.flags.coveragePct - right.flags.coveragePct ||
        right.flags.shortfallAmount - left.flags.shortfallAmount
    );
}

export function buildPlantInventoryAnalytics(options: {
  readonly stockItems: readonly PlantInventoryStockItem[];
  readonly usageHistory: readonly PlantInventoryUsageEntry[];
}): PlantInventoryAnalytics {
  const enrichedItems = enrichPlantStockItems(options.stockItems);
  const belowParCount = enrichedItems.filter((entry) => entry.flags.needsReplenishment).length;
  const nominalCount = enrichedItems.length - belowParCount;
  const equipmentSummaries = buildEquipmentSummaries(enrichedItems, options.usageHistory);
  const dayShiftEntries = options.usageHistory.filter((entry) => entry.shift === 'Day').length;

  return {
    enrichedItems,
    totalLines: enrichedItems.length,
    nominalCount,
    belowParCount,
    criticalOrOosCount: enrichedItems.filter((entry) =>
      isCriticalOrOutOfStock(entry.flags.stockStatus)
    ).length,
    surplusCount: enrichedItems.filter((entry) => entry.flags.stockStatus === 'SURPLUS').length,
    parCompliancePct: roundPct(nominalCount, enrichedItems.length),
    avgCoveragePct: averageCappedCoverage(enrichedItems),
    trackedEquipmentCount: equipmentSummaries.filter((summary) => summary.stockLines > 0).length,
    equipmentAtRiskCount: equipmentSummaries.filter((summary) => summary.belowParCount > 0).length,
    totalUsageEntries: options.usageHistory.length,
    dayShiftEntries,
    nightShiftEntries: options.usageHistory.length - dayShiftEntries,
    dayShiftPct: roundPct(dayShiftEntries, options.usageHistory.length),
    categorySummaries: buildCategorySummaries(enrichedItems),
    prioritizedReplenishment: sortByReplenishmentPriority(enrichedItems),
    equipmentSummaries,
  };
}

const STATUS_FILTER_PREDICATES: Record<
  PlantInventoryStatusFilter,
  (status: PlantStockStatusFlag) => boolean
> = {
  ALL: () => true,
  BELOW_PAR: (status) => SEVERITY_RANK[status] <= SEVERITY_RANK.REPLENISH,
  CRITICAL_OR_OOS: isCriticalOrOutOfStock,
  NOMINAL: (status) => status === 'NOMINAL' || status === 'SURPLUS',
};

export function filterPlantInventoryItems(
  items: readonly PlantInventoryStockItem[],
  options: PlantInventoryFilterOptions
): PlantInventoryStockItem[] {
  const normalizedQuery = options.query.trim().toLowerCase();
  const matchesStatus = STATUS_FILTER_PREDICATES[options.statusFilter];
  return items.filter((stockItem) => {
    if (options.category !== ALL_FILTER && stockItem.category !== options.category) return false;
    if (options.equipment !== ALL_FILTER && stockItem.plantEquipment !== options.equipment) {
      return false;
    }
    const { stockStatus } = computeStockAutomatedFlags(
      stockItem.amountRequired,
      stockItem.amountPresent
    );
    if (!matchesStatus(stockStatus)) return false;
    if (!normalizedQuery) return true;
    return [stockItem.stock, stockItem.code, stockItem.description, stockItem.plantEquipment].some(
      (field) => field.toLowerCase().includes(normalizedQuery)
    );
  });
}

/** Client-safe CSV cell escaping (formula-injection guard + RFC-4180 quoting). */
export function escapePlantCsvCell(cellText: string): string {
  const neutralized = CSV_FORMULA_PREFIX.test(cellText) ? `'${cellText}` : cellText;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

const CSV_HEADERS = [
  'Date',
  'Code',
  'Stock',
  'Category',
  'Plant Equipment',
  'Amount Required',
  'Amount Present',
  'Unit',
  'Shortfall',
  'Coverage %',
  'Status',
] as const;

export function buildPlantInventoryCsv(options: {
  readonly items: readonly EnrichedPlantStockItem[];
  readonly today: string;
}): string {
  const rows = options.items.map((entry) =>
    [
      options.today,
      entry.code,
      entry.stock,
      entry.category,
      entry.plantEquipment,
      String(entry.amountRequired),
      String(entry.amountPresent),
      entry.unit,
      String(entry.flags.shortfallAmount),
      String(entry.flags.coveragePct),
      entry.flags.statusLabel,
    ]
      .map(escapePlantCsvCell)
      .join(',')
  );
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}
