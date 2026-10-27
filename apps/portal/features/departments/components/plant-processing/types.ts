export type PlantShiftType = 'day' | 'night';

export type PlantModuleId = 'DMS-MOD-1' | 'DMS-MOD-2';

export interface PlantHourlyRow {
  rowNumber: number;
  hourSlot: string;
  seamSource: string;
  romFeedTonnes: number;
  cleanCoalTonnes: number;
  discardTonnes: number;
  yieldPct: number;
  productAshPct: number;
  cycloneRd: number;
  moisturePct: number;
  runMinutes: number;
  notes: string;
}

export interface PlantHourlySheetRecord {
  id: string;
  date: string;
  shift: PlantShiftType;
  moduleId: PlantModuleId;
  operatorName: string;
  updatedAt: string;
  rows: PlantHourlyRow[];
}

export type PlantDelayCategory =
  | 'Mechanical'
  | 'Electrical & PLC'
  | 'Process / Density Excursion'
  | 'Chute Blockage / Spillage'
  | 'No ROM Feed / Starvation'
  | 'Planned Maintenance'
  | (string & {});

export type PlantImpactType =
  | 'Full Plant Stoppage'
  | 'Reduced Throughput'
  | 'Single Circuit Bypass'
  | (string & {});

export type PlantDelayStatus = 'Active' | 'Monitoring' | 'Resolved';

export interface PlantDelayEntry {
  id: string;
  date: string;
  shift: PlantShiftType;
  circuit: string;
  category: PlantDelayCategory;
  impactType: PlantImpactType;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  reason: string;
  correctiveAction: string;
  loggedBy: string;
  status: PlantDelayStatus;
}

export interface PlantDailyRollupRecord {
  id: string;
  date: string;
  shift: PlantShiftType;
  moduleId: PlantModuleId;
  romFeedTonnes: number;
  cleanCoalTonnes: number;
  discardTonnes: number;
  yieldPct: number;
  avgProductAshPct?: number;
  avgCycloneRd: number;
  avgMoisturePct: number;
  runHours: number;
  delayMinutes: number;
  operatorName: string;
}

export interface PlantMonthlyRollupRecord {
  month: string;
  monthLabel: string;
  shiftsLogged: number;
  romFeedTonnes: number;
  cleanCoalTonnes: number;
  discardTonnes: number;
  yieldPct: number;
  avgProductAshPct?: number;
  avgCycloneRd: number;
  avgMoisturePct: number;
  totalRunHours: number;
  totalDelayHours: number;
  availabilityPct: number;
}

export interface PlantWorkspaceData {
  departmentId: string | null;
  currentDate: string;
  initialSheets: PlantHourlySheetRecord[];
  initialDelays: PlantDelayEntry[];
}

export const PLANT_SEAM_OPTIONS = [
  'Seam 2 Lower',
  'Seam 4 Upper',
  'ROM Blend A',
  'High-Ash Stockpile',
] as const;

export const PLANT_CIRCUIT_OPTIONS = [
  'Primary Jaw Crusher (CR-101)',
  'Secondary Sizing Screen (SC-201)',
  'DMS Cyclone Module 1 (DM-301)',
  'DMS Cyclone Module 2 (DM-302)',
  'Fine Coal Spirals (SP-401)',
  'Tailings Thickener & Press (TH-501)',
  'Clean Coal Loadout Conveyor (CV-601)',
  'ROM Feed Bunker & Apron Feeder (AF-100)',
] as const;

export const PLANT_DELAY_CATEGORIES = [
  'Mechanical',
  'Electrical & PLC',
  'Process / Density Excursion',
  'Chute Blockage / Spillage',
  'No ROM Feed / Starvation',
  'Planned Maintenance',
] as const;

export const PLANT_IMPACT_OPTIONS = [
  'Full Plant Stoppage',
  'Reduced Throughput',
  'Single Circuit Bypass',
] as const;
const DAY_SHIFT_HOUR_SLOTS = [
  '06:00 - 07:00',
  '07:00 - 08:00',
  '08:00 - 09:00',
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00',
  '17:00 - 18:00',
] as const;

const NIGHT_SHIFT_HOUR_SLOTS = [
  '18:00 - 19:00',
  '19:00 - 20:00',
  '20:00 - 21:00',
  '21:00 - 22:00',
  '22:00 - 23:00',
  '23:00 - 00:00',
  '00:00 - 01:00',
  '01:00 - 02:00',
  '02:00 - 03:00',
  '03:00 - 04:00',
  '04:00 - 05:00',
  '05:00 - 06:00',
] as const;

export function calculateRowYield(romFeedTonnes: number, cleanCoalTonnes: number): number {
  if (romFeedTonnes <= 0) return 0;
  return Number(Math.min(100, Math.max(0, (cleanCoalTonnes / romFeedTonnes) * 100)).toFixed(1));
}

