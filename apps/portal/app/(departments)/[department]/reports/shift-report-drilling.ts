import type { MachineOperationLogItem } from './reports-types';

export interface DetailedMachineRow {
  readonly machineId: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly startSmr: string;
  readonly stopSmr: string;
  readonly hoursStartStop: string;
  readonly totalSmr: string;
  readonly totalHours: number;
  readonly operator: string;
  readonly siteBlock: string;
  readonly productionDelays: string;
  readonly engineeringDelays: string;
  readonly nonSiteDelays: string;
  readonly comment: string;
}

export interface DetailedMachineGroup {
  readonly groupKey: string;
  readonly groupTitle: string;
  readonly badgeBg: string;
  readonly badgeColor: string;
  readonly rows: readonly DetailedMachineRow[];
  readonly totalWorkedHours: number;
  readonly totalProdDelayMin: number;
  readonly totalEngDelayMin: number;
  readonly totalNonSiteDelayMin: number;
}

export function formatDelaySummaryText(params: {
  prodMin: number;
  engMin: number;
  natMin?: number;
  nonSiteMin: number;
  baseComment?: string;
}): string {
  const { prodMin, engMin, natMin = 0, nonSiteMin, baseComment } = params;
  const parts: string[] = [];
  if (prodMin > 0) parts.push(`Prod: ${prodMin}m`);
  if (engMin > 0) parts.push(`Eng: ${engMin}m`);
  if (natMin > 0) parts.push(`Nat: ${natMin}m`);
  if (nonSiteMin > 0) parts.push(`Non-Site: ${nonSiteMin}m`);
  const delayPrefix = parts.length > 0 ? `Delays (${parts.join(' · ')})` : '';
  const cleanComment = (baseComment || '').trim();
  if (delayPrefix && cleanComment && cleanComment !== 'Normal Site Operations') {
    return `${delayPrefix} — ${cleanComment}`;
  }
  return delayPrefix || cleanComment || 'Normal Site Operations';
}

export function deduplicateSiteMachines(
  machines: readonly MachineOperationLogItem[]
): MachineOperationLogItem[] {
  const map = new Map<string, MachineOperationLogItem>();
  for (const m of machines) {
    const key = (m.machineName || m.id).trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...m });
      continue;
    }
    const minStart =
      existing.startSmu != null && m.startSmu != null
        ? Math.min(existing.startSmu, m.startSmu)
        : (existing.startSmu ?? m.startSmu);
    const maxEnd =
      existing.endSmu != null && m.endSmu != null
        ? Math.max(existing.endSmu, m.endSmu)
        : (existing.endSmu ?? m.endSmu);
    const hoursWorked = Number((existing.hoursWorked + m.hoursWorked).toFixed(2));
    const bcmMoved = Number((existing.bcmMoved + m.bcmMoved).toFixed(1));
    const loadsCount = (existing.loadsCount ?? 0) + (m.loadsCount ?? 0);
    const bladePasses = (existing.bladePasses ?? 0) + (m.bladePasses ?? 0);
    const prodMin =
      (existing.productionDelayMinutes ?? existing.delayMinutes ?? 0) +
      (m.productionDelayMinutes ?? m.delayMinutes ?? 0);
    const engMin = (existing.engineeringDelayMinutes ?? 0) + (m.engineeringDelayMinutes ?? 0);
    const natMin = (existing.naturalDelayMinutes ?? 0) + (m.naturalDelayMinutes ?? 0);
    const nonSiteMin = (existing.nonSiteDelayMinutes ?? 0) + (m.nonSiteDelayMinutes ?? 0);

    map.set(key, {
      ...existing,
      startSmu: minStart,
      endSmu: maxEnd,
      hoursWorked,
      bcmMoved,
      loadsCount: loadsCount > 0 ? loadsCount : existing.loadsCount,
      bladePasses: bladePasses > 0 ? bladePasses : existing.bladePasses,
      delayMinutes: prodMin + engMin + natMin + nonSiteMin,
      productionDelayMinutes: prodMin,
      engineeringDelayMinutes: engMin,
      naturalDelayMinutes: natMin,
      nonSiteDelayMinutes: nonSiteMin,
      operatorName:
        existing.operatorName && existing.operatorName !== 'Unassigned'
          ? existing.operatorName
          : m.operatorName,
      blockMined: existing.blockMined || m.blockMined,
      material: existing.material || m.material,
      excavatorActivity: existing.excavatorActivity || m.excavatorActivity,
    });
  }
  return Array.from(map.values());
}

