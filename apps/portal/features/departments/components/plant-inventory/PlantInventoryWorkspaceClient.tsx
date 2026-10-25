'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Input } from '@repo/ui/Input';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ClipboardList,
  History,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';

export type PlantInventoryViewMode =
  | 'dashboard'
  | 'inventory-list'
  | 'item-list'
  | 'stock-required'
  | 'history-of-used'
  | 'reports';

export interface PlantInventoryStockItem {
  id: string;
  stock: string;
  code: string;
  category: 'Dense Medium' | 'Reagents' | 'Wear Spares' | 'Screening & Crushing' | 'Stockpiles';
  description: string;
  amountRequired: number;
  amountPresent: number;
  unit: string;
  plantEquipment: string;
}

export interface PlantInventoryUsageEntry {
  id: string;
  date: string;
  shift: 'Day' | 'Night';
  stockId: string;
  stock: string;
  description: string;
  amountUsed: number;
  unit: string;
  circuitArea: string;
  plantEquipment: string;
  loggedBy: string;
}

const STOCK_STORAGE_KEY = 'arch_plant_inventory_stock_v1';
const USAGE_STORAGE_KEY = 'arch_plant_inventory_usage_v1';

export const INITIAL_PLANT_STOCK_ITEMS: readonly PlantInventoryStockItem[] = [
  {
    id: 'mag-superfine-fe3o4',
    stock: 'Magnetite Superfine Medium (96% Fe3O4)',
    code: 'DM-MAG-45UM',
    category: 'Dense Medium',
    description: '45μm PSD dense medium separation magnetite for Primary & Secondary DMC circuits',
    amountRequired: 180,
    amountPresent: 148.5,
    unit: 't',
    plantEquipment: 'Primary DMC Module CR-101',
  },
  {
    id: 'floc-anionic-934sh',
    stock: 'Anionic Flocculant SNF AN-934SH',
    code: 'RG-FLOC-934',
    category: 'Reagents',
    description: 'High-molecular-weight polymer powder for tailings thickener clarification',
    amountRequired: 40,
    amountPresent: 44,
    unit: 'bags (25kg)',
    plantEquipment: 'Tailings Thickener TH-501',
  },
  {
    id: 'frother-mibc-bulk',
    stock: 'MIBC Frother Reagent (IBC Bulk)',
    code: 'RG-MIBC-1000',
    category: 'Reagents',
    description: 'Methyl Isobutyl Carbinol flotation frother for fines beneficiation cells',
    amountRequired: 6000,
    amountPresent: 4200,
    unit: 'L',
    plantEquipment: 'Fines Flotation Bank SC-201',
  },
  {
    id: 'dmc-vortex-finders',
    stock: 'Dense Medium Cyclone Vortex Finders',
    code: 'DMC-850-VF-NI',
    category: 'Wear Spares',
    description: 'Ni-Hard 4 high-chrome liner vortex finders for 850mm Primary DMC module',
    amountRequired: 4,
    amountPresent: 2,
    unit: 'units',
    plantEquipment: 'Primary DMC Module CR-101',
  },
  {
    id: 'banana-screen-panels-32',
    stock: 'Banana Screen Polyurethane Panels (32mm)',
    code: 'SC-PU-305x610-32',
    category: 'Screening & Crushing',
    description: 'Modular pin-and-sleeve polyurethane deck panels for desliming & sizing screens',
    amountRequired: 48,
    amountPresent: 48,
    unit: 'panels',
    plantEquipment: 'Secondary Sizing Screen SC-201',
  },
  {
    id: 'jaw-toggle-plates',
    stock: 'Primary Jaw Crusher Toggle Plates',
    code: 'CR-JW-1104-TP',
    category: 'Screening & Crushing',
    description: 'Machined cast-steel overload protection toggle plates for primary ROM sizer',
    amountRequired: 3,
    amountPresent: 4,
    unit: 'sets',
    plantEquipment: 'Primary Jaw Crusher CR-101',
  },
  {
    id: 'warman-impellers-10-8',
    stock: 'Warman 10/8 Slurry Pump Impellers',
    code: 'WP-10/8-AH-A05',
    category: 'Wear Spares',
    description: '5-vane high-chrome A05 alloy impellers for correct medium & underflow pumps',
    amountRequired: 4,
    amountPresent: 3,
    unit: 'units',
    plantEquipment: 'Correct Medium Pump DM-301',
  },
  {
    id: 'centrifuge-baskets-w1400',
    stock: 'Coarse Coal Centrifuge Wedge-Wire Baskets',
    code: 'CF-WW-1400-05',
    category: 'Wear Spares',
    description: '0.5mm aperture stainless wedge-wire dewatering baskets for product centrifuges',
    amountRequired: 2,
    amountPresent: 2,
    unit: 'baskets',
    plantEquipment: 'Product Centrifuge DM-301',
  },
];

