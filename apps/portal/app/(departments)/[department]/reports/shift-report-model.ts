import { isRegularMachineExcavatorActivity } from '../hourly-loads/loads-utils';
import type { MachineOperationLogItem } from './reports-types';

export const STANDARD_ALLOWANCE_REFUEL_MINS = 30;
export const STANDARD_ALLOWANCE_PRESTART_MINS = 15;
export const STANDARD_ALLOWANCE_SERVICE_MINS = 30;

export const DEFAULT_OVERBURDEN_BIN_FACTOR = 18.0;
export const DEFAULT_ROM_COAL_BIN_FACTOR = 34.0;
export const DEFAULT_TOPSOIL_BIN_FACTOR = 20.0;
export const DEFAULT_DISCARD_BIN_FACTOR = 32.0;

export const RIGID_TRUCK_KEYWORDS = Object.freeze(['cat 777', '777', 'rigid', 'hd785']);
const _ADT_TRUCK_KEYWORDS = Object.freeze(['adt', 'b40', 'b30', 'b50', 'bell']);

export interface MaterialBinConfig {
  readonly unit: 'BCM' | 'Tonnes';
  readonly defaultFactor: number;
  readonly label: string;
}

export function resolveMaterialConfig(
  materialName?: string,
  machineClass?: string
): MaterialBinConfig {
  const normalizedMaterial = (materialName || '').toLowerCase().trim();
  const normalizedClass = (machineClass || '').toLowerCase().trim();
  const isRigid = RIGID_TRUCK_KEYWORDS.some((keyword) => normalizedClass.includes(keyword));

  if (normalizedMaterial.includes('coal') || normalizedMaterial.includes('rom')) {
    return {
      unit: 'Tonnes',
      defaultFactor: isRigid ? DEFAULT_ROM_COAL_BIN_FACTOR : 28.0,
      label: 'ROM Coal',
    };
  }

  if (normalizedMaterial.includes('topsoil')) {
    return {
      unit: 'BCM',
      defaultFactor: isRigid ? DEFAULT_TOPSOIL_BIN_FACTOR : 14.0,
      label: 'Topsoil',
    };
  }

  if (normalizedMaterial.includes('discard') || normalizedMaterial.includes('waste')) {
    return {
      unit: 'Tonnes',
      defaultFactor: isRigid ? DEFAULT_DISCARD_BIN_FACTOR : 26.0,
      label: 'Discard / Waste',
    };
  }

  return {
    unit: 'BCM',
    defaultFactor: isRigid ? DEFAULT_OVERBURDEN_BIN_FACTOR : 12.0,
    label: materialName ? materialName.trim() : 'Overburden',
  };
}

export interface HaulingMachineRow {
  readonly machineId: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly operator: string;
  readonly openingSmr: number;
  readonly closingSmr: number;
  readonly totalSmrWorked: number;
  readonly loads: number;
  readonly binFactor: number;
  readonly material: string;
  readonly materialUnit: 'BCM' | 'Tonnes';
  readonly rowTotal: number;
  readonly delaysDisplay: string;
  readonly delayMinutes: number;
  readonly productionDelayMinutes: number;
  readonly engineeringDelayMinutes: number;
  readonly naturalDelayMinutes: number;
  readonly nonSiteDelayMinutes: number;
}

export interface ExcavatorDelayEntry {
  readonly name: string;
  readonly durationMins: number;
}

export interface ExcavatorDelayCategory {
  readonly title: string;
  readonly items: readonly ExcavatorDelayEntry[];
  readonly totalMins: number;
}

export interface ExcavatorActivityBlockData {
  readonly excavatorId: string;
  readonly excavatorName: string;
  readonly excavatorModel: string;
  readonly material: string;
  readonly materialUnit: 'BCM' | 'Tonnes';
  readonly blockMined: string;
  readonly assignedMachines: readonly HaulingMachineRow[];
  readonly autoTotals: {
    readonly totalLoads: number;
    readonly totalMaterialMoved: number;
    readonly averageHaulerSmr: number;
  };
  readonly delaysGrid: {
    readonly production: ExcavatorDelayCategory;
    readonly engineering: ExcavatorDelayCategory;
    readonly external: ExcavatorDelayCategory;
    readonly standard: ExcavatorDelayCategory;
    readonly totalDowntimeMins: number;
  };
}

export interface DozerRolloverRow {
  readonly machineName: string;
  readonly operatorName: string;
  readonly openingSmr: number;
  readonly closingSmr: number;
  readonly hoursWorked: number;
  readonly bladePasses: number;
  readonly rolloverBcm: number;
  readonly delayMinutes: number;
}

