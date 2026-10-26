export type PlantInventoryCategory =
  | 'Dense Medium'
  | 'Reagents'
  | 'Wear Spares'
  | 'Screening & Crushing'
  | 'Stockpiles';

export type PlantStockStatusFlag =
  | 'OUT_OF_STOCK'
  | 'CRITICAL'
  | 'REPLENISH'
  | 'NOMINAL'
  | 'SURPLUS';

export interface PlantInventoryStockItemRecord {
  id: string;
  stock: string;
  code: string;
  category: PlantInventoryCategory;
  description: string;
  amountRequired: number;
  amountPresent: number;
  unit: string;
  plantEquipment: string;
  shortfallAmount?: number;
  surplusAmount?: number;
  coveragePct?: number;
  needsReplenishment?: boolean;
  stockStatus?: PlantStockStatusFlag;
}

export interface PlantInventoryUsageEntryRecord {
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

export function computeStockAutomatedFlags(
  amountRequired: number,
  amountPresent: number
): {
  shortfallAmount: number;
  surplusAmount: number;
  coveragePct: number;
  needsReplenishment: boolean;
  stockStatus: PlantStockStatusFlag;
  statusLabel: string;
} {
  const req = Math.max(0, Number(amountRequired) || 0);
  const pres = Math.max(0, Number(amountPresent) || 0);
  const shortfallAmount = Math.max(0, Number((req - pres).toFixed(2)));
  const surplusAmount = Math.max(0, Number((pres - req).toFixed(2)));
  const coveragePct = req > 0 ? Number(((pres / req) * 100).toFixed(1)) : 100;
  const needsReplenishment = pres < req;

  let stockStatus: PlantStockStatusFlag = 'NOMINAL';
  let statusLabel = 'Nominal';
  if (pres <= 0) {
    stockStatus = 'OUT_OF_STOCK';
    statusLabel = 'Out of Stock';
  } else if (pres < req * 0.5) {
    stockStatus = 'CRITICAL';
    statusLabel = 'Critical (<50%)';
  } else if (pres < req) {
    stockStatus = 'REPLENISH';
    statusLabel = 'Replenish';
  } else if (req > 0 && pres > req * 1.5) {
    stockStatus = 'SURPLUS';
    statusLabel = 'Surplus (>150%)';
  }

  return {
    shortfallAmount,
    surplusAmount,
    coveragePct,
    needsReplenishment,
    stockStatus,
    statusLabel,
  };
}
