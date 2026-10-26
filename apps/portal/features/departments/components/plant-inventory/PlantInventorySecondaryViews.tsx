'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Input } from '@repo/ui/Input';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  History,
  PackagePlus,
  Plus,
  RefreshCw,
  TrendingDown,
} from 'lucide-react';
import type React from 'react';
import {
  formatQty,
  getStockStatusBadgeClass,
  type PlantInventoryStockItem,
  type PlantInventoryUsageEntry,
} from './plant-inventory-seeds';
import { computeStockAutomatedFlags } from './stock-flags';

export function PlantInventoryItemListView({
  stockItems,
  newStockName,
  setNewStockName,
  newStockCode,
  setNewStockCode,
  newCategory,
  setNewCategory,
  newDescription,
  setNewDescription,
  newAmountRequired,
  setNewAmountRequired,
  newAmountPresent,
  setNewAmountPresent,
  newUnit,
  setNewUnit,
  newPlantEquipment,
  setNewPlantEquipment,
  formFeedback,
  handleAddItem,
}: {
  stockItems: PlantInventoryStockItem[];
  newStockName: string;
  setNewStockName: (v: string) => void;
  newStockCode: string;
  setNewStockCode: (v: string) => void;
  newCategory: PlantInventoryStockItem['category'];
  setNewCategory: (v: PlantInventoryStockItem['category']) => void;
  newDescription: string;
  setNewDescription: (v: string) => void;
  newAmountRequired: string;
  setNewAmountRequired: (v: string) => void;
  newAmountPresent: string;
  setNewAmountPresent: (v: string) => void;
  newUnit: string;
  setNewUnit: (v: string) => void;
  newPlantEquipment: string;
  setNewPlantEquipment: (v: string) => void;
  formFeedback: string | null;
  handleAddItem: (e: React.FormEvent) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <PackagePlus className="h-6 w-6 text-[var(--accent-blue)]" aria-hidden="true" />
            <h2 className="font-bold text-2xl text-[var(--text-heading)]">Item List</h2>
          </div>
          <p className="mt-1 text-[var(--text-secondary)] text-sm">
            Register new stock items, spare parts, or reagents into the Plant Inventory master stock
            list, assigned to specific plant equipment.
          </p>
        </div>
        <span className="self-start rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[var(--text-muted)] text-xs sm:self-auto">
          Catalog Items: <strong className="text-[var(--text-heading)]">{stockItems.length}</strong>
        </span>
      </div>

      <GlassCard>
        <div className="mb-4">
          <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
            <Plus className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
            Add New Item to Stock List
          </h3>
          <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
            New items added here are immediately synchronized with Inventory List and Stock Required
            views.
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

          {(newAmountRequired !== '' || newAmountPresent !== '') &&
            (() => {
              const previewFlags = computeStockAutomatedFlags(
                Number(newAmountRequired) || 0,
                Number(newAmountPresent) || 0
              );
              return (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3.5 py-2 text-xs">
                  <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Automated Flags:
                  </span>
                  <span className={getStockStatusBadgeClass(previewFlags.stockStatus)}>
                    {previewFlags.statusLabel}
                  </span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    Coverage: <strong>{previewFlags.coveragePct}%</strong>
                  </span>
                  {previewFlags.needsReplenishment ? (
                    <span className="font-mono font-semibold text-[var(--accent-alert)]">
                      Auto-Reorder Armed (Shortfall: -{formatQty(previewFlags.shortfallAmount)}{' '}
                      {newUnit || 'units'})
                    </span>
                  ) : (
                    <span className="font-mono text-[var(--accent-green)]">
                      Par Met
                      {previewFlags.surplusAmount > 0
                        ? ` (+${formatQty(previewFlags.surplusAmount)} ${newUnit || 'units'} surplus)`
                        : ''}
                    </span>
                  )}
                </div>
              );
            })()}

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
              {stockItems.map((item) => {
                const flags = computeStockAutomatedFlags(item.amountRequired, item.amountPresent);
                return (
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
                    <td className="whitespace-nowrap px-6 py-4 text-right align-top">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className="font-mono font-semibold text-[var(--text-heading)] text-sm">
                          {formatQty(item.amountPresent)} {item.unit}
                        </span>
                        <span className={getStockStatusBadgeClass(flags.stockStatus)}>
                          {flags.statusLabel}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 align-top text-[var(--text-secondary)] text-sm">
                      {item.plantEquipment}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

export function PlantInventoryStockRequiredView({
  stockRequiredItems,
  handleRestockItem,
}: {
  stockRequiredItems: PlantInventoryStockItem[];
  handleRestockItem: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-6 w-6 text-[var(--accent-alert)]" aria-hidden="true" />
            <h2 className="font-bold text-2xl text-[var(--text-heading)]">Stock Required</h2>
          </div>
          <p className="mt-1 text-[var(--text-secondary)] text-sm">
            Replenishment queue for plant consumables, reagents, and wear spares below required par
            levels.
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

export function PlantInventoryUsageHistoryView({
  stockItems,
  usageHistory,
  usageStockId,
  setUsageStockId,
  usageAmount,
  setUsageAmount,
  usageShift,
  setUsageShift,
  usageCircuit,
  setUsageCircuit,
  usageEquipment,
  setUsageEquipment,
  usageNotes,
  setUsageNotes,
  usageOperator,
  setUsageOperator,
  usageFeedback,
  handleRecordUsage,
}: {
  stockItems: PlantInventoryStockItem[];
  usageHistory: PlantInventoryUsageEntry[];
  usageStockId: string;
  setUsageStockId: (v: string) => void;
  usageAmount: string;
  setUsageAmount: (v: string) => void;
  usageShift: 'Day' | 'Night';
  setUsageShift: (v: 'Day' | 'Night') => void;
  usageCircuit: string;
  setUsageCircuit: (v: string) => void;
  usageEquipment: string;
  setUsageEquipment: (v: string) => void;
  usageNotes: string;
  setUsageNotes: (v: string) => void;
  usageOperator: string;
  setUsageOperator: (v: string) => void;
  usageFeedback: string | null;
  handleRecordUsage: (e: React.FormEvent) => void;
}) {
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
                <tr key={entry.id} className="transition-colors hover:bg-[var(--bg-secondary)]/60">
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

export function PlantInventoryReportsView({
  today,
  stockRequiredItems,
  equipmentList,
  equipmentMetrics,
}: {
  today: string;
  stockRequiredItems: PlantInventoryStockItem[];
  equipmentList: string[];
  equipmentMetrics: Map<
    string,
    { eqDrawdown: number; eqUsageCount: number; eqStockLines: number; eqShortfall: number }
  >;
}) {
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