export interface SiteShiftReportData {
  readonly siteName: string;
  readonly excavatorBlocks: readonly ExcavatorActivityBlockData[];
  readonly dozerRollovers: readonly DozerRolloverRow[];
  readonly siteTotals: {
    readonly totalLoads: number;
    readonly totalMaterialMoved: number;
    readonly totalHours: number;
    readonly totalDelaysMin: number;
    readonly bcmVolume: number;
    readonly coalTonnes: number;
  };
}

export interface ExecutiveSummaryMetrics {
  readonly reportDate: string;
  readonly shift: 'day' | 'night';
  readonly departmentName: string;
  readonly periodLabel: string;
  readonly totalMaterialMoved: number;
  readonly totalLoads: number;
  readonly totalFleetSmrWorked: number;
  readonly totalDelayMinutes: number;
  readonly sitesCount: number;
  readonly fleetCount: number;
  readonly productionBySite: ReadonlyArray<{
    readonly site: string;
    readonly amount: number;
    readonly loads: number;
    readonly hours: number;
    readonly unit: string;
  }>;
  readonly materialSplit: ReadonlyArray<{
    readonly material: string;
    readonly amount: number;
    readonly pct: number;
    readonly unit: string;
  }>;
  readonly fleetUtilization: {
    readonly operatingHours: number;
    readonly delayHours: number;
    readonly totalHours: number;
    readonly utilizationPct: number;
    readonly availabilityPct: number;
    readonly delayTypeBreakdown: ReadonlyArray<{
      readonly name: string;
      readonly minutes: number;
      readonly color: string;
    }>;
  };
}

export function formatHaulerDelays(params: {
  delayMinutes: number;
  prodMin?: number;
  engMin?: number;
  natMin?: number;
  nonSiteMin?: number;
  activityNote?: string;
}): string {
  const { delayMinutes, prodMin = 0, engMin = 0, natMin = 0, nonSiteMin = 0 } = params;
  if (delayMinutes <= 0) return '-';

  if (engMin > 0) return `Eng / Mech (${engMin}m)`;
  if (natMin > 0) return `Weather / Nat (${natMin}m)`;
  if (nonSiteMin > 0) return `Non-Site (${nonSiteMin}m)`;
  if (prodMin > 0) return `Prod Delay (${prodMin}m)`;

  return `Operational (${delayMinutes}m)`;
}

export function buildHaulingRow(params: {
  log: MachineOperationLogItem;
  fallbackMaterial?: string;
}): HaulingMachineRow {
  const { log, fallbackMaterial } = params;
  const openingSmr = log.startSmu != null ? Number(log.startSmu) : 0;
  const closingSmr =
    log.endSmu != null
      ? Number(log.endSmu)
      : log.startSmu != null
        ? Number(log.startSmu) + log.hoursWorked
        : log.hoursWorked;
  const calculatedSmrWorked = closingSmr - openingSmr;
  const totalSmrWorked = Number(
    (calculatedSmrWorked > 0 ? calculatedSmrWorked : log.hoursWorked).toFixed(1)
  );

  const resolvedMaterial = log.material || fallbackMaterial || 'Overburden';
  const config = resolveMaterialConfig(resolvedMaterial, log.machineType);
  const binFactor =
    log.binFactor && log.binFactor > 0 ? Number(log.binFactor) : config.defaultFactor;

  const loads =
    log.loadsCount != null && log.loadsCount > 0
      ? log.loadsCount
      : log.bcmMoved > 0
        ? Math.max(1, Math.round(log.bcmMoved / binFactor))
        : 0;

  const rowTotal = Number((loads * binFactor).toFixed(1));

  const delaysDisplay = formatHaulerDelays({
    delayMinutes: log.delayMinutes,
    prodMin: log.productionDelayMinutes,
    engMin: log.engineeringDelayMinutes,
    natMin: log.naturalDelayMinutes,
    nonSiteMin: log.nonSiteDelayMinutes,
  });

  return {
    machineId: log.machineName,
    machineName: log.machineName,
    machineType: log.machineType || 'ADT Haul Truck',
    operator: log.operatorName || 'Assigned Operator',
    openingSmr,
    closingSmr,
    totalSmrWorked,
    loads,
    binFactor,
    material: resolvedMaterial,
    materialUnit: config.unit,
    rowTotal,
    delaysDisplay,
    delayMinutes: log.delayMinutes,
    productionDelayMinutes: log.productionDelayMinutes ?? 0,
    engineeringDelayMinutes: log.engineeringDelayMinutes ?? 0,
    naturalDelayMinutes: log.naturalDelayMinutes ?? 0,
    nonSiteDelayMinutes: log.nonSiteDelayMinutes ?? 0,
  };
}