export const INITIAL_PLANT_USAGE_HISTORY: readonly PlantInventoryUsageEntry[] = [
  {
    id: 'use-101',
    date: '2026-10-22',
    shift: 'Day',
    stockId: 'mag-superfine-fe3o4',
    stock: 'Magnetite Superfine Medium (96% Fe3O4)',
    description:
      'Silo #1 top-up to Primary DMC correct medium sump during high-ash Seam 2 campaign',
    amountUsed: 12.5,
    unit: 't',
    circuitArea: 'Primary DMC Module A',
    plantEquipment: 'Primary DMC Module CR-101',
    loggedBy: 'S. Mokoena (Metallurgist)',
  },
  {
    id: 'use-102',
    date: '2026-10-21',
    shift: 'Night',
    stockId: 'banana-screen-panels-32',
    stock: 'Banana Screen Polyurethane Panels (32mm)',
    description: 'Replaced worn impact-zone panels on Secondary Sizing Screen Deck #2',
    amountUsed: 8,
    unit: 'panels',
    circuitArea: 'Desliming & Sizing Deck #2',
    plantEquipment: 'Secondary Sizing Screen SC-201',
    loggedBy: 'T. Khumalo (Plant Artisan)',
  },
  {
    id: 'use-103',
    date: '2026-10-21',
    shift: 'Day',
    stockId: 'floc-anionic-934sh',
    stock: 'Anionic Flocculant SNF AN-934SH',
    description: 'Dosing skid Tank A batch make-up for 1.32 SG thickener underflow target',
    amountUsed: 6,
    unit: 'bags (25kg)',
    circuitArea: 'Tailings Thickener Skid A',
    plantEquipment: 'Tailings Thickener TH-501',
    loggedBy: 'L. Ndlovu (Process Operator)',
  },
  {
    id: 'use-104',
    date: '2026-10-20',
    shift: 'Day',
    stockId: 'dmc-vortex-finders',
    stock: 'Dense Medium Cyclone Vortex Finders',
    description: 'Scheduled wear changeout on Primary Cyclone #3 during planned maintenance window',
    amountUsed: 1,
    unit: 'units',
    circuitArea: 'Primary & Secondary DMC Module',
    plantEquipment: 'Primary DMC Module CR-101',
    loggedBy: 'R. Botha (Mechanical Foreman)',
  },
  {
    id: 'use-105',
    date: '2026-10-19',
    shift: 'Night',
    stockId: 'frother-mibc-bulk',
    stock: 'MIBC Frother Reagent (IBC Bulk)',
    description: 'Transferred to flotation header tank for ultra-fine coal recovery circuit',
    amountUsed: 450,
    unit: 'L',
    circuitArea: 'Fines Flotation Bank',
    plantEquipment: 'Fines Flotation Bank SC-201',
    loggedBy: 'L. Ndlovu (Process Operator)',
  },
];

