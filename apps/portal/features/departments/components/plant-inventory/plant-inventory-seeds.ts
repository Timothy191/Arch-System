import type { PlantStockStatusFlag } from './stock-flags';

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

export const STOCK_STORAGE_KEY = 'arch_plant_inventory_stock_v1';
export const USAGE_STORAGE_KEY = 'arch_plant_inventory_usage_v1';

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
  } as PlantInventoryUsageEntry,
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

export function formatQty(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function getStockStatusBadgeClass(status: PlantStockStatusFlag): string {
  if (status === 'OUT_OF_STOCK' || status === 'CRITICAL') {
    return 'rounded-full border border-[var(--accent-alert)]/40 bg-[var(--accent-alert)]/15 px-2 py-0.5 font-semibold text-[11px] text-[var(--accent-alert)]';
  }
  if (status === 'REPLENISH') {
    return 'rounded-full border border-[var(--accent-alert)]/30 bg-[var(--accent-alert)]/10 px-2 py-0.5 font-medium text-[11px] text-[var(--accent-alert)]';
  }
  if (status === 'SURPLUS') {
    return 'rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[11px] text-[var(--accent-blue)]';
  }
  return 'rounded-full border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 px-2 py-0.5 font-medium text-[11px] text-[var(--accent-green)]';
}