export function buildExcavatorDelaysGrid(params: {
  excavatorLog?: MachineOperationLogItem;
  haulerRows: readonly HaulingMachineRow[];
}) {
  const { excavatorLog, haulerRows } = params;

  let totalProdMins = excavatorLog?.productionDelayMinutes ?? 0;
  let totalEngMins = excavatorLog?.engineeringDelayMinutes ?? 0;
  let totalNatMins = excavatorLog?.naturalDelayMinutes ?? 0;
  let totalNonSiteMins = excavatorLog?.nonSiteDelayMinutes ?? 0;

  for (const hauler of haulerRows) {
    totalProdMins += hauler.productionDelayMinutes;
    totalEngMins += hauler.engineeringDelayMinutes;
    totalNatMins += hauler.naturalDelayMinutes;
    totalNonSiteMins += hauler.nonSiteDelayMinutes;
  }

  const productionItems: ExcavatorDelayEntry[] = [
    { name: 'Spotting & Face Prep', durationMins: Math.round(totalProdMins * 0.45) },
    { name: 'Waiting on Trucks / Shift Change', durationMins: Math.round(totalProdMins * 0.55) },
  ];

  const engineeringItems: ExcavatorDelayEntry[] = [
    { name: 'Mechanical & GET Check', durationMins: Math.round(totalEngMins * 0.6) },
    { name: 'Hydraulic & Electrical Faults', durationMins: Math.round(totalEngMins * 0.4) },
  ];

  const externalItems: ExcavatorDelayEntry[] = [
    { name: 'Weather / Rain / Lightning Standby', durationMins: Math.round(totalNatMins) },
    { name: 'Non-Site Road & Power Outage', durationMins: Math.round(totalNonSiteMins) },
  ];

  const standardItems: ExcavatorDelayEntry[] = [
    { name: 'Refueling Setup', durationMins: STANDARD_ALLOWANCE_REFUEL_MINS },
    { name: 'Daily Pre-Start Inspection', durationMins: STANDARD_ALLOWANCE_PRESTART_MINS },
    { name: 'Shift Change & Greasing / Service', durationMins: STANDARD_ALLOWANCE_SERVICE_MINS },
  ];

  const standardTotalMins =
    STANDARD_ALLOWANCE_REFUEL_MINS +
    STANDARD_ALLOWANCE_PRESTART_MINS +
    STANDARD_ALLOWANCE_SERVICE_MINS;

  const totalDowntimeMins =
    totalProdMins + totalEngMins + totalNatMins + totalNonSiteMins + standardTotalMins;

  return {
    production: {
      title: 'Production Delays',
      items: productionItems,
      totalMins: totalProdMins,
    },
    engineering: {
      title: 'Engineering Delays',
      items: engineeringItems,
      totalMins: totalEngMins,
    },
    external: {
      title: 'Weather & Non-Site Delays',
      items: externalItems,
      totalMins: totalNatMins + totalNonSiteMins,
    },
    standard: {
      title: 'Standard Operational Allowances',
      items: standardItems,
      totalMins: standardTotalMins,
    },
    totalDowntimeMins,
  };
}

type SiteBucket = {
  excavators: MachineOperationLogItem[];
  haulers: MachineOperationLogItem[];
  dozers: MachineOperationLogItem[];
  others: MachineOperationLogItem[];
};

function classifyMachineLog(log: MachineOperationLogItem): keyof SiteBucket {
  const typeStr = (log.machineType || '').toLowerCase();
  const nameStr = (log.machineName || '').toLowerCase();
  const isRegularExcavator = isRegularMachineExcavatorActivity(log.material);

  if (
    !isRegularExcavator &&
    (log.siteGroupRole === 'excavator' ||
      typeStr.includes('excavator') ||
      nameStr.includes('excavator') ||
      nameStr.startsWith('ex-'))
  ) {
    return 'excavators';
  }
  if (
    log.isDozer ||
    log.siteGroupRole === 'rollover' ||
    typeStr.includes('dozer') ||
    nameStr.includes('dozer') ||
    nameStr.startsWith('dz-')
  ) {
    return 'dozers';
  }
  if (
    typeStr.includes('adt') ||
    typeStr.includes('truck') ||
    typeStr.includes('hauler') ||
    typeStr.includes('dumper') ||
    nameStr.startsWith('adt-') ||
    nameStr.startsWith('dt-') ||
    log.loadsCount != null
  ) {
    return 'haulers';
  }
  return 'others';
}

