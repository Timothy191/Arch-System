import {
  ALL_FILTER,
  buildPlantInventoryAnalytics,
  buildPlantInventoryCsv,
  enrichPlantStockItems,
  escapePlantCsvCell,
  filterPlantInventoryItems,
  isCriticalOrOutOfStock,
  PLANT_INVENTORY_CATEGORIES,
  resolveHealthTone,
  sortByReplenishmentPriority,
} from './plant-inventory-analytics';
import {
  INITIAL_PLANT_STOCK_ITEMS,
  INITIAL_PLANT_USAGE_HISTORY,
  type PlantInventoryStockItem,
  type PlantInventoryUsageEntry,
} from './plant-inventory-seeds';

const CUSTOM_STOCK_ITEMS: readonly PlantInventoryStockItem[] = [
  {
    id: 'oos-item',
    stock: 'Zero-Stock Valve',
    code: 'VLV-000',
    category: 'Wear Spares',
    description: 'Slurry knife gate valve',
    amountRequired: 10,
    amountPresent: 0,
    unit: 'units',
    plantEquipment: 'Primary DMC Module CR-101',
  },
  {
    id: 'crit-high-shortfall',
    stock: 'Critical Pump Seal',
    code: 'PSL-101',
    category: 'Wear Spares',
    description: 'Mechanical gland seal',
    amountRequired: 20,
    amountPresent: 4, // 20% coverage, shortfall 16
    unit: 'units',
    plantEquipment: 'Primary DMC Module CR-101',
  },
  {
    id: 'crit-low-shortfall',
    stock: 'Critical Nozzle',
    code: 'NZL-102',
    category: 'Wear Spares',
    description: 'Spray nozzle',
    amountRequired: 10,
    amountPresent: 2, // 20% coverage, shortfall 8
    unit: 'units',
    plantEquipment: 'Secondary Sizing Screen SC-201',
  },
  {
    id: 'crit-higher-cov',
    stock: 'Critical Bearing',
    code: 'BRG-103',
    category: 'Reagents',
    description: 'Spherical roller bearing',
    amountRequired: 10,
    amountPresent: 4, // 40% coverage, shortfall 6
    unit: 'units',
    plantEquipment: 'Secondary Sizing Screen SC-201',
  },
  {
    id: 'replenish-item',
    stock: 'Replenish Flocculant',
    code: 'FLC-200',
    category: 'Reagents',
    description: 'Polymer bags',
    amountRequired: 10,
    amountPresent: 7, // 70% coverage
    unit: 'bags',
    plantEquipment: 'Tailings Thickener TH-501',
  },
  {
    id: 'nominal-item',
    stock: 'Nominal Screen Cloth',
    code: 'SCR-300',
    category: 'Screening & Crushing',
    description: 'Woven wire mesh',
    amountRequired: 10,
    amountPresent: 10, // 100% coverage
    unit: 'sheets',
    plantEquipment: 'Tailings Thickener TH-501',
  },
  {
    id: 'surplus-item',
    stock: 'Surplus Lime',
    code: 'LME-400',
    category: 'Dense Medium',
    description: 'Hydrated lime pH buffer',
    amountRequired: 10,
    amountPresent: 25, // 250% coverage -> capped at 100% in avgCoveragePct
    unit: 't',
    plantEquipment: 'Lime Slaker SL-901',
  },
];

