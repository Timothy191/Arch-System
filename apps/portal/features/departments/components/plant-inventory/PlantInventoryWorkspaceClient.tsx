'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Input } from '@repo/ui/Input';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ClipboardList,
  Search,
  TrendingUp,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  getPlantInventoryWorkspaceData,
  recordPlantInventoryUsageAction,
  updatePlantInventoryAmountsAction,
  upsertPlantInventoryItemAction,
} from './actions';
import {
  PlantInventoryItemListView,
  PlantInventoryReportsView,
  PlantInventoryStockRequiredView,
  PlantInventoryUsageHistoryView,
} from './PlantInventorySecondaryViews';
import {
  formatQty,
  getStockStatusBadgeClass,
  INITIAL_PLANT_STOCK_ITEMS,
  INITIAL_PLANT_USAGE_HISTORY,
  type PlantInventoryStockItem,
  type PlantInventoryUsageEntry,
  type PlantInventoryViewMode,
  STOCK_STORAGE_KEY,
  USAGE_STORAGE_KEY,
} from './plant-inventory-seeds';
import { computeStockAutomatedFlags } from './stock-flags';

export {
  INITIAL_PLANT_STOCK_ITEMS,
  type PlantInventoryStockItem,
  type PlantInventoryUsageEntry,
  type PlantInventoryViewMode,
};

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

  // Inline Required / Have Amount Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editRequiredValue, setEditRequiredValue] = useState<string>('');
  const [editPresentValue, setEditPresentValue] = useState<string>('');
  const [inlineFeedback, setInlineFeedback] = useState<string | null>(null);

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

  // Hydrate persisted inventory & usage history from localStorage and remote Supabase on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let hasLocalStock = false;
    try {
      const rawStock = window.localStorage.getItem(STOCK_STORAGE_KEY);
      if (rawStock) {
        const parsed = JSON.parse(rawStock) as PlantInventoryStockItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasLocalStock = true;
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

    if (!hasLocalStock) {
      let active = true;
      void getPlantInventoryWorkspaceData()
        .then((remote) => {
          if (!active || !remote) return;
          if (remote.items.length > 0) {
            setStockItems(remote.items);
          }
          if (remote.usage.length > 0) {
            setUsageHistory(remote.usage);
          }
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }
    return undefined;
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

  const startInlineEditAmounts = (item: PlantInventoryStockItem) => {
    setEditingItemId(item.id);
    setEditRequiredValue(String(item.amountRequired));
    setEditPresentValue(String(item.amountPresent));
    setInlineFeedback(null);
  };

  const handleSaveInlineAmounts = (item: PlantInventoryStockItem) => {
    const reqNum = Number(editRequiredValue);
    const presNum = Number(editPresentValue);
    if (Number.isNaN(reqNum) || reqNum < 0 || Number.isNaN(presNum) || presNum < 0) {
      return;
    }
    const flags = computeStockAutomatedFlags(reqNum, presNum);
    const updated = stockItems.map((row) =>
      row.id === item.id ? { ...row, amountRequired: reqNum, amountPresent: presNum } : row
    );
    persistStockItems(updated);
    setEditingItemId(null);
    setInlineFeedback(
      `Updated "${item.stock}" — Required: ${formatQty(reqNum)} ${item.unit}, Have: ${formatQty(presNum)} ${item.unit} (${flags.statusLabel}, ${flags.coveragePct}% coverage).`
    );
    void updatePlantInventoryAmountsAction({
      id: item.id,
      code: item.code,
      amountRequired: reqNum,
      amountPresent: presNum,
    }).catch(() => undefined);
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

    void upsertPlantInventoryItemAction({
      stock: createdItem.stock,
      code: createdItem.code,
      category: createdItem.category,
      description: createdItem.description,
      amountRequired: createdItem.amountRequired,
      amountPresent: createdItem.amountPresent,
      unit: createdItem.unit,
      plantEquipment: createdItem.plantEquipment,
    }).catch(() => undefined);

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
    const target = stockItems.find((item) => item.id === itemId);
    const updated = stockItems.map((item) =>
      item.id === itemId ? { ...item, amountPresent: item.amountRequired } : item
    );
    persistStockItems(updated);
    if (target) {
      void updatePlantInventoryAmountsAction({
        id: target.id,
        code: target.code,
        amountRequired: target.amountRequired,
        amountPresent: target.amountRequired,
      }).catch(() => undefined);
    }
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

    void recordPlantInventoryUsageAction({
      stockId: targetItem.id,
      stockCode: targetItem.code,
      stockName: targetItem.stock,
      date: entry.date,
      shift: entry.shift,
      amountUsed: entry.amountUsed,
      unit: entry.unit,
      circuitArea: entry.circuitArea,
      plantEquipment: entry.plantEquipment,
      description: entry.description,
      loggedBy: entry.loggedBy,
    }).catch(() => undefined);

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

  const equipmentList = useMemo(
    () => [...new Set(stockItems.map((item) => item.plantEquipment))].sort(),
    [stockItems]
  );

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
                    {metrics.eqShortfall > 0
                      ? ` · ${metrics.eqShortfall} below par`
                      : ' · all nominal'}
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

        {inlineFeedback && (
          <div
            role="status"
            className="rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-4 py-2.5 font-medium text-[var(--accent-blue)] text-xs"
          >
            {inlineFeedback}
          </div>
        )}

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
                  const flags = computeStockAutomatedFlags(item.amountRequired, item.amountPresent);
                  const isShortfall = flags.needsReplenishment;
                  const isEditing = editingItemId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-[var(--bg-secondary)]/60"
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-[var(--text-heading)] text-sm">
                          {item.stock}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
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
                        {isEditing ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              aria-label={`Edit Amount Required for ${item.stock}`}
                              value={editRequiredValue}
                              onChange={(e) => setEditRequiredValue(e.target.value)}
                              className="w-24 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-right font-mono text-[var(--text-heading)] text-xs"
                            />
                            <span className="text-[var(--text-muted)] text-xs">{item.unit}</span>
                          </div>
                        ) : (
                          <span>
                            {formatQty(item.amountRequired)} {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right align-top">
                        {isEditing ? (
                          <div className="flex flex-col items-end gap-2">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                aria-label={`Edit Have Amount for ${item.stock}`}
                                value={editPresentValue}
                                onChange={(e) => setEditPresentValue(e.target.value)}
                                className="w-24 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-right font-mono text-[var(--text-heading)] text-xs"
                              />
                              <span className="text-[var(--text-muted)] text-xs">{item.unit}</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveInlineAmounts(item)}
                                className="rounded-md bg-[var(--accent-blue)] px-2.5 py-1 font-semibold text-[11px] text-white"
                              >
                                Save Amounts
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1 font-medium text-[11px] text-[var(--text-secondary)]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
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
                              <span className={getStockStatusBadgeClass(flags.stockStatus)}>
                                {flags.statusLabel}
                              </span>
                            </div>
                            <div className="inline-flex items-center justify-end gap-2 font-mono text-[11px] text-[var(--text-muted)]">
                              <span>{flags.coveragePct}% coverage</span>
                              {flags.needsReplenishment && (
                                <span className="font-semibold text-[var(--accent-alert)]">
                                  Auto-Reorder (-{formatQty(flags.shortfallAmount)} {item.unit})
                                </span>
                              )}
                              {!flags.needsReplenishment && flags.surplusAmount > 0 && (
                                <span className="text-[var(--accent-green)]">
                                  +{formatQty(flags.surplusAmount)} {item.unit} surplus
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => startInlineEditAmounts(item)}
                                aria-label={`Update Required and Have Amounts for ${item.stock}`}
                                className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-1.5 py-0.5 font-sans text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
                              >
                                Edit Amounts
                              </button>
                            </div>
                          </div>
                        )}
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
      <PlantInventoryItemListView
        stockItems={stockItems}
        newStockName={newStockName}
        setNewStockName={setNewStockName}
        newStockCode={newStockCode}
        setNewStockCode={setNewStockCode}
        newCategory={newCategory}
        setNewCategory={setNewCategory}
        newDescription={newDescription}
        setNewDescription={setNewDescription}
        newAmountRequired={newAmountRequired}
        setNewAmountRequired={setNewAmountRequired}
        newAmountPresent={newAmountPresent}
        setNewAmountPresent={setNewAmountPresent}
        newUnit={newUnit}
        setNewUnit={setNewUnit}
        newPlantEquipment={newPlantEquipment}
        setNewPlantEquipment={setNewPlantEquipment}
        formFeedback={formFeedback}
        handleAddItem={handleAddItem}
      />
    );
  }

  // ─── 3. STOCK REQUIRED (/plant-inventory/history) ──────────────────────────
  if (mode === 'stock-required') {
    return (
      <PlantInventoryStockRequiredView
        stockRequiredItems={stockRequiredItems}
        handleRestockItem={handleRestockItem}
      />
    );
  }

  // ─── 4. HISTORY OF USED (/plant-inventory/tools) ───────────────────────────
  if (mode === 'history-of-used') {
    return (
      <PlantInventoryUsageHistoryView
        stockItems={stockItems}
        usageHistory={usageHistory}
        usageStockId={usageStockId}
        setUsageStockId={setUsageStockId}
        usageAmount={usageAmount}
        setUsageAmount={setUsageAmount}
        usageShift={usageShift}
        setUsageShift={setUsageShift}
        usageCircuit={usageCircuit}
        setUsageCircuit={setUsageCircuit}
        usageEquipment={usageEquipment}
        setUsageEquipment={setUsageEquipment}
        usageNotes={usageNotes}
        setUsageNotes={setUsageNotes}
        usageOperator={usageOperator}
        setUsageOperator={setUsageOperator}
        usageFeedback={usageFeedback}
        handleRecordUsage={handleRecordUsage}
      />
    );
  }

  // ─── 5. REPORTS (/plant-inventory/reports) ─────────────────────────────────
  if (mode === 'reports') {
    return (
      <PlantInventoryReportsView
        today={today}
        stockRequiredItems={stockRequiredItems}
        equipmentList={equipmentList}
        equipmentMetrics={equipmentMetrics}
      />
    );
  }

  return null;
}