function buildSiteBuckets(
  filteredMachineOps: readonly MachineOperationLogItem[]
): Map<string, SiteBucket> {
  const siteMap = new Map<string, SiteBucket>();
  for (const log of filteredMachineOps) {
    const siteKey = (log.siteName || 'Brakfontein Pit').trim() || 'Brakfontein Pit';
    if (!siteMap.has(siteKey)) {
      siteMap.set(siteKey, { excavators: [], haulers: [], dozers: [], others: [] });
    }
    const bucket = siteMap.get(siteKey)!;
    bucket[classifyMachineLog(log)].push(log);
  }
  return siteMap;
}

function createDefaultExcavator(
  siteName: string,
  filteredMachineOps: readonly MachineOperationLogItem[]
): MachineOperationLogItem {
  const first = filteredMachineOps[0];
  return {
    id: `exc-default-${siteName}`,
    date: first?.date || new Date().toISOString().slice(0, 10),
    shift: first?.shift || 'day',
    machineName: 'EX-01 (Loading Fleet)',
    machineType: 'Hydraulic Excavator',
    operatorName: 'Assigned Operator',
    siteName,
    startSmu: null,
    endSmu: null,
    hoursWorked: 0,
    bcmMoved: 0,
    isDozer: false,
    delayMinutes: 0,
    status: 'completed' as const,
  };
}

function matchHaulersForExcavator(
  excName: string,
  haulers: readonly MachineOperationLogItem[],
  assignedHaulerSet: Set<string>
): MachineOperationLogItem[] {
  const matched: MachineOperationLogItem[] = [];
  for (const hauler of haulers) {
    if (assignedHaulerSet.has(hauler.id)) continue;
    const matchesExcavator =
      hauler.assignedExcavatorName === excName ||
      Boolean(hauler.excavatorActivity?.includes(excName));
    if (matchesExcavator) {
      matched.push(hauler);
      assignedHaulerSet.add(hauler.id);
    }
  }
  if (matched.length === 0 && haulers.length > 0) {
    for (const hauler of haulers) {
      if (!assignedHaulerSet.has(hauler.id)) {
        matched.push(hauler);
        assignedHaulerSet.add(hauler.id);
      }
    }
  }
  return matched;
}

function aggregateExcavatorBlock(
  exc: MachineOperationLogItem,
  matchedHaulers: readonly MachineOperationLogItem[],
  materialConfig: ReturnType<typeof resolveMaterialConfig>
): ExcavatorActivityBlockData {
  const haulerRows: HaulingMachineRow[] = matchedHaulers.map((haulerLog) =>
    buildHaulingRow({ log: haulerLog, fallbackMaterial: materialConfig.label })
  );

  let totalLoads = 0;
  let totalMaterialMoved = 0;
  let totalSmrSum = 0;
  for (const hauler of haulerRows) {
    totalLoads += hauler.loads;
    totalMaterialMoved += hauler.rowTotal;
    totalSmrSum += hauler.totalSmrWorked;
  }
  if (haulerRows.length === 0 && exc.bcmMoved > 0) {
    totalMaterialMoved = exc.bcmMoved;
    totalLoads = exc.loadsCount || Math.round(exc.bcmMoved / materialConfig.defaultFactor);
  }
  const averageHaulerSmr =
    haulerRows.length > 0 ? Number((totalSmrSum / haulerRows.length).toFixed(1)) : 0;

  const delaysGrid = buildExcavatorDelaysGrid({ excavatorLog: exc, haulerRows });
  const rawMaterial =
    exc.material ||
    (exc.excavatorActivity?.toLowerCase().includes('coal') ? 'ROM Coal' : 'Overburden');
  // materialConfig already resolved by caller; keep parity
  void rawMaterial;

  return {
    excavatorId: exc.machineName,
    excavatorName: exc.machineName,
    excavatorModel: exc.machineType || 'Liebherr 984 / CAT 390D',
    material: materialConfig.label,
    materialUnit: materialConfig.unit,
    blockMined: exc.blockMined || 'Pit Bench SS-01',
    assignedMachines: haulerRows,
    autoTotals: {
      totalLoads,
      totalMaterialMoved: Number(totalMaterialMoved.toFixed(1)),
      averageHaulerSmr,
    },
    delaysGrid,
  };
}