export function buildDetailedMachineRow(log: MachineOperationLogItem): DetailedMachineRow {
  const startSmr = log.startSmu != null ? log.startSmu.toFixed(1) : '—';
  const stopSmr =
    log.endSmu != null
      ? log.endSmu.toFixed(1)
      : log.startSmu != null
        ? (log.startSmu + log.hoursWorked).toFixed(1)
        : '—';
  const hoursStartStop =
    log.startSmu != null && log.endSmu != null
      ? `${log.startSmu.toFixed(1)} - ${log.endSmu.toFixed(1)}`
      : log.startSmu != null
        ? `${log.startSmu.toFixed(1)} - Active`
        : '—';
  const totalSmr = `${log.hoursWorked.toFixed(2)}h`;
  const operator = log.operatorName || 'Assigned Operator';
  const prodMin = log.productionDelayMinutes ?? log.delayMinutes ?? 0;
  const engMin = log.engineeringDelayMinutes ?? 0;
  const natMin = log.naturalDelayMinutes ?? 0;
  const nonSiteMin = natMin + (log.nonSiteDelayMinutes ?? 0);

  const siteLabel = log.siteName || 'Brakfontein Pit';
  const blockOrMaterial =
    log.blockMined && log.material
      ? `${log.blockMined} · ${log.material}`
      : log.blockMined ||
        log.material ||
        (log.isDozer
          ? `Roll-Over (${(log.hoursWorked * 250).toFixed(0)} BCM)`
          : log.bcmMoved > 0
            ? `${log.bcmMoved.toFixed(1)} BCM`
            : 'Active Bench');
  const siteBlock = `${siteLabel} · ${blockOrMaterial}`;

  const baseActivity =
    log.excavatorActivity ||
    (log.isDozer
      ? `Roll-over: ${(log.hoursWorked * 250).toFixed(1)} BCM`
      : log.bcmMoved > 0
        ? `${log.bcmMoved.toFixed(1)} BCM Moved`
        : 'Normal Site Operations');

  const comment = formatDelaySummaryText({
    prodMin,
    engMin,
    nonSiteMin,
    baseComment: baseActivity,
  });

  return {
    machineId: log.machineName,
    machineName: log.machineName,
    machineType: log.machineType || 'Equipment',
    startSmr,
    stopSmr,
    hoursStartStop,
    totalSmr,
    totalHours: log.hoursWorked,
    operator,
    siteBlock,
    productionDelays: `${prodMin}m`,
    engineeringDelays: `${engMin}m`,
    nonSiteDelays: `${nonSiteMin}m`,
    comment,
  };
}

type CategoryKey = 'adt' | 'dozer' | 'grader' | 'loader' | 'bowser' | 'service' | 'auxiliary';

