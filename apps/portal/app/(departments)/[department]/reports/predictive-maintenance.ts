import type {
  EngineeringLogItem,
  MachineDailyOverviewRecord,
  MachineMonthlySummaryRow,
} from './reports-types';

export interface MachinePredictiveMetric {
  machineId: string;
  machineName: string;
  machineType: string;
  siteName: string;
  totalSmrWorked: number;
  breakdownCount: number;
  totalBreakdownHours: number;
  mtbfHours: number; // Mean Time Between Failures
  mttrHours: number; // Mean Time to Repair
  hoursSinceLastBreakdown: number;
  serviceIntervalProximity: {
    hoursToNext250Service: number;
    hoursToNext500Service: number;
    isApproaching250Service: boolean;
    isApproaching500Service: boolean;
    isServiceOverdue: boolean;
  };
  healthRiskLevel: 'low' | 'moderate' | 'elevated' | 'critical';
}

const SERVICE_INTERVAL_250 = 250;
const SERVICE_INTERVAL_500 = 500;
const SERVICE_WARNING_WINDOW_HOURS = 25; // Alert when within 25h of 250h/500h service
const HIGH_MTTR_THRESHOLD_HOURS = 6;
const LOW_MTBF_THRESHOLD_HOURS = 40;

export function computeMachinePredictiveMetrics(params: {
  summaryRow: MachineMonthlySummaryRow;
  dayRows: readonly MachineDailyOverviewRecord[];
  engineeringLogs: readonly EngineeringLogItem[];
}): MachinePredictiveMetric {
  const { summaryRow, dayRows, engineeringLogs } = params;

  // Breakdown occurrences for this machine
  const machineNameLower = summaryRow.machineName.toLowerCase();
  const serialLower = (summaryRow.serialNumber ?? '').toLowerCase();

  const machineBreakdownLogs = engineeringLogs.filter((log) => {
    const logName = (log.machineName ?? '').toLowerCase();
    const isNameMatch =
      logName === machineNameLower ||
      machineNameLower.includes(logName) ||
      (serialLower.length > 0 && logName.includes(serialLower));
    return (
      isNameMatch &&
      (log.source === 'breakdown' || log.category.toLowerCase().includes('breakdown'))
    );
  });

  const breakdownDays = dayRows.filter((row) => row.delays.breakdown > 0 || row.endsOnBreakdown);

  const breakdownCount = Math.max(machineBreakdownLogs.length, breakdownDays.length);
  const totalBreakdownHours = summaryRow.delays.breakdown ?? 0;
  const totalWorked = summaryRow.totalSmrWorked;

  // MTBF: Total Worked / Breakdown Count (or total worked if 0 breakdowns)
  const mtbfHours =
    breakdownCount > 0
      ? Number((totalWorked / breakdownCount).toFixed(1))
      : Number(totalWorked.toFixed(1));

  // MTTR: Total Breakdown Hours / Breakdown Count
  const mttrHours =
    breakdownCount > 0 ? Number((totalBreakdownHours / breakdownCount).toFixed(1)) : 0;

  // Hours worked since the latest breakdown in the month
  let hoursSinceLastBreakdown = 0;
  let encounteredBreakdown = false;
  // Iterate backwards from the end of the month
  const sortedDays = [...dayRows].sort((a, b) => b.dayOfMonth - a.dayOfMonth);
  for (const d of sortedDays) {
    if (d.delays.breakdown > 0 || d.endsOnBreakdown) {
      encounteredBreakdown = true;
      break;
    }
    const workedToday = Math.max(0, d.stopSmr - d.startSmr);
    hoursSinceLastBreakdown += workedToday;
  }
  if (!encounteredBreakdown) {
    hoursSinceLastBreakdown = totalWorked;
  }

  // Service Interval Proximities (based on closing SMR)
  const closingSmr = summaryRow.closingSmr > 0 ? summaryRow.closingSmr : summaryRow.openingSmr;
  const smrMod250 = closingSmr % SERVICE_INTERVAL_250;
  const hoursToNext250Service = Number((SERVICE_INTERVAL_250 - smrMod250).toFixed(1));

  const smrMod500 = closingSmr % SERVICE_INTERVAL_500;
  const hoursToNext500Service = Number((SERVICE_INTERVAL_500 - smrMod500).toFixed(1));

  const isApproaching250Service = hoursToNext250Service <= SERVICE_WARNING_WINDOW_HOURS;
  const isApproaching500Service = hoursToNext500Service <= SERVICE_WARNING_WINDOW_HOURS;
  const isServiceOverdue = hoursToNext250Service === 0 || hoursToNext500Service === 0;

  // Health Risk Assessment
  let healthRiskLevel: 'low' | 'moderate' | 'elevated' | 'critical' = 'low';
  if (totalBreakdownHours >= 24 || breakdownCount >= 4 || isServiceOverdue) {
    healthRiskLevel = 'critical';
  } else if (
    totalBreakdownHours >= 12 ||
    breakdownCount >= 2 ||
    isApproaching500Service ||
    (mttrHours >= HIGH_MTTR_THRESHOLD_HOURS && breakdownCount > 0)
  ) {
    healthRiskLevel = 'elevated';
  } else if (
    totalBreakdownHours > 0 ||
    isApproaching250Service ||
    (mtbfHours < LOW_MTBF_THRESHOLD_HOURS && totalWorked > 20)
  ) {
    healthRiskLevel = 'moderate';
  }

  return {
    machineId: summaryRow.machineId,
    machineName: summaryRow.machineName,
    machineType: summaryRow.machineType,
    siteName: summaryRow.siteName,
    totalSmrWorked: totalWorked,
    breakdownCount,
    totalBreakdownHours,
    mtbfHours,
    mttrHours,
    hoursSinceLastBreakdown,
    serviceIntervalProximity: {
      hoursToNext250Service,
      hoursToNext500Service,
      isApproaching250Service,
      isApproaching500Service,
      isServiceOverdue,
    },
    healthRiskLevel,
  };
}