export function buildSiteShiftReports(
  filteredMachineOps: readonly MachineOperationLogItem[]
): SiteShiftReportData[] {
  const siteMap = buildSiteBuckets(filteredMachineOps);
  const reports: SiteShiftReportData[] = [];

  for (const [siteName, groups] of siteMap.entries()) {
    const excavatorBlocks: ExcavatorActivityBlockData[] = [];
    const assignedHaulerSet = new Set<string>();

    const activeExcavators =
      groups.excavators.length > 0
        ? groups.excavators
        : [createDefaultExcavator(siteName, filteredMachineOps)];

    for (const exc of activeExcavators) {
      const excName = exc.machineName;
      const matchedHaulers = matchHaulersForExcavator(excName, groups.haulers, assignedHaulerSet);

      const rawMaterial =
        exc.material ||
        (exc.excavatorActivity?.toLowerCase().includes('coal') ? 'ROM Coal' : 'Overburden');
      const materialConfig = resolveMaterialConfig(rawMaterial, exc.machineType);

      const block = aggregateExcavatorBlock(exc, matchedHaulers, materialConfig);
      excavatorBlocks.push(block);
    }

    const dozerRollovers: DozerRolloverRow[] = groups.dozers.map((dozerLog) => {
      const openingSmr = dozerLog.startSmu != null ? Number(dozerLog.startSmu) : 0;
      const closingSmr =
        dozerLog.endSmu != null
          ? Number(dozerLog.endSmu)
          : dozerLog.startSmu != null
            ? Number(dozerLog.startSmu) + dozerLog.hoursWorked
            : dozerLog.hoursWorked;
      const hoursWorked = Number(
        (closingSmr - openingSmr > 0 ? closingSmr - openingSmr : dozerLog.hoursWorked).toFixed(1)
      );
      const rolloverBcm = Number((hoursWorked * 250).toFixed(1));
      return {
        machineName: dozerLog.machineName,
        operatorName: dozerLog.operatorName || 'Dozer Operator',
        openingSmr,
        closingSmr,
        hoursWorked,
        bladePasses: dozerLog.bladePasses || Math.round(hoursWorked * 6),
        rolloverBcm,
        delayMinutes: dozerLog.delayMinutes,
      };
    });

    let siteLoads = 0;
    let siteMaterialMoved = 0;
    let siteHours = 0;
    let siteDelaysMin = 0;
    let siteCoalTonnes = 0;
    let siteBcmVolume = 0;

    for (const block of excavatorBlocks) {
      siteLoads += block.autoTotals.totalLoads;
      siteMaterialMoved += block.autoTotals.totalMaterialMoved;
      siteDelaysMin += block.delaysGrid.totalDowntimeMins;
      if (block.materialUnit === 'Tonnes') {
        siteCoalTonnes += block.autoTotals.totalMaterialMoved;
      } else {
        siteBcmVolume += block.autoTotals.totalMaterialMoved;
      }
    }
    for (const dozer of dozerRollovers) {
      siteHours += dozer.hoursWorked;
      siteMaterialMoved += dozer.rolloverBcm;
      siteBcmVolume += dozer.rolloverBcm;
      siteDelaysMin += dozer.delayMinutes;
    }
    for (const exc of groups.excavators) siteHours += exc.hoursWorked;
    for (const hauler of groups.haulers) siteHours += hauler.hoursWorked;
    for (const other of groups.others) {
      siteHours += other.hoursWorked;
      siteDelaysMin += other.delayMinutes;
    }

    reports.push({
      siteName,
      excavatorBlocks,
      dozerRollovers,
      siteTotals: {
        totalLoads: siteLoads,
        totalMaterialMoved: Number(siteMaterialMoved.toFixed(1)),
        totalHours: Number(siteHours.toFixed(1)),
        totalDelaysMin: siteDelaysMin,
        bcmVolume: Number(siteBcmVolume.toFixed(1)),
        coalTonnes: Number(siteCoalTonnes.toFixed(1)),
      },
    });
  }

  return reports.sort((a, b) => a.siteName.localeCompare(b.siteName));
}