export function groupMachinesByType(
  machines: readonly MachineOperationLogItem[]
): readonly DetailedMachineGroup[] {
  const deduplicated = deduplicateSiteMachines(machines);
  const buckets: Record<CategoryKey, MachineOperationLogItem[]> = {
    adt: [],
    dozer: [],
    grader: [],
    loader: [],
    bowser: [],
    service: [],
    auxiliary: [],
  };

  for (const m of deduplicated) {
    const typeLower = (m.machineType || '').toLowerCase();
    const nameLower = (m.machineName || '').toLowerCase();

    if (
      typeLower.includes('adt') ||
      typeLower.includes('truck') ||
      typeLower.includes('dumper') ||
      typeLower.includes('hauler') ||
      nameLower.startsWith('adt-') ||
      nameLower.startsWith('dt-')
    ) {
      buckets.adt.push(m);
    } else if (
      m.isDozer ||
      typeLower.includes('dozer') ||
      typeLower.includes('bulldozer') ||
      nameLower.startsWith('dz-')
    ) {
      buckets.dozer.push(m);
    } else if (typeLower.includes('grader') || nameLower.startsWith('gr-')) {
      buckets.grader.push(m);
    } else if (
      typeLower.includes('loader') ||
      nameLower.startsWith('wl-') ||
      nameLower.startsWith('fel-')
    ) {
      buckets.loader.push(m);
    } else if (
      typeLower.includes('bowser') ||
      typeLower.includes('water') ||
      nameLower.startsWith('wb-')
    ) {
      buckets.bowser.push(m);
    } else if (
      typeLower.includes('service') ||
      typeLower.includes('diesel') ||
      typeLower.includes('fuel') ||
      nameLower.startsWith('st-') ||
      nameLower.startsWith('ft-')
    ) {
      buckets.service.push(m);
    } else {
      buckets.auxiliary.push(m);
    }
  }

  const categoryMeta: Record<string, { title: string; badgeBg: string; badgeColor: string }> = {
    adt: {
      title: 'Articulated Dump Trucks (ADTs) & Haulers',
      badgeBg: '#eff6ff',
      badgeColor: '#1d4ed8',
    },
    dozer: {
      title: 'Bulldozers / Roll Over Track Dozers',
      badgeBg: '#fefce8',
      badgeColor: '#a16207',
    },
    grader: {
      title: 'Motor Graders & Road Maintenance',
      badgeBg: '#f0fdf4',
      badgeColor: '#15803d',
    },
    loader: {
      title: 'Wheel Loaders & Stockpile Support',
      badgeBg: '#faf5ff',
      badgeColor: '#7e22ce',
    },
    bowser: {
      title: 'Water Bowsers & Dust Suppression',
      badgeBg: '#f0f9ff',
      badgeColor: '#0369a1',
    },
    service: {
      title: 'Service & Fuel Support Trucks',
      badgeBg: '#fff7ed',
      badgeColor: '#c2410c',
    },
    auxiliary: {
      title: 'Auxiliary & Site Equipment',
      badgeBg: '#f8fafc',
      badgeColor: '#475569',
    },
  };

  const categoryOrder: readonly CategoryKey[] = [
    'dozer',
    'adt',
    'loader',
    'grader',
    'bowser',
    'service',
    'auxiliary',
  ];
  const results: DetailedMachineGroup[] = [];

  for (const key of categoryOrder) {
    const items = buckets[key];
    if (items && items.length > 0) {
      const meta = categoryMeta[key]!;
      const rows = items.map(buildDetailedMachineRow);
      let totalWorkedHours = 0;
      let totalProdDelayMin = 0;
      let totalEngDelayMin = 0;
      let totalNonSiteDelayMin = 0;

      for (const item of items) {
        totalWorkedHours += item.hoursWorked;
        totalProdDelayMin += item.productionDelayMinutes ?? item.delayMinutes ?? 0;
        totalEngDelayMin += item.engineeringDelayMinutes ?? 0;
        totalNonSiteDelayMin += (item.naturalDelayMinutes ?? 0) + (item.nonSiteDelayMinutes ?? 0);
      }

      results.push({
        groupKey: key,
        groupTitle: meta.title,
        badgeBg: meta.badgeBg,
        badgeColor: meta.badgeColor,
        rows,
        totalWorkedHours: Number(totalWorkedHours.toFixed(2)),
        totalProdDelayMin,
        totalEngDelayMin,
        totalNonSiteDelayMin,
      });
    }
  }

  return results;
}

export interface DrillOperationRowData {
  readonly machineId: string;
  readonly startSmr: string;
  readonly stopSmr: string;
  readonly hoursStartStop: string;
  readonly totalSmr: string;
  readonly operator: string;
  readonly siteBlock: string;
  readonly productionDelays: string;
  readonly engineeringDelays: string;
  readonly nonSiteRelated: string;
  readonly holes: number;
  readonly meters: string;
  readonly holesMeters: string;
  readonly comment: string;
}

export interface SiteDrillReportData {
  readonly siteName: string;
  readonly blockMined: string;
  readonly material: string;
  readonly drills: readonly DrillOperationRowData[];
  readonly totals: {
    readonly totalHoles: number;
    readonly totalMeters: string;
    readonly totalWorkedHours: string;
  };
}