export function buildDefaultHourlyRows(shift: PlantShiftType = 'day'): PlantHourlyRow[] {
  const slots = shift === 'day' ? DAY_SHIFT_HOUR_SLOTS : NIGHT_SHIFT_HOUR_SLOTS;
  const baseFeeds = [420, 445, 460, 455, 470, 430, 465, 480, 475, 390, 460, 450];
  const baseClean = [382, 408, 422, 417, 431, 392, 426, 441, 436, 353, 421, 412];
  const baseAsh = [14.1, 13.9, 13.8, 14.0, 13.9, 14.2, 14.0, 13.7, 13.8, 14.5, 13.9, 14.0];
  const baseRd = [1.48, 1.48, 1.49, 1.49, 1.48, 1.47, 1.48, 1.49, 1.48, 1.5, 1.48, 1.48];
  const baseMoisture = [8.1, 8.0, 7.9, 8.2, 8.1, 8.3, 8.0, 7.8, 7.9, 8.4, 8.0, 7.9];
  const baseRunMins = [58, 60, 60, 60, 60, 54, 60, 60, 60, 46, 60, 58];
  const baseNotes = [
    'Start-of-shift magnetite medium density check OK',
    'Steady feed from ROM Bin #1',
    'Peak DMS cyclone efficiency',
    'Normal wash plant operation',
    'Balanced spiral underflow split',
    '6 min screen spray nozzle flush',
    'Switched feed blend to Seam 4 Upper',
    'High throughput run — clean coal conveyor CV-601 optimal',
    'Steady dense media separation',
    '14 min primary crusher oversize clearing',
    'Recovered full feed rate post-chute clear',
    'Shift handover prep & belt scale calibration',
  ];

  return slots.map((slot, idx) => {
    const romFeedTonnes = baseFeeds[idx] ?? 450;
    const cleanCoalTonnes = baseClean[idx] ?? 410;
    const discardTonnes = Math.max(0, romFeedTonnes - cleanCoalTonnes);
    return {
      rowNumber: idx + 1,
      hourSlot: slot,
      seamSource: idx >= 6 && idx <= 8 ? 'Seam 4 Upper' : 'Seam 2 Lower',
      romFeedTonnes,
      cleanCoalTonnes,
      discardTonnes,
      yieldPct: calculateRowYield(romFeedTonnes, cleanCoalTonnes),
      productAshPct: baseAsh[idx] ?? 14.0,
      cycloneRd: baseRd[idx] ?? 1.48,
      moisturePct: baseMoisture[idx] ?? 8.0,
      runMinutes: baseRunMins[idx] ?? 60,
      notes: baseNotes[idx] ?? '',
    };
  });
}

export function buildInitialPlantDelays(todayStr: string): PlantDelayEntry[] {
  return [
    {
      id: 'delay-pp-101',
      date: todayStr,
      shift: 'day',
      circuit: 'Primary Jaw Crusher (CR-101)',
      category: 'Chute Blockage / Spillage',
      impactType: 'Reduced Throughput',
      startTime: '15:12',
      endTime: '15:26',
      durationMinutes: 14,
      reason: 'Oversize slab bridged across primary jaw crusher grizzly bars',
      correctiveAction: 'Engaged hydraulic rock breaker and cleared feed throat',
      loggedBy: 'S. Mokoena (Plant Control)',
      status: 'Resolved',
    },
    {
      id: 'delay-pp-102',
      date: todayStr,
      shift: 'day',
      circuit: 'Secondary Sizing Screen (SC-201)',
      category: 'Planned Maintenance',
      impactType: 'Single Circuit Bypass',
      startTime: '11:20',
      endTime: '11:26',
      durationMinutes: 6,
      reason: 'High-pressure desliming spray bar nozzle flush',
      correctiveAction: 'Flushed manifold and verified 3.2 bar spray pressure',
      loggedBy: 'S. Mokoena (Plant Control)',
      status: 'Resolved',
    },
    {
      id: 'delay-pp-103',
      date: '2026-10-20',
      shift: 'night',
      circuit: 'DMS Cyclone Module 1 (DM-301)',
      category: 'Process / Density Excursion',
      impactType: 'Reduced Throughput',
      startTime: '22:05',
      endTime: '22:28',
      durationMinutes: 23,
      reason: 'Magnetite medium relative density drifted to 1.54 g/cm³ on high-ash ROM pocket',
      correctiveAction: 'Dosed dilution water and recalibrated nuclear density gauge loop',
      loggedBy: 'T. Nkosi (Night Metallurgist)',
      status: 'Resolved',
    },
    {
      id: 'delay-pp-104',
      date: '2026-10-19',
      shift: 'day',
      circuit: 'Tailings Thickener & Press (TH-501)',
      category: 'Electrical & PLC',
      impactType: 'Single Circuit Bypass',
      startTime: '09:40',
      endTime: '',
      durationMinutes: 0,
      reason: 'Underflow slurry pump VFD over-torque trip during high slime surge',
      correctiveAction: 'Awaiting VFD torque recalibration and slurry line flush',
      loggedBy: 'K. Dlamini (Plant Supervisor)',
      status: 'Active',
    },
  ];
}