export function buildExecutiveSummary(params: {
  siteReports: readonly SiteShiftReportData[];
  departmentName: string;
  reportDate: string;
  shift: 'day' | 'night';
  periodLabel: string;
}): ExecutiveSummaryMetrics {
  const { siteReports, departmentName, reportDate, shift, periodLabel } = params;

  let totalMaterialMoved = 0;
  let totalLoads = 0;
  let totalFleetSmrWorked = 0;
  let totalDelayMinutes = 0;

  const siteMap = new Map<string, { amount: number; loads: number; hours: number; unit: string }>();
  const materialMap = new Map<string, { amount: number; unit: string }>();

  let totalProdMins = 0;
  let totalEngMins = 0;
  let totalExternalMins = 0;
  let totalStandardMins = 0;
  let totalMachinesCount = 0;

  for (const site of siteReports) {
    totalMaterialMoved += site.siteTotals.totalMaterialMoved;
    totalLoads += site.siteTotals.totalLoads;
    totalFleetSmrWorked += site.siteTotals.totalHours;
    totalDelayMinutes += site.siteTotals.totalDelaysMin;

    siteMap.set(site.siteName, {
      amount: site.siteTotals.totalMaterialMoved,
      loads: site.siteTotals.totalLoads,
      hours: site.siteTotals.totalHours,
      unit: site.siteTotals.coalTonnes > site.siteTotals.bcmVolume ? 'Tonnes' : 'BCM',
    });

    for (const block of site.excavatorBlocks) {
      totalMachinesCount += block.assignedMachines.length + 1;
      const mat = block.material;
      const current = materialMap.get(mat) || { amount: 0, unit: block.materialUnit };
      materialMap.set(mat, {
        amount: current.amount + block.autoTotals.totalMaterialMoved,
        unit: block.materialUnit,
      });

      totalProdMins += block.delaysGrid.production.totalMins;
      totalEngMins += block.delaysGrid.engineering.totalMins;
      totalExternalMins += block.delaysGrid.external.totalMins;
      totalStandardMins += block.delaysGrid.standard.totalMins;
    }

    if (site.dozerRollovers.length > 0) {
      totalMachinesCount += site.dozerRollovers.length;
      const current = materialMap.get('Dozer Roll-Over') || { amount: 0, unit: 'BCM' };
      let rolloverSum = 0;
      for (const d of site.dozerRollovers) rolloverSum += d.rolloverBcm;
      materialMap.set('Dozer Roll-Over', {
        amount: current.amount + rolloverSum,
        unit: 'BCM',
      });
    }
  }

  const productionBySite = Array.from(siteMap.entries()).map(([site, data]) => ({
    site,
    amount: Number(data.amount.toFixed(1)),
    loads: data.loads,
    hours: Number(data.hours.toFixed(1)),
    unit: data.unit,
  }));

  const materialSplit = Array.from(materialMap.entries()).map(([material, data]) => ({
    material,
    amount: Number(data.amount.toFixed(1)),
    pct: totalMaterialMoved > 0 ? Number(((data.amount / totalMaterialMoved) * 100).toFixed(1)) : 0,
    unit: data.unit,
  }));

  const operatingHours = totalFleetSmrWorked;
  const delayHours = Number((totalDelayMinutes / 60).toFixed(1));
  const totalScheduleHours = operatingHours + delayHours;
  const utilizationPct =
    totalScheduleHours > 0 ? Number(((operatingHours / totalScheduleHours) * 100).toFixed(1)) : 88;
  const availabilityPct =
    totalScheduleHours > 0
      ? Number((((totalScheduleHours - totalEngMins / 60) / totalScheduleHours) * 100).toFixed(1))
      : 92;

  const delayTypeBreakdown = [
    { name: 'Production', minutes: totalProdMins, color: '#2563eb' },
    { name: 'Engineering', minutes: totalEngMins, color: '#d97706' },
    { name: 'Weather / External', minutes: totalExternalMins, color: '#0284c7' },
    { name: 'Standard Allowances', minutes: totalStandardMins, color: '#475569' },
  ];

  return {
    reportDate,
    shift,
    departmentName,
    periodLabel,
    totalMaterialMoved: Number(totalMaterialMoved.toFixed(1)),
    totalLoads,
    totalFleetSmrWorked: Number(totalFleetSmrWorked.toFixed(1)),
    totalDelayMinutes,
    sitesCount: siteReports.length,
    fleetCount: Math.max(totalMachinesCount, 1),
    productionBySite,
    materialSplit,
    fleetUtilization: {
      operatingHours,
      delayHours,
      totalHours: Number(totalScheduleHours.toFixed(1)),
      utilizationPct,
      availabilityPct,
      delayTypeBreakdown,
    },
  };
}
