'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  computeStockAutomatedFlags,
  type PlantInventoryCategory,
  type PlantInventoryStockItemRecord,
  type PlantInventoryUsageEntryRecord,
  type PlantStockStatusFlag,
} from './stock-flags';

interface UntypedTableBuilder {
  select: (columns: string) => {
    order: (
      col: string,
      opts?: { ascending?: boolean }
    ) => Promise<{ data: unknown[] | null; error: { message: string } | null }> & {
      limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
    maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
  };
  upsert: (
    values: Record<string, unknown>,
    opts?: { onConflict?: string }
  ) => {
    select: (columns: string) => {
      maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string
    ) => Promise<{ data: unknown | null; error: { message: string } | null }>;
  };
  insert: (
    values: Record<string, unknown>
  ) => Promise<{ data: unknown | null; error: { message: string } | null }>;
}

function fromTable(supabase: unknown, table: string): UntypedTableBuilder {
  return (supabase as { from: (t: string) => UntypedTableBuilder }).from(table);
}

function invalidatePlantInventoryCache() {
  cacheInvalidateTags(['plant-inventory', 'department:plant-inventory']).catch(() => undefined);
  revalidatePath('/plant-inventory');
  revalidatePath('/plant-inventory/daily-log');
  revalidatePath('/plant-inventory/machines');
  revalidatePath('/plant-inventory/history');
  revalidatePath('/plant-inventory/tools');
  revalidatePath('/plant-inventory/reports');
}

export async function getPlantInventoryWorkspaceData(): Promise<{
  items: PlantInventoryStockItemRecord[];
  usage: PlantInventoryUsageEntryRecord[];
} | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const [{ data: itemsData, error: itemsErr }, { data: usageData, error: usageErr }] =
      await Promise.all([
        fromTable(supabase, 'plant_inventory_items')
          .select(
            'id, stock, code, category, description, plant_equipment, unit, amount_required, amount_present, shortfall_amount, surplus_amount, coverage_pct, needs_replenishment, stock_status'
          )
          .order('created_at', { ascending: true }),
        fromTable(supabase, 'plant_inventory_usage')
          .select(
            'id, item_id, stock_code, stock_name, usage_date, shift, amount_used, unit, circuit_area, plant_equipment, description, logged_by'
          )
          .order('usage_date', { ascending: false })
          .limit(100),
      ]);

    if (itemsErr || !itemsData || itemsData.length === 0) {
      return null;
    }

    const items: PlantInventoryStockItemRecord[] = (
      itemsData as Array<{
        id: string;
        stock: string;
        code: string;
        category: PlantInventoryCategory;
        description: string;
        plant_equipment: string;
        unit: string;
        amount_required: number;
        amount_present: number;
        shortfall_amount?: number;
        surplus_amount?: number;
        coverage_pct?: number;
        needs_replenishment?: boolean;
        stock_status?: PlantStockStatusFlag;
      }>
    ).map((row) => {
      const req = Number(row.amount_required) || 0;
      const pres = Number(row.amount_present) || 0;
      const flags = computeStockAutomatedFlags(req, pres);
      return {
        id: row.id,
        stock: row.stock,
        code: row.code,
        category: row.category,
        description: row.description,
        amountRequired: req,
        amountPresent: pres,
        unit: row.unit || 'units',
        plantEquipment: row.plant_equipment,
        shortfallAmount:
          row.shortfall_amount !== undefined ? Number(row.shortfall_amount) : flags.shortfallAmount,
        surplusAmount:
          row.surplus_amount !== undefined ? Number(row.surplus_amount) : flags.surplusAmount,
        coveragePct: row.coverage_pct !== undefined ? Number(row.coverage_pct) : flags.coveragePct,
        needsReplenishment:
          row.needs_replenishment !== undefined
            ? Boolean(row.needs_replenishment)
            : flags.needsReplenishment,
        stockStatus: row.stock_status ?? flags.stockStatus,
      };
    });

    const usage: PlantInventoryUsageEntryRecord[] =
      !usageErr && usageData
        ? (
            usageData as Array<{
              id: string;
              item_id: string | null;
              stock_code: string;
              stock_name: string;
              usage_date: string;
              shift: 'Day' | 'Night';
              amount_used: number;
              unit: string;
              circuit_area: string;
              plant_equipment: string;
              description: string;
              logged_by: string;
            }>
          ).map((u) => ({
            id: u.id,
            date: u.usage_date,
            shift: u.shift,
            stockId: u.item_id ?? u.stock_code,
            stock: u.stock_name,
            description: u.description,
            amountUsed: Number(u.amount_used) || 0,
            unit: u.unit || 'units',
            circuitArea: u.circuit_area,
            plantEquipment: u.plant_equipment,
            loggedBy: u.logged_by,
          }))
        : [];

    return { items, usage };
  } catch {
    return null;
  }
}

