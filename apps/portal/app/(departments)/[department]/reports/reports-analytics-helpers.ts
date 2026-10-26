import type {
  ArchivedReportData,
  DailyAggregatedRow,
  EngineeringLogItem,
  MachineOperationLogItem,
  MonthlyRollupItem,
  PdfReportDataPayload,
  PdfSiteGroup,
  ReportsKpiStats,
  ShiftComparisonMetrics,
  ShiftReportRow,
  SiteBreakdownItem,
} from './reports-types';

export function extractUniqueSites(
  shiftRows: ShiftReportRow[],
  machineOperationLogs: MachineOperationLogItem[]
): string[] {
  const set = new Set<string>();
  for (const r of shiftRows) {
    if (r.site && r.site !== '—') set.add(r.site);
  }
  for (const m of machineOperationLogs) {
    if (m.siteName && m.siteName !== '—') set.add(m.siteName);
  }
  return Array.from(set).sort();
}

export function computeReportsKpiStats(
  shiftRows: ShiftReportRow[],
  todayStr: string,
  engineeringLogs: EngineeringLogItem[],
  totalFleetCount: number,
  coveredFleetCount: number
): ReportsKpiStats {
  let totalHours = 0;
  let totalLoads = 0;
  let totalHaulBcm = 0;
  let totalDozerBcm = 0;
  let totalBcm = 0;
  let totalDelayMin = 0;
  let totalPasses = 0;
  let todayBcm = 0;
  let todayLoads = 0;
  let todayHours = 0;

  for (const r of shiftRows) {
    totalHours += r.hours;
    totalLoads += r.loads;
    totalHaulBcm += r.haulBcm;
    totalDozerBcm += r.dozerRolloverBcm;
    totalBcm += r.totalBcm;
    totalDelayMin += r.delayMin;
    totalPasses += r.dozerPasses;

    if (r.date === todayStr) {
      todayBcm += r.totalBcm;
      todayLoads += r.loads;
      todayHours += r.hours;
    }
  }

  let openIssues = 0;
  let resolvedIssues = 0;
  for (const e of engineeringLogs) {
    if (e.status === 'open') openIssues++;
    else if (e.status === 'resolved') resolvedIssues++;
  }

  const coveragePct =
    totalFleetCount > 0 ? Math.round((coveredFleetCount / totalFleetCount) * 100) : 100;
  const bcmPerHour = totalHours > 0 ? totalBcm / totalHours : 0;

  return {
    totalHours,
    totalLoads,
    totalHaulBcm,
    totalDozerBcm,
    totalBcm,
    totalDelayMin,
    totalPasses,
    todayBcm,
    todayLoads,
    todayHours,
    openIssues,
    resolvedIssues,
    coveragePct,
    bcmPerHour,
  };
}