const CUSTOM_USAGE: readonly PlantInventoryUsageEntry[] = [
  {
    id: 'u-1',
    date: '2026-10-22',
    shift: 'Day',
    stockId: 'oos-item',
    stock: 'Zero-Stock Valve',
    description: 'Replaced seized valve',
    amountUsed: 3,
    unit: 'units',
    circuitArea: 'DMC Loop',
    plantEquipment: 'Primary DMC Module CR-101',
    loggedBy: 'S. Mokoena',
  },
  {
    id: 'u-2',
    date: '2026-10-22',
    shift: 'Day',
    stockId: 'crit-high-shortfall',
    stock: 'Critical Pump Seal',
    description: 'Emergency seal swap',
    amountUsed: 2,
    unit: 'units',
    circuitArea: 'DMC Loop',
    plantEquipment: 'Primary DMC Module CR-101',
    loggedBy: 'T. Khumalo',
  },
  {
    id: 'u-3',
    date: '2026-10-22',
    shift: 'Night',
    stockId: 'orphan',
    stock: 'Ad-hoc Grease',
    description: 'Night shift lubrication on unlisted unit',
    amountUsed: 5,
    unit: 'kg',
    circuitArea: 'Conveyor Gallery',
    plantEquipment: 'Unlisted Conveyor CV-999',
    loggedBy: 'L. Ndlovu',
  },
];