export async function upsertPlantInventoryItemAction(input: {
  stock: string;
  code: string;
  category: PlantInventoryCategory;
  description: string;
  amountRequired: number;
  amountPresent: number;
  unit: string;
  plantEquipment: string;
}): Promise<{ success: boolean; item?: PlantInventoryStockItemRecord }> {
  try {
    const supabase = await createServerSupabaseClient();
    const authEmployee = await getAuthenticatedEmployee().catch(() => null);
    const employeeId = authEmployee?.employee?.id ?? null;

    const { data, error } = await fromTable(supabase, 'plant_inventory_items')
      .upsert(
        {
          stock: input.stock.trim(),
          code: input.code.trim().toUpperCase(),
          category: input.category,
          description: input.description.trim(),
          amount_required: Number(input.amountRequired) || 0,
          amount_present: Number(input.amountPresent) || 0,
          unit: input.unit.trim() || 'units',
          plant_equipment: input.plantEquipment.trim(),
          ...(employeeId ? { updated_by: employeeId } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'code' }
      )
      .select(
        'id, stock, code, category, description, plant_equipment, unit, amount_required, amount_present, shortfall_amount, surplus_amount, coverage_pct, needs_replenishment, stock_status'
      )
      .maybeSingle();

    invalidatePlantInventoryCache();

    if (error || !data) {
      return { success: false };
    }

    const row = data as {
      id: string;
      stock: string;
      code: string;
      category: PlantInventoryCategory;
      description: string;
      plant_equipment: string;
      unit: string;
      amount_required: number;
      amount_present: number;
      shortfall_amount?: number;
      surplus_amount?: number;
      coverage_pct?: number;
      needs_replenishment?: boolean;
      stock_status?: PlantStockStatusFlag;
    };
    const req = Number(row.amount_required) || 0;
    const pres = Number(row.amount_present) || 0;
    const flags = computeStockAutomatedFlags(req, pres);

    return {
      success: true,
      item: {
        id: row.id,
        stock: row.stock,
        code: row.code,
        category: row.category,
        description: row.description,
        amountRequired: req,
        amountPresent: pres,
        unit: row.unit,
        plantEquipment: row.plant_equipment,
        shortfallAmount:
          row.shortfall_amount !== undefined ? Number(row.shortfall_amount) : flags.shortfallAmount,
        surplusAmount:
          row.surplus_amount !== undefined ? Number(row.surplus_amount) : flags.surplusAmount,
        coveragePct: row.coverage_pct !== undefined ? Number(row.coverage_pct) : flags.coveragePct,
        needsReplenishment:
          row.needs_replenishment !== undefined
            ? Boolean(row.needs_replenishment)
            : flags.needsReplenishment,
        stockStatus: row.stock_status ?? flags.stockStatus,
      },
    };
  } catch {
    return { success: false };
  }
}

export async function updatePlantInventoryAmountsAction(input: {
  id: string;
  code: string;
  amountRequired: number;
  amountPresent: number;
}): Promise<{ success: boolean }> {
  try {
    const supabase = await createServerSupabaseClient();
    const authEmployee = await getAuthenticatedEmployee().catch(() => null);
    const employeeId = authEmployee?.employee?.id ?? null;

    const payload = {
      amount_required: Math.max(0, Number(input.amountRequired) || 0),
      amount_present: Math.max(0, Number(input.amountPresent) || 0),
      ...(employeeId ? { updated_by: employeeId } : {}),
      updated_at: new Date().toISOString(),
    };

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id);
    if (isUuid) {
      await fromTable(supabase, 'plant_inventory_items').update(payload).eq('id', input.id);
    } else {
      await fromTable(supabase, 'plant_inventory_items')
        .update(payload)
        .eq('code', input.code.toUpperCase());
    }

    invalidatePlantInventoryCache();
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function recordPlantInventoryUsageAction(input: {
  stockId: string;
  stockCode: string;
  stockName: string;
  date: string;
  shift: 'Day' | 'Night';
  amountUsed: number;
  unit: string;
  circuitArea: string;
  plantEquipment: string;
  description: string;
  loggedBy: string;
}): Promise<{ success: boolean }> {
  try {
    const supabase = await createServerSupabaseClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.stockId
    );

    await fromTable(supabase, 'plant_inventory_usage').insert({
      ...(isUuid ? { item_id: input.stockId } : {}),
      stock_code: input.stockCode.toUpperCase(),
      stock_name: input.stockName,
      usage_date: input.date,
      shift: input.shift,
      amount_used: Math.max(0.01, Number(input.amountUsed) || 0.01),
      unit: input.unit || 'units',
      circuit_area: input.circuitArea,
      plant_equipment: input.plantEquipment,
      description: input.description,
      logged_by: input.loggedBy,
    });

    invalidatePlantInventoryCache();
    return { success: true };
  } catch {
    return { success: false };
  }
}