export function filterShiftReportRows(
  shiftRows: ShiftReportRow[],
  shiftFilter: 'all' | 'day' | 'night',
  siteFilter: string,
  searchQuery: string
): ShiftReportRow[] {
  return shiftRows.filter((r) => {
    if (shiftFilter !== 'all' && r.shift !== shiftFilter) return false;
    if (siteFilter !== 'all' && r.site !== siteFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.site.toLowerCase().includes(q) ||
        r.date.toLowerCase().includes(q) ||
        r.shift.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function filterMachineOperationLogs(
  machineOperationLogs: MachineOperationLogItem[],
  shiftFilter: 'all' | 'day' | 'night',
  siteFilter: string,
  searchQuery: string
): MachineOperationLogItem[] {
  return machineOperationLogs.filter((m) => {
    if (shiftFilter !== 'all' && m.shift !== shiftFilter) return false;
    if (siteFilter !== 'all' && m.siteName !== siteFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.machineName.toLowerCase().includes(q) ||
        m.machineType.toLowerCase().includes(q) ||
        m.operatorName.toLowerCase().includes(q) ||
        m.siteName.toLowerCase().includes(q) ||
        m.date.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function filterEngineeringLogItems(
  engineeringLogs: EngineeringLogItem[],
  shiftFilter: 'all' | 'day' | 'night',
  searchQuery: string
): EngineeringLogItem[] {
  return engineeringLogs.filter((e) => {
    if (shiftFilter !== 'all' && e.shift !== shiftFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.machineName.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.actionTaken.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function computeShiftComparison(
  filteredShiftRows: ShiftReportRow[]
): ShiftComparisonMetrics {
  let dayBcm = 0;
  let nightBcm = 0;
  let dayLoads = 0;
  let nightLoads = 0;
  let dayHours = 0;
  let nightHours = 0;
  let dayDelays = 0;
  let nightDelays = 0;

  for (const r of filteredShiftRows) {
    if (r.shift === 'day') {
      dayBcm += r.totalBcm;
      dayLoads += r.loads;
      dayHours += r.hours;
      dayDelays += r.delayMin;
    } else if (r.shift === 'night') {
      nightBcm += r.totalBcm;
      nightLoads += r.loads;
      nightHours += r.hours;
      nightDelays += r.delayMin;
    }
  }

  const maxBcm = Math.max(dayBcm + nightBcm, 1);
  return {
    dayBcm,
    nightBcm,
    dayLoads,
    nightLoads,
    dayHours,
    nightHours,
    dayDelays,
    nightDelays,
    dayPct: Math.round((dayBcm / maxBcm) * 100),
    nightPct: Math.round((nightBcm / maxBcm) * 100),
  };
}

export function computeSiteBreakdown(filteredShiftRows: ShiftReportRow[]): SiteBreakdownItem[] {
  const map = new Map<
    string,
    { site: string; bcm: number; loads: number; hours: number; delays: number }
  >();
  for (const r of filteredShiftRows) {
    const siteKey = r.site || 'General / Unassigned';
    const curr = map.get(siteKey) || {
      site: siteKey,
      bcm: 0,
      loads: 0,
      hours: 0,
      delays: 0,
    };
    curr.bcm += r.totalBcm;
    curr.loads += r.loads;
    curr.hours += r.hours;
    curr.delays += r.delayMin;
    map.set(siteKey, curr);
  }
  const list = Array.from(map.values()).sort((a, b) => b.bcm - a.bcm);
  const maxSiteBcm = Math.max(...list.map((s) => s.bcm), 1);
  return list.map((s) => ({
    ...s,
    pct: Math.round((s.bcm / maxSiteBcm) * 100),
    bcmPerHour: s.hours > 0 ? s.bcm / s.hours : 0,
  }));
}

export function computeDailyAggregatedRows(
  shiftRows: ShiftReportRow[],
  siteFilter: string
): DailyAggregatedRow[] {
  const map = new Map<
    string,
    {
      date: string;
      sites: Set<string>;
      shiftsLogged: Set<string>;
      hours: number;
      loads: number;
      haulBcm: number;
      dozerRolloverBcm: number;
      totalBcm: number;
      delayMin: number;
      dozerPasses: number;
      fuelLitres: number;
      coalTonnes: number;
      wasteTonnes: number;
      notes: string[];
    }
  >();

  for (const r of shiftRows) {
    if (siteFilter !== 'all' && r.site !== siteFilter) continue;
    const existing = map.get(r.date) || {
      date: r.date,
      sites: new Set<string>(),
      shiftsLogged: new Set<string>(),
      hours: 0,
      loads: 0,
      haulBcm: 0,
      dozerRolloverBcm: 0,
      totalBcm: 0,
      delayMin: 0,
      dozerPasses: 0,
      fuelLitres: 0,
      coalTonnes: 0,
      wasteTonnes: 0,
      notes: [],
    };
    if (r.site && r.site !== '—') existing.sites.add(r.site);
    existing.shiftsLogged.add(r.shift);
    existing.hours += r.hours;
    existing.loads += r.loads;
    existing.haulBcm += r.haulBcm;
    existing.dozerRolloverBcm += r.dozerRolloverBcm;
    existing.totalBcm += r.totalBcm;
    existing.delayMin += r.delayMin;
    existing.dozerPasses += r.dozerPasses;
    existing.fuelLitres += r.fuelLitres;
    existing.coalTonnes += r.coalTonnes;
    existing.wasteTonnes += r.wasteTonnes;
    if (r.notes) existing.notes.push(r.notes);
    map.set(r.date, existing);
  }

  const list = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  const maxDayBcm = Math.max(...list.map((d) => d.totalBcm), 1);

  return list.map((d) => ({
    ...d,
    siteList: Array.from(d.sites),
    shiftCount: d.shiftsLogged.size,
    bcmPct: Math.round((d.totalBcm / maxDayBcm) * 100),
    bcmPerHour: d.hours > 0 ? d.totalBcm / d.hours : 0,
  }));
}

export function computeArchivedReportData(
  shiftRows: ShiftReportRow[],
  shiftFilter: 'all' | 'day' | 'night',
  siteFilter: string,
  searchQuery: string,
  todayStr: string
): ArchivedReportData {
  const historicalRows = filterShiftReportRows(shiftRows, shiftFilter, siteFilter, searchQuery);

  const monthMap = new Map<string, MonthlyRollupItem>();

  for (const r of historicalRows) {
    const month = r.date.slice(0, 7);
    const curr = monthMap.get(month) || {
      month,
      shiftCount: 0,
      hours: 0,
      loads: 0,
      haulBcm: 0,
      dozerRolloverBcm: 0,
      totalBcm: 0,
      delayMin: 0,
    };
    curr.shiftCount += 1;
    curr.hours += r.hours;
    curr.loads += r.loads;
    curr.haulBcm += r.haulBcm;
    curr.dozerRolloverBcm += r.dozerRolloverBcm;
    curr.totalBcm += r.totalBcm;
    curr.delayMin += r.delayMin;
    monthMap.set(month, curr);
  }

  const monthlyRollups = Array.from(monthMap.values()).sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  return {
    historicalRows,
    monthlyRollups,
    priorDaysRows: historicalRows.filter((r) => r.date < todayStr),
  };
}

export function buildPdfShiftReportPayload(params: {
  pdfSiteGroups: PdfSiteGroup[];
  pdfReportData: PdfReportDataPayload;
  departmentName: string;
  todayStr: string;
  fromDateStr: string;
  toDateStr: string;
  shiftFilter: 'all' | 'day' | 'night';
}): PdfReportDataPayload {
  const {
    pdfSiteGroups,
    pdfReportData,
    departmentName,
    todayStr,
    fromDateStr,
    toDateStr,
    shiftFilter,
  } = params;
  if (pdfSiteGroups.length === 0) return pdfReportData;

  const rows: string[][] = [];
  let prod = 0;
  let eng = 0;
  let nat = 0;
  let nonSite = 0;
  let totalHours = 0;

  for (const g of pdfSiteGroups) {
    prod += g.productionDelayMin;
    eng += g.engineeringDelayMin;
    nat += g.naturalDelayMin;
    nonSite += g.nonSiteDelayMin;
    totalHours += g.totalHours;
    for (const m of g.orderedMachines) {
      const roleLabel =
        m.siteGroupRole === 'excavator'
          ? '1. Excavator'
          : m.siteGroupRole === 'rollover'
            ? '2. Roll Over'
            : '3. Site Machine';
      const smuRange =
        m.startSmu != null && m.endSmu != null
          ? `${m.startSmu.toFixed(1)} - ${m.endSmu.toFixed(1)}`
          : m.startSmu != null
            ? `${m.startSmu.toFixed(1)} - Active`
            : '—';
      rows.push([
        g.site,
        roleLabel,
        `${m.machineName} (${m.machineType})`,
        smuRange,
        `${m.hoursWorked.toFixed(2)}h`,
        m.operatorName,
        `${m.productionDelayMinutes ?? 0}m`,
        `${m.engineeringDelayMinutes ?? 0}m`,
        `${m.naturalDelayMinutes ?? 0}m`,
        `${m.nonSiteDelayMinutes ?? 0}m`,
        m.excavatorActivity || '—',
      ]);
    }
  }

  return {
    title: `${departmentName} — Site-Grouped Shift Report`,
    subtitle: `Generated on ${todayStr} — Date range: ${fromDateStr} to ${toDateStr} (${shiftFilter === 'all' ? 'All Shifts' : `${shiftFilter.toUpperCase()} Shift`})`,
    kpis: [
      { label: 'Total Worked Hours', value: `${totalHours.toFixed(1)} h` },
      { label: 'Production Delay', value: `${prod} min` },
      { label: 'Engineering Delay', value: `${eng} min` },
      {
        label: 'Natural / Non-Site Delay',
        value: `${nat}m / ${nonSite}m`,
      },
    ],
    tableHeaders: [
      'Site',
      'Group',
      'Machine',
      'Hours Start - Stop',
      'Total Worked',
      'Operator',
      'Prod Delay',
      'Eng Delay',
      'Natural Delays',
      'Non-Site Delays',
      'Excavator Activity',
    ],
    tableRows: rows,
  };
}