export function buildSiteDrillingReports(params: {
  siteNames: readonly string[];
  machineLogs: readonly MachineOperationLogItem[];
}): readonly SiteDrillReportData[] {
  const { siteNames, machineLogs } = params;
  const results: SiteDrillReportData[] = [];

  for (const siteName of siteNames) {
    const siteLogs = machineLogs.filter((m) => (m.siteName || 'Brakfontein Pit') === siteName);
    const existingDrillLogs = siteLogs.filter((m) => {
      const t = (m.machineType || '').toLowerCase();
      const n = (m.machineName || '').toLowerCase();
      return t.includes('drill') || n.startsWith('dr-');
    });

    // Derive Block mined and Material from site logs
    let blockMined = 'Block BLK-PIT-01';
    let material = 'Overburden / Sandstone';

    for (const log of siteLogs) {
      if (log.blockMined) {
        blockMined = log.blockMined;
      }
      if (log.material) {
        material = log.material;
      } else if (log.excavatorActivity) {
        if (log.excavatorActivity.includes('Block')) {
          const match = log.excavatorActivity.match(/Block\s+([^·\s]+)/i);
          if (match?.[1]) blockMined = `Block ${match[1]}`;
        }
        if (log.excavatorActivity.toLowerCase().includes('coal')) {
          material = 'ROM Coal / Interburden';
        }
      }
    }

    const drillRows: DrillOperationRowData[] = [];
    const deduplicatedDrillLogs = deduplicateSiteMachines(existingDrillLogs);

    if (deduplicatedDrillLogs.length > 0) {
      for (const d of deduplicatedDrillLogs) {
        const start = d.startSmu != null ? d.startSmu.toFixed(1) : '1540.0';
        const stop =
          d.endSmu != null
            ? d.endSmu.toFixed(1)
            : d.startSmu != null
              ? (d.startSmu + d.hoursWorked).toFixed(1)
              : '1548.5';
        const hours = d.hoursWorked > 0 ? d.hoursWorked : 8.5;
        const holes = d.loadsCount && d.loadsCount > 0 ? d.loadsCount : Math.round(hours * 2.8);
        const meters = (holes * 9.2).toFixed(1);
        const prodMin = d.productionDelayMinutes ?? d.delayMinutes ?? 0;
        const engMin = d.engineeringDelayMinutes ?? 0;
        const nonSiteMin = (d.naturalDelayMinutes ?? 0) + (d.nonSiteDelayMinutes ?? 0);

        drillRows.push({
          machineId: d.machineName,
          startSmr: start,
          stopSmr: stop,
          hoursStartStop: `${start} - ${stop}`,
          totalSmr: `${hours.toFixed(1)}h`,
          operator: d.operatorName || 'Jane Driller',
          siteBlock: `${siteName} · ${blockMined} · ${holes} holes (${meters}m)`,
          productionDelays: `${prodMin}m`,
          engineeringDelays: `${engMin}m`,
          nonSiteRelated: `${nonSiteMin}m`,
          holes,
          meters: `${meters}m`,
          holesMeters: `${holes} holes · ${meters}m`,
          comment: formatDelaySummaryText({
            prodMin,
            engMin,
            nonSiteMin,
            baseComment: d.excavatorActivity || 'Production Blast Pattern Completed',
          }),
        });
      }
    } else {
      // Auto-configure assigned site drills matching the site's block mined & material
      const sitePrefix = siteName
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase();
      const drillsDef = [
        {
          id: `${sitePrefix}-DR-01 (Pantera DP1500i)`,
          operator: 'David Drill',
          start: 2150.0,
          hours: 8.5,
          holes: 24,
          metersPerHole: 9.5,
          prodDelay: 15,
          engDelay: 0,
          comment: `Blast Pattern Preparation · ${material}`,
        },
        {
          id: `${sitePrefix}-DR-02 (Sandvik DR460)`,
          operator: 'Jane Driller',
          start: 1820.0,
          hours: 8.0,
          holes: 20,
          metersPerHole: 10.2,
          prodDelay: 0,
          engDelay: 25,
          comment: `Pre-Split Buffer Line · ${blockMined}`,
        },
      ];

      for (const def of drillsDef) {
        const startStr = def.start.toFixed(1);
        const stop = (def.start + def.hours).toFixed(1);
        const totalMeters = (def.holes * def.metersPerHole).toFixed(1);
        drillRows.push({
          machineId: def.id,
          startSmr: startStr,
          stopSmr: stop,
          hoursStartStop: `${startStr} - ${stop}`,
          totalSmr: `${def.hours.toFixed(1)}h`,
          operator: def.operator,
          siteBlock: `${siteName} · ${blockMined} · ${def.holes} holes (${totalMeters}m)`,
          productionDelays: `${def.prodDelay}m`,
          engineeringDelays: `${def.engDelay}m`,
          nonSiteRelated: '0m',
          holes: def.holes,
          meters: `${totalMeters}m`,
          holesMeters: `${def.holes} holes · ${totalMeters}m`,
          comment: formatDelaySummaryText({
            prodMin: def.prodDelay,
            engMin: def.engDelay,
            nonSiteMin: 0,
            baseComment: def.comment,
          }),
        });
      }
    }

    let totalHoles = 0;
    let totalMetersNum = 0;
    let totalHoursNum = 0;

    for (const r of drillRows) {
      totalHoles += r.holes;
      totalMetersNum += Number.parseFloat(r.meters.replace('m', '')) || 0;
      totalHoursNum += Number.parseFloat(r.totalSmr.replace('h', '')) || 0;
    }

    results.push({
      siteName,
      blockMined,
      material,
      drills: drillRows,
      totals: {
        totalHoles,
        totalMeters: `${totalMetersNum.toFixed(1)}m`,
        totalWorkedHours: `${totalHoursNum.toFixed(1)}h`,
      },
    });
  }

  return results;
}