describe('plant-inventory-analytics', () => {
  it('exports canonical category list and ALL_FILTER constant', () => {
    expect(ALL_FILTER).toBe('ALL');
    expect(PLANT_INVENTORY_CATEGORIES).toEqual([
      'Dense Medium',
      'Reagents',
      'Wear Spares',
      'Screening & Crushing',
      'Stockpiles',
    ]);
  });

  it('identifies critical and out-of-stock status flags', () => {
    expect(isCriticalOrOutOfStock('OUT_OF_STOCK')).toBe(true);
    expect(isCriticalOrOutOfStock('CRITICAL')).toBe(true);
    expect(isCriticalOrOutOfStock('REPLENISH')).toBe(false);
    expect(isCriticalOrOutOfStock('NOMINAL')).toBe(false);
    expect(isCriticalOrOutOfStock('SURPLUS')).toBe(false);
  });

  it('resolves health tones at critical (<50), watch (50..84.9), and healthy (>=85) thresholds', () => {
    expect(resolveHealthTone(0)).toBe('critical');
    expect(resolveHealthTone(49.9)).toBe('critical');
    expect(resolveHealthTone(50)).toBe('watch');
    expect(resolveHealthTone(84.9)).toBe('watch');
    expect(resolveHealthTone(85)).toBe('healthy');
    expect(resolveHealthTone(100)).toBe('healthy');
  });

  it('enriches stock items with computed automated flags', () => {
    const enriched = enrichPlantStockItems(CUSTOM_STOCK_ITEMS);
    expect(enriched).toHaveLength(CUSTOM_STOCK_ITEMS.length);
    expect(enriched[0]?.flags.stockStatus).toBe('OUT_OF_STOCK');
    expect(enriched[6]?.flags.stockStatus).toBe('SURPLUS');
    expect(enriched[6]?.flags.surplusAmount).toBe(15);
  });

  it('sorts replenishment priority by severity rank, then lower coverage, then higher shortfall', () => {
    const enriched = enrichPlantStockItems(CUSTOM_STOCK_ITEMS);
    const prioritized = sortByReplenishmentPriority(enriched);

    expect(prioritized.map((entry) => entry.id)).toEqual([
      'oos-item',
      'crit-high-shortfall', // 20% coverage, shortfall 16
      'crit-low-shortfall', // 20% coverage, shortfall 8
      'crit-higher-cov', // 40% coverage, shortfall 6
      'replenish-item',
    ]);
  });

  it('builds analytics accurately from seed datasets', () => {
    const analytics = buildPlantInventoryAnalytics({
      stockItems: INITIAL_PLANT_STOCK_ITEMS,
      usageHistory: INITIAL_PLANT_USAGE_HISTORY,
    });

    expect(analytics.totalLines).toBe(INITIAL_PLANT_STOCK_ITEMS.length);
    expect(analytics.nominalCount + analytics.belowParCount).toBe(analytics.totalLines);
    expect(analytics.totalUsageEntries).toBe(INITIAL_PLANT_USAGE_HISTORY.length);
    expect(analytics.dayShiftEntries).toBe(3);
    expect(analytics.nightShiftEntries).toBe(2);
    expect(analytics.dayShiftPct).toBe(60);
    expect(analytics.trackedEquipmentCount).toBeGreaterThan(0);
    expect(analytics.categorySummaries.length).toBeGreaterThan(0);
    expect(analytics.prioritizedReplenishment.length).toBe(analytics.belowParCount);
  });

  it('handles empty stockItems and empty usageHistory gracefully without NaN', () => {
    const emptyAnalytics = buildPlantInventoryAnalytics({
      stockItems: [],
      usageHistory: [],
    });

    expect(emptyAnalytics).toEqual({
      enrichedItems: [],
      totalLines: 0,
      nominalCount: 0,
      belowParCount: 0,
      criticalOrOosCount: 0,
      surplusCount: 0,
      parCompliancePct: 0,
      avgCoveragePct: 0,
      trackedEquipmentCount: 0,
      equipmentAtRiskCount: 0,
      totalUsageEntries: 0,
      dayShiftEntries: 0,
      nightShiftEntries: 0,
      dayShiftPct: 0,
      categorySummaries: [],
      prioritizedReplenishment: [],
      equipmentSummaries: [],
    });
  });

  it('computes category summaries, equipment summaries, and capped coverage across mixed statuses', () => {
    const analytics = buildPlantInventoryAnalytics({
      stockItems: CUSTOM_STOCK_ITEMS,
      usageHistory: CUSTOM_USAGE,
    });

    expect(analytics.totalLines).toBe(7);
    expect(analytics.nominalCount).toBe(2);
    expect(analytics.belowParCount).toBe(5);
    expect(analytics.criticalOrOosCount).toBe(4);
    expect(analytics.surplusCount).toBe(1);
    expect(analytics.parCompliancePct).toBe(28.6);
    // Capped coverage: (0 + 20 + 20 + 40 + 70 + 100 + 100) / 7 = 50.0
    expect(analytics.avgCoveragePct).toBe(50);
    // 4 equipment in stockItems + 1 usage-only equipment -> trackedEquipmentCount is 4
    expect(analytics.trackedEquipmentCount).toBe(4);
    expect(analytics.equipmentAtRiskCount).toBe(3);
    expect(analytics.dayShiftEntries).toBe(2);
    expect(analytics.nightShiftEntries).toBe(1);
    expect(analytics.dayShiftPct).toBe(66.7);

    // Category summaries exclude 'Stockpiles' (0 lines) and sort ascending by avgCoveragePct
    expect(analytics.categorySummaries.map((c) => c.category)).toEqual([
      'Wear Spares',
      'Reagents',
      'Dense Medium',
      'Screening & Crushing',
    ]);
    expect(analytics.categorySummaries[0]?.healthTone).toBe('critical');
    expect(analytics.categorySummaries[1]?.healthTone).toBe('watch');
    expect(analytics.categorySummaries[2]?.healthTone).toBe('healthy');

    // Equipment summaries sort by belowParCount desc, then usageCount desc
    expect(analytics.equipmentSummaries[0]).toMatchObject({
      equipment: 'Primary DMC Module CR-101',
      totalDrawdown: 5,
      usageCount: 2,
      stockLines: 2,
      belowParCount: 2,
      shareOfMaxPct: 100,
    });
    const unlisted = analytics.equipmentSummaries.find(
      (eq) => eq.equipment === 'Unlisted Conveyor CV-999'
    );
    expect(unlisted).toMatchObject({
      totalDrawdown: 5,
      usageCount: 1,
      stockLines: 0,
      belowParCount: 0,
      avgCoveragePct: 0,
      shareOfMaxPct: 50,
    });
  });

  it('filters stock items by query, category, equipment, and each status filter', () => {
    expect(
      filterPlantInventoryItems(CUSTOM_STOCK_ITEMS, {
        query: '',
        category: ALL_FILTER,
        equipment: ALL_FILTER,
        statusFilter: 'ALL',
      })
    ).toHaveLength(7);

    expect(
      filterPlantInventoryItems(CUSTOM_STOCK_ITEMS, {
        query: '',
        category: ALL_FILTER,
        equipment: ALL_FILTER,
        statusFilter: 'BELOW_PAR',
      }).map((i) => i.id)
    ).toEqual([
      'oos-item',
      'crit-high-shortfall',
      'crit-low-shortfall',
      'crit-higher-cov',
      'replenish-item',
    ]);

    expect(
      filterPlantInventoryItems(CUSTOM_STOCK_ITEMS, {
        query: '',
        category: ALL_FILTER,
        equipment: ALL_FILTER,
        statusFilter: 'CRITICAL_OR_OOS',
      }).map((i) => i.id)
    ).toEqual(['oos-item', 'crit-high-shortfall', 'crit-low-shortfall', 'crit-higher-cov']);

    expect(
      filterPlantInventoryItems(CUSTOM_STOCK_ITEMS, {
        query: '',
        category: ALL_FILTER,
        equipment: ALL_FILTER,
        statusFilter: 'NOMINAL',
      }).map((i) => i.id)
    ).toEqual(['nominal-item', 'surplus-item']);

    expect(
      filterPlantInventoryItems(CUSTOM_STOCK_ITEMS, {
        query: '  vLv-000 ',
        category: 'Wear Spares',
        equipment: 'Primary DMC Module CR-101',
        statusFilter: 'CRITICAL_OR_OOS',
      }).map((i) => i.id)
    ).toEqual(['oos-item']);

    expect(
      filterPlantInventoryItems(CUSTOM_STOCK_ITEMS, {
        query: 'hydrated lime',
        category: ALL_FILTER,
        equipment: ALL_FILTER,
        statusFilter: 'ALL',
      }).map((i) => i.id)
    ).toEqual(['surplus-item']);
  });

  it('escapes CSV cells against RFC-4180 quotes and spreadsheet formula injection', () => {
    expect(escapePlantCsvCell('Plain Value')).toBe('"Plain Value"');
    expect(escapePlantCsvCell('Size 32" Panel')).toBe('"Size 32"" Panel"');
    expect(escapePlantCsvCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
    expect(escapePlantCsvCell('+cmd|calc')).toBe('"\'+cmd|calc"');
    expect(escapePlantCsvCell('-1+1')).toBe('"\'-1+1"');
    expect(escapePlantCsvCell('@HYPERLINK')).toBe('"\'@HYPERLINK"');
    expect(escapePlantCsvCell('\tleading-tab')).toBe('"\'\tleading-tab"');
    expect(escapePlantCsvCell('\rleading-cr')).toBe('"\'\rleading-cr"');
  });

  it('builds full CSV output with header and escaped rows', () => {
    const formulaItem: PlantInventoryStockItem = {
      id: 'csv-1',
      stock: '=Injected "Stock"',
      code: 'CSV-01',
      category: 'Reagents',
      description: 'Test description',
      amountRequired: 10,
      amountPresent: 4,
      unit: 'kg',
      plantEquipment: 'Thickener TH-501',
    };
    const enriched = enrichPlantStockItems([formulaItem]);
    const csv = buildPlantInventoryCsv({ items: enriched, today: '2026-10-22' });
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      'Date,Code,Stock,Category,Plant Equipment,Amount Required,Amount Present,Unit,Shortfall,Coverage %,Status'
    );
    expect(lines[1]).toBe(
      '"2026-10-22","CSV-01","\'=Injected ""Stock""","Reagents","Thickener TH-501","10","4","kg","6","40","Critical (<50%)"'
    );

    const emptyCsv = buildPlantInventoryCsv({ items: [], today: '2026-10-22' });
    expect(emptyCsv.split('\n')).toHaveLength(1);
  });
});