function formatQty(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function PlantInventoryWorkspaceClient({
  mode,
  today,
}: {
  mode: PlantInventoryViewMode;
  today: string;
}) {
  const [stockItems, setStockItems] = useState<PlantInventoryStockItem[]>(() => [
    ...INITIAL_PLANT_STOCK_ITEMS,
  ]);
  const [usageHistory, setUsageHistory] = useState<PlantInventoryUsageEntry[]>(() => [
    ...INITIAL_PLANT_USAGE_HISTORY,
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Add Item Form State (used in `item-list` view)
  const [newStockName, setNewStockName] = useState('');
  const [newStockCode, setNewStockCode] = useState('');
  const [newCategory, setNewCategory] =
    useState<PlantInventoryStockItem['category']>('Wear Spares');
  const [newDescription, setNewDescription] = useState('');
  const [newAmountRequired, setNewAmountRequired] = useState('');
  const [newAmountPresent, setNewAmountPresent] = useState('');
  const [newUnit, setNewUnit] = useState('units');
  const [newPlantEquipment, setNewPlantEquipment] = useState('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Log Usage Form State (used in `history-of-used` view)
  const [usageStockId, setUsageStockId] = useState<string>(
    INITIAL_PLANT_STOCK_ITEMS[0]?.id ?? 'mag-superfine-fe3o4'
  );
  const [usageAmount, setUsageAmount] = useState('');
  const [usageShift, setUsageShift] = useState<'Day' | 'Night'>('Day');
  const [usageCircuit, setUsageCircuit] = useState('Primary DMC Module');
  const [usageEquipment, setUsageEquipment] = useState('');
  const [usageNotes, setUsageNotes] = useState('');
  const [usageOperator, setUsageOperator] = useState('Plant Shift Supervisor');
  const [usageFeedback, setUsageFeedback] = useState<string | null>(null);

  // Hydrate persisted inventory & usage history from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawStock = window.localStorage.getItem(STOCK_STORAGE_KEY);
      if (rawStock) {
        const parsed = JSON.parse(rawStock) as PlantInventoryStockItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStockItems(parsed);
        }
      }
      const rawUsage = window.localStorage.getItem(USAGE_STORAGE_KEY);
      if (rawUsage) {
        const parsedUsage = JSON.parse(rawUsage) as PlantInventoryUsageEntry[];
        if (Array.isArray(parsedUsage) && parsedUsage.length > 0) {
          setUsageHistory(parsedUsage);
        }
      }
    } catch {
      // Ignore storage read errors in restricted environments
    }
  }, []);

  const persistStockItems = (nextItems: PlantInventoryStockItem[]) => {
    setStockItems(nextItems);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(nextItems));
      } catch {
        // Ignore storage quota errors
      }
    }
  };

  const persistUsageHistory = (nextHistory: PlantInventoryUsageEntry[]) => {
    setUsageHistory(nextHistory);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(nextHistory));
      } catch {
        // Ignore storage quota errors
      }
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedStock = newStockName.trim();
    const trimmedDesc = newDescription.trim();
    const trimmedEquipment = newPlantEquipment.trim();
    const reqNum = Number(newAmountRequired);
    const presNum = Number(newAmountPresent);

    if (
      !trimmedStock ||
      !trimmedDesc ||
      !trimmedEquipment ||
      Number.isNaN(reqNum) ||
      reqNum < 0 ||
      Number.isNaN(presNum) ||
      presNum < 0
    ) {
      setFormFeedback(
        'Please provide a valid stock name, description, plant equipment, amount required, and amount present.'
      );
      return;
    }

    const generatedCode =
      newStockCode.trim().toUpperCase() ||
      `PI-${trimmedStock
        .slice(0, 4)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, 'X')}-${String(stockItems.length + 101)}`;

    const createdItem: PlantInventoryStockItem = {
      id: `item-${Date.now()}`,
      stock: trimmedStock,
      code: generatedCode,
      category: newCategory,
      description: trimmedDesc,
      amountRequired: reqNum,
      amountPresent: presNum,
      unit: newUnit.trim() || 'units',
      plantEquipment: trimmedEquipment,
    };

    const updated = [createdItem, ...stockItems];
    persistStockItems(updated);

    setNewStockName('');
    setNewStockCode('');
    setNewDescription('');
    setNewAmountRequired('');
    setNewAmountPresent('');
    setNewUnit('units');
    setNewPlantEquipment('');
    setFormFeedback(`Added "${createdItem.stock}" to the Plant Inventory stock list.`);
  };

  const handleRestockItem = (itemId: string) => {
    const updated = stockItems.map((item) =>
      item.id === itemId ? { ...item, amountPresent: item.amountRequired } : item
    );
    persistStockItems(updated);
  };

  const handleRecordUsage = (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = stockItems.find((i) => i.id === usageStockId);
    const usedNum = Number(usageAmount);
    if (!targetItem || Number.isNaN(usedNum) || usedNum <= 0) {
      setUsageFeedback('Please enter a valid positive quantity used.');
      return;
    }

    const entry: PlantInventoryUsageEntry = {
      id: `use-${Date.now()}`,
      date: today,
      shift: usageShift,
      stockId: targetItem.id,
      stock: targetItem.stock,
      description: usageNotes.trim() || targetItem.description,
      amountUsed: usedNum,
      unit: targetItem.unit,
      circuitArea: usageCircuit.trim() || 'CHPP Main Circuit',
      plantEquipment: usageEquipment.trim() || targetItem.plantEquipment,
      loggedBy: usageOperator.trim() || 'Plant Operator',
    };

    const nextHistory = [entry, ...usageHistory];
    persistUsageHistory(nextHistory);

    const nextStock = stockItems.map((item) =>
      item.id === targetItem.id
        ? {
            ...item,
            amountPresent: Math.max(0, Number((item.amountPresent - usedNum).toFixed(2))),
          }
        : item
    );
    persistStockItems(nextStock);

    setUsageAmount('');
    setUsageEquipment('');
    setUsageNotes('');
    setUsageFeedback(
      `Logged ${usedNum} ${targetItem.unit} of "${targetItem.stock}" used against ${entry.plantEquipment}.`
    );
  };

  const filteredStockItems = useMemo(() => {
    return stockItems.filter((item) => {
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.stock.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.plantEquipment.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [stockItems, selectedCategory, searchQuery]);

  const stockRequiredItems = useMemo(
    () => filteredStockItems.filter((item) => item.amountPresent < item.amountRequired),
    [filteredStockItems]
  );

  const totalRequiredCount = useMemo(
    () => stockItems.filter((item) => item.amountPresent < item.amountRequired).length,
    [stockItems]
  );

  const nominalCount = stockItems.length - totalRequiredCount;

  const totalDrawdown = useMemo(
    () => usageHistory.reduce((sum, entry) => sum + entry.amountUsed, 0),
    [usageHistory]
  );

  const equipmentList = useMemo(
    () => [...new Set(stockItems.map((item) => item.plantEquipment))].sort(),
    [stockItems]
  );

  // Performance Optimization: Precompute per-equipment stock line counts, shortfalls, and usage drawdowns in a single pass Map.
  // Replaces O(E * (U + S)) nested filtering inside component rendering with O(E + U + S) indexing and O(1) Map lookups.
  const equipmentMetrics = useMemo(() => {
    const map = new Map<
      string,
      { eqDrawdown: number; eqUsageCount: number; eqStockLines: number; eqShortfall: number }
    >();

    for (const eq of equipmentList) {
      map.set(eq, { eqDrawdown: 0, eqUsageCount: 0, eqStockLines: 0, eqShortfall: 0 });
    }

    for (const entry of usageHistory) {
      const stats = map.get(entry.plantEquipment);
      if (stats) {
        stats.eqDrawdown += entry.amountUsed;
        stats.eqUsageCount += 1;
      }
    }

    for (const item of stockItems) {
      const stats = map.get(item.plantEquipment);
      if (stats) {
        stats.eqStockLines += 1;
        if (item.amountPresent < item.amountRequired) {
          stats.eqShortfall += 1;
        }
      }
    }

    return map;
  }, [equipmentList, usageHistory, stockItems]);

  // ─── 0. STOCK CONTROL DASHBOARD (/plant-inventory) ─────────────────────────
  if (mode === 'dashboard') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <BarChart2 className="h-6 w-6 text-[var(--accent-blue)]" aria-hidden="true" />
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">Stock Dashboard</h2>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Plant equipment stock overview for consumables, reagents, and wear spares tracked per
              piece of plant equipment (crushers, screens, pumps, cyclones, thickeners — not mobile
              mining machines).
            </p>
          </div>
          <div className="self-start rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[var(--text-muted)] text-xs sm:self-auto">
            Operational Date:{' '}
            <span className="font-semibold text-[var(--text-heading)]">{today}</span>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <GlassCard>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Total Stock Lines
            </p>
            <p className="mt-1 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {stockItems.length}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Nominal Stock Levels
            </p>
            <p className="mt-1 font-bold font-mono text-2xl text-[var(--accent-green)]">
              {nominalCount}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Stock Required Alerts
            </p>
            <p className="mt-1 font-bold font-mono text-2xl text-[var(--accent-alert)]">
              {totalRequiredCount}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Equipment Tracked
            </p>
            <p className="mt-1 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {equipmentList.length}
            </p>
          </GlassCard>
        </div>

        {/* Stock Required Quick List */}
        <GlassCard className="overflow-hidden p-0">
          <div className="border-[var(--border-default)] border-b p-4">
            <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
              <AlertTriangle className="h-4 w-4 text-[var(--accent-alert)]" aria-hidden="true" />
              Items Requiring Replenishment
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label="Stock Required Quick List">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                  <th
                    scope="col"
                    className="px-6 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Stock
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Plant Equipment
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Required
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Present
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {stockRequiredItems.slice(0, 5).map((item) => {
                  const shortfall = Math.max(
                    0,
                    Number((item.amountRequired - item.amountPresent).toFixed(2))
                  );
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-[var(--bg-secondary)]/60"
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-[var(--text-heading)] text-sm">
                          {item.stock}
                        </div>
                        <div className="font-mono text-[var(--text-muted)] text-xs">
                          {item.code}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                        {item.plantEquipment}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top font-mono text-[var(--text-heading)] text-sm">
                        {formatQty(item.amountRequired)} {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top font-bold font-mono text-[var(--accent-alert)] text-sm">
                        {formatQty(item.amountPresent)} {item.unit} ({-formatQty(shortfall)})
                      </td>
                    </tr>
                  );
                })}
                {stockRequiredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-[var(--text-muted)] text-sm"
                    >
                      <div className="inline-flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        All plant inventory items meet or exceed their required par quantities.
                      </div>
                    </td>
                  </tr>
                )}
                {stockRequiredItems.length > 5 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-4 text-center text-[var(--text-muted)] text-sm"
                    >
                      Showing 5 of {stockRequiredItems.length} items requiring replenishment.{' '}
                      <a
                        href="/plant-inventory/history"
                        className="text-[var(--accent-blue)] underline underline-offset-4 hover:text-[var(--accent-blue)]/80"
                      >
                        View all stock required
                      </a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Equipment Trend Summary */}
        <GlassCard className="overflow-hidden p-0">
          <div className="border-[var(--border-default)] border-b p-4">
            <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
              <TrendingUp className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
              Stock Drawdown by Equipment
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {equipmentList.map((equipment) => {
              const metrics = equipmentMetrics.get(equipment) ?? {
                eqDrawdown: 0,
                eqUsageCount: 0,
                eqStockLines: 0,
                eqShortfall: 0,
              };
              return (
                <GlassCard
                  key={equipment}
                  className="p-4 transition-colors hover:border-[var(--border-default)]"
                >
                  <div className="mb-1 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                    {equipment}
                  </div>
                  <div className="font-bold font-mono text-[var(--text-heading)] text-lg">
                    {formatQty(metrics.eqDrawdown)}
                  </div>
                  <div className="mt-1 text-[var(--text-secondary)] text-xs">
                    {metrics.eqStockLines} stock lines{' '}
                    {metrics.eqShortfall > 0 ? ` · ${metrics.eqShortfall} below par` : ' · all nominal'}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── 1. INVENTORY LIST (/plant-inventory/daily-log) ────────────────────────
  if (mode === 'inventory-list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <ClipboardList className="h-6 w-6 text-[var(--accent-blue)]" aria-hidden="true" />
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">Inventory List</h2>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Live CHPP reagents, dense medium magnetite, crusher spares, and consumables balance
              ledger tracked per plant equipment.
            </p>
          </div>
          <div className="self-start rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[var(--text-muted)] text-xs sm:self-auto">
            Operational Date:{' '}
            <span className="font-semibold text-[var(--text-heading)]">{today}</span>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassCard>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Total Stock Lines
            </p>
            <p className="mt-1 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {stockItems.length}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Nominal Stock Levels
            </p>
            <p className="mt-1 font-bold font-mono text-2xl text-[var(--accent-green)]">
              {nominalCount}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Stock Required Alerts
            </p>
            <p className="mt-1 font-bold font-mono text-2xl text-[var(--accent-alert)]">
              {totalRequiredCount}
            </p>
          </GlassCard>
        </div>

        {/* Filter Bar */}
        <GlassCard className="p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stock, code, equipment, or description..."
                aria-label="Search inventory list"
                className="w-full pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                ['ALL', 'Dense Medium', 'Reagents', 'Wear Spares', 'Screening & Crushing'] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 font-medium text-xs transition-colors ${
                    selectedCategory === cat
                      ? 'border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                      : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {cat === 'ALL' ? 'All Categories' : cat}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Inventory List Table: Stock, Description, Amount Required, Amount Present */}
        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label="Plant Inventory List">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Stock
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Description
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Amount Required
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Amount Present
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredStockItems.map((item) => {
                  const isShortfall = item.amountPresent < item.amountRequired;
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-[var(--bg-secondary)]/60"
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-[var(--text-heading)] text-sm">
                          {item.stock}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[var(--text-muted)] text-xs">
                            {item.code}
                          </span>
                          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                            {item.category}
                          </span>
                          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                            {item.plantEquipment}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-md px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                        {item.description}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top font-medium font-mono text-[var(--text-heading)] text-sm">
                        {formatQty(item.amountRequired)} {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top">
                        <div className="inline-flex items-center justify-end gap-2">
                          <span
                            className={`font-bold font-mono text-sm ${
                              isShortfall
                                ? 'text-[var(--accent-alert)]'
                                : 'text-[var(--accent-green)]'
                            }`}
                          >
                            {formatQty(item.amountPresent)} {item.unit}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 font-medium text-[11px] ${
                              isShortfall
                                ? 'border-[var(--accent-alert)]/30 bg-[var(--accent-alert)]/10 text-[var(--accent-alert)]'
                                : 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]'
                            }`}
                          >
                            {isShortfall ? 'Replenish' : 'Nominal'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredStockItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-[var(--text-muted)] text-sm"
                    >
                      No stock items match the current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── 2. ITEM LIST (/plant-inventory/machines) ──────────────────────────────
  if (mode === 'item-list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <PackagePlus className="h-6 w-6 text-[var(--accent-blue)]" aria-hidden="true" />
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">Item List</h2>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Register new stock items, spare parts, or reagents into the Plant Inventory master
              stock list, assigned to specific plant equipment.
            </p>
          </div>
          <span className="self-start rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[var(--text-muted)] text-xs sm:self-auto">
            Catalog Items:{' '}
            <strong className="text-[var(--text-heading)]">{stockItems.length}</strong>
          </span>
        </div>

        {/* Add New Item to Stock List Form */}
        <GlassCard>
          <div className="mb-4">
            <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
              <Plus className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
              Add New Item to Stock List
            </h3>
            <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
              New items added here are immediately synchronized with Inventory List and Stock
              Required views.
            </p>
          </div>

          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label
                  htmlFor="plant-item-stock"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Stock Name
                </label>
                <Input
                  id="plant-item-stock"
                  type="text"
                  required
                  value={newStockName}
                  onChange={(e) => setNewStockName(e.target.value)}
                  placeholder="e.g. Secondary Cyclone Apex Insert"
                />
              </div>
              <div>
                <label
                  htmlFor="plant-item-code"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Part / Stock Code
                </label>
                <Input
                  id="plant-item-code"
                  type="text"
                  value={newStockCode}
                  onChange={(e) => setNewStockCode(e.target.value)}
                  placeholder="e.g. DMC-650-APX"
                />
              </div>
              <div>
                <label
                  htmlFor="plant-item-category"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Category
                </label>
                <select
                  id="plant-item-category"
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as PlantInventoryStockItem['category'])
                  }
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                >
                  <option value="Wear Spares">Wear Spares</option>
                  <option value="Dense Medium">Dense Medium</option>
                  <option value="Reagents">Reagents</option>
                  <option value="Screening & Crushing">Screening &amp; Crushing</option>
                  <option value="Stockpiles">Stockpiles</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label
                  htmlFor="plant-item-description"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Description
                </label>
                <Input
                  id="plant-item-description"
                  type="text"
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Circuit location, specification, and operational purpose"
                />
              </div>
              <div>
                <label
                  htmlFor="plant-item-required"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Amount Required
                </label>
                <Input
                  id="plant-item-required"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={newAmountRequired}
                  onChange={(e) => setNewAmountRequired(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="plant-item-present"
                    className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Amount Present
                  </label>
                  <Input
                    id="plant-item-present"
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={newAmountPresent}
                    onChange={(e) => setNewAmountPresent(e.target.value)}
                    placeholder="e.g. 8"
                  />
                </div>
                <div>
                  <label
                    htmlFor="plant-item-unit"
                    className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Unit
                  </label>
                  <Input
                    id="plant-item-unit"
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="units / t / L"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="plant-item-equipment"
                className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
              >
                Plant Equipment (e.g. CR-101, SC-201, DM-301, TH-501)
              </label>
              <Input
                id="plant-item-equipment"
                type="text"
                required
                value={newPlantEquipment}
                onChange={(e) => setNewPlantEquipment(e.target.value)}
                placeholder="e.g. Primary Jaw Crusher CR-101"
              />
            </div>

            <div className="flex flex-col justify-between gap-3 pt-2 sm:flex-row sm:items-center">
              {formFeedback ? (
                <p className="font-medium text-[var(--accent-blue)] text-xs" role="status">
                  {formFeedback}
                </p>
              ) : (
                <span className="text-[var(--text-muted)] text-xs">
                  All fields marked required must be completed before adding to stock list.
                </span>
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-sm text-white transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Item to Stock List
              </button>
            </div>
          </form>
        </GlassCard>

        {/* Master Item List Table */}
        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label="Registered Stock Item List">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Stock
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Description
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Amount Required
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Amount Present
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Plant Equipment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {stockItems.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-[var(--bg-secondary)]/60">
                    <td className="px-6 py-4 align-top">
                      <div className="font-semibold text-[var(--text-heading)] text-sm">
                        {item.stock}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-[var(--text-muted)] text-xs">
                          {item.code}
                        </span>
                        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                          {item.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                      {item.description}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right align-top font-mono text-[var(--text-heading)] text-sm">
                      {formatQty(item.amountRequired)} {item.unit}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right align-top font-mono font-semibold text-[var(--text-heading)] text-sm">
                      {formatQty(item.amountPresent)} {item.unit}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                      {item.plantEquipment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── 3. STOCK REQUIRED (/plant-inventory/history) ──────────────────────────
  if (mode === 'stock-required') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-6 w-6 text-[var(--accent-alert)]" aria-hidden="true" />
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">Stock Required</h2>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Replenishment queue for plant consumables, reagents, and wear spares below required
              par levels.
            </p>
          </div>
          <div className="self-start rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[var(--text-muted)] text-xs sm:self-auto">
            Items Requiring Replenishment:{' '}
            <strong className="text-[var(--accent-alert)]">{stockRequiredItems.length}</strong>
          </div>
        </div>

        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label="Stock Required Table">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Stock
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Description
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Amount Required
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Amount Present
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Shortfall
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Plant Equipment
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {stockRequiredItems.map((item) => {
                  const shortfall = Math.max(
                    0,
                    Number((item.amountRequired - item.amountPresent).toFixed(2))
                  );
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-[var(--bg-secondary)]/60"
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-[var(--text-heading)] text-sm">
                          {item.stock}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[var(--text-muted)] text-xs">
                            {item.code}
                          </span>
                          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                            {item.category}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-md px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                        {item.description}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top font-mono text-[var(--text-heading)] text-sm">
                        {formatQty(item.amountRequired)} {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top font-bold font-mono text-[var(--accent-alert)] text-sm">
                        {formatQty(item.amountPresent)} {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top font-bold font-mono text-[var(--accent-alert)] text-sm">
                        -{formatQty(shortfall)} {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                        {item.plantEquipment}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top">
                        <button
                          type="button"
                          onClick={() => handleRestockItem(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs transition-colors hover:border-[var(--accent-blue)]"
                        >
                          <RefreshCw
                            className="h-3.5 w-3.5 text-[var(--accent-blue)]"
                            aria-hidden="true"
                          />
                          Mark Restocked
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {stockRequiredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-[var(--text-muted)] text-sm"
                    >
                      <div className="inline-flex items-center gap-2 font-medium text-[var(--accent-green)] text-sm">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        All plant inventory items meet or exceed their required par quantities.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── 4. HISTORY OF USED (/plant-inventory/tools) ───────────────────────────
  if (mode === 'history-of-used') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <History className="h-6 w-6 text-[var(--accent-blue)]" aria-hidden="true" />
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">History of Used</h2>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Chronological consumption log of reagents, magnetite medium, and critical wear spares
              drawn across shifts, tracked per plant equipment.
            </p>
          </div>
          <div className="self-start rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[var(--text-muted)] text-xs sm:self-auto">
            Recorded Drawdowns:{' '}
            <strong className="text-[var(--text-heading)]">{usageHistory.length}</strong>
          </div>
        </div>

        {/* Log Stock Used Form */}
        <GlassCard>
          <div className="mb-4">
            <h3 className="font-bold text-[var(--text-heading)] text-base">Record Stock Used</h3>
            <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
              Logging stock usage automatically deducts the quantity from Amount Present in the
              Inventory List.
            </p>
          </div>

          <form onSubmit={handleRecordUsage} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label
                  htmlFor="usage-stock-select"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Stock Item
                </label>
                <select
                  id="usage-stock-select"
                  value={usageStockId}
                  onChange={(e) => setUsageStockId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                >
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.stock} ({formatQty(item.amountPresent)} {item.unit} present)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="usage-amount-input"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Amount Used
                </label>
                <Input
                  id="usage-amount-input"
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={usageAmount}
                  onChange={(e) => setUsageAmount(e.target.value)}
                  placeholder="e.g. 4"
                />
              </div>
              <div>
                <label
                  htmlFor="usage-shift-select"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Shift
                </label>
                <select
                  id="usage-shift-select"
                  value={usageShift}
                  onChange={(e) => setUsageShift(e.target.value as 'Day' | 'Night')}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                >
                  <option value="Day">Day Shift</option>
                  <option value="Night">Night Shift</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label
                  htmlFor="usage-circuit-input"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Circuit / Work Area
                </label>
                <Input
                  id="usage-circuit-input"
                  type="text"
                  value={usageCircuit}
                  onChange={(e) => setUsageCircuit(e.target.value)}
                  placeholder="e.g. Primary DMC Module"
                />
              </div>
              <div>
                <label
                  htmlFor="usage-equipment-input"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Plant Equipment
                </label>
                <Input
                  id="usage-equipment-input"
                  type="text"
                  value={usageEquipment}
                  onChange={(e) => setUsageEquipment(e.target.value)}
                  placeholder="e.g. Primary Jaw Crusher CR-101"
                />
              </div>
              <div>
                <label
                  htmlFor="usage-notes-input"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Usage Description / Work Order
                </label>
                <Input
                  id="usage-notes-input"
                  type="text"
                  value={usageNotes}
                  onChange={(e) => setUsageNotes(e.target.value)}
                  placeholder="Reason for drawdown or maintenance note"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label
                  htmlFor="usage-operator-input"
                  className="mb-1 block font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Logged By
                </label>
                <Input
                  id="usage-operator-input"
                  type="text"
                  value={usageOperator}
                  onChange={(e) => setUsageOperator(e.target.value)}
                  placeholder="Operator / Metallurgist name"
                />
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3 pt-2 sm:flex-row sm:items-center">
              {usageFeedback ? (
                <p className="font-medium text-[var(--accent-blue)] text-xs" role="status">
                  {usageFeedback}
                </p>
              ) : (
                <span className="text-[var(--text-muted)] text-xs">
                  Each entry is recorded with shift timestamp and operator attribution.
                </span>
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-sm text-white transition-opacity hover:opacity-90"
              >
                Record Used Stock
              </button>
            </div>
          </form>
        </GlassCard>

        {/* History of Used Table */}
        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label="History of Used Stock">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Date &amp; Shift
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Stock
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Plant Equipment
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Amount Used
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                  >
                    Logged By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {usageHistory.map((entry) => (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-[var(--bg-secondary)]/60"
                  >
                    <td className="whitespace-nowrap px-6 py-4 align-top">
                      <div className="font-mono font-semibold text-[var(--text-heading)] text-sm">
                        {entry.date}
                      </div>
                      <span className="mt-1 inline-block rounded-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                        {entry.shift} Shift
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="font-semibold text-[var(--text-heading)] text-sm">
                        {entry.stock}
                      </div>
                      <div className="mt-0.5 text-[var(--accent-blue)] text-xs">
                        {entry.circuitArea}
                      </div>
                      <div className="mt-0.5 text-[var(--text-secondary)] text-xs">
                        {entry.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                      {entry.plantEquipment}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right align-top font-bold font-mono text-[var(--text-heading)] text-sm">
                      {formatQty(entry.amountUsed)} {entry.unit}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                      {entry.loggedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── 5. REPORTS (/plant-inventory/reports) ─────────────────────────────────
  if (mode === 'reports') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <BarChart2 className="h-6 w-6 text-[var(--accent-blue)]" aria-hidden="true" />
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">Reports</h2>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Plant equipment stock control reports: drawdown trends, replenishment demand, and
              consumption by equipment across shifts.
            </p>
          </div>
          <div className="self-start rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[var(--text-muted)] text-xs sm:self-auto">
            Operational Date:{' '}
            <span className="font-semibold text-[var(--text-heading)]">{today}</span>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Stock Required Report */}
          <GlassCard className="overflow-hidden p-0">
            <div className="border-[var(--border-default)] border-b p-4">
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
                <AlertTriangle className="h-4 w-4 text-[var(--accent-alert)]" aria-hidden="true" />
                Replenishment Demand Report
              </h3>
            </div>
            <div className="p-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                    <th
                      scope="col"
                      className="px-4 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Stock
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Plant Equipment
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Required
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Present
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Shortfall
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {stockRequiredItems.map((item) => {
                    const shortfall = Math.max(
                      0,
                      Number((item.amountRequired - item.amountPresent).toFixed(2))
                    );
                    return (
                      <tr key={item.id} className="hover:bg-[var(--bg-secondary)]/60">
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-[var(--text-heading)] text-sm">
                            {item.stock}
                          </div>
                          <div className="font-mono text-[var(--text-muted)] text-xs">
                            {item.code}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-[var(--text-secondary)] text-sm">
                          {item.plantEquipment}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-top font-mono text-[var(--text-heading)] text-sm">
                          {formatQty(item.amountRequired)} {item.unit}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-top font-bold font-mono text-[var(--accent-alert)] text-sm">
                          {formatQty(item.amountPresent)} {item.unit}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-top font-bold font-mono text-[var(--accent-alert)] text-sm">
                          -{formatQty(shortfall)} {item.unit}
                        </td>
                      </tr>
                    );
                  })}
                  {stockRequiredItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-[var(--text-muted)] text-sm"
                      >
                        <div className="inline-flex items-center gap-2 font-medium text-[var(--accent-green)] text-sm">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          All plant inventory items meet par quantities.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Consumption by Equipment Report */}
          <GlassCard className="overflow-hidden p-0">
            <div className="border-[var(--border-default)] border-b p-4">
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
                <TrendingDown className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
                Consumption by Plant Equipment
              </h3>
            </div>
            <div className="p-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                    <th
                      scope="col"
                      className="px-4 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Plant Equipment
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Total Drawdown
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Entries
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Stock Lines
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                    >
                      Below Par
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {equipmentList.map((equipment) => {
                    const metrics = equipmentMetrics.get(equipment) ?? {
                      eqDrawdown: 0,
                      eqUsageCount: 0,
                      eqStockLines: 0,
                      eqShortfall: 0,
                    };
                    return (
                      <tr key={equipment} className="hover:bg-[var(--bg-secondary)]/60">
                        <td className="px-4 py-3 align-top text-[var(--text-heading)] text-sm">
                          {equipment}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-top font-mono text-[var(--text-heading)] text-sm">
                          {formatQty(metrics.eqDrawdown)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-top font-mono text-[var(--text-secondary)] text-sm">
                          {metrics.eqUsageCount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-top font-mono text-[var(--text-secondary)] text-sm">
                          {metrics.eqStockLines}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-top font-mono text-[var(--text-secondary)] text-sm">
                          {metrics.eqShortfall}
                        </td>
                      </tr>
                    );
                  })}
                  {equipmentList.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-[var(--text-muted)] text-sm"
                      >
                        No plant equipment stock lines tracked yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return null;
}
