import { computeMachinePredictiveMetrics } from './predictive-maintenance';
import type {
  EngineeringLogItem,
  MachineDailyOverviewRecord,
  MachineMonthlySummaryRow,
} from './reports-types';

describe('Predictive Maintenance Intelligence (MTBF / MTTR & Service Proximity)', () => {
  const baseSummaryRow: MachineMonthlySummaryRow = {
    machineId: 'mach-ex-01',
    machineName: 'EX-01 Liebherr 984',
    machineType: 'Excavator',
    serialNumber: 'SN-984-001',
    siteName: 'Pit North',
    month: '2026-10',
    daysInMonth: 31,
    activeDaysLogged: 20,
    openingSmr: 12000,
    closingSmr: 12240, // 240 hours SMR -> 10 hours to 12250 (approaching 250h service)
    totalSmrWorked: 240,
    delays: {
      natural: 0,
      blasting: 0,
      lunches: 0,
      safetyTalks: 0,
      refueling: 0,
      noOperator: 0,
      standby: 0,
      other: 0,
      gesMaintenance: 0,
      tyresTracks: 0,
      greasingStartups: 0,
      breakdown: 12,
    },
    productionDelayHours: 0,
    nonProductionDelayHours: 0,
    engineeringDelayHours: 12,
    totalDelayHours: 12,
    scheduledHours: 252,
    availableHours: 240,
    availabilityPercent: 95.2,
    utilizationPercent: 95.2,
  };

  const dayRows: MachineDailyOverviewRecord[] = [
    {
      machineId: 'mach-ex-01',
      machineName: 'EX-01 Liebherr 984',
      machineType: 'Excavator',
      serialNumber: 'SN-984-001',
      siteId: null,
      siteName: 'Pit North',
      date: '2026-10-10',
      dayOfMonth: 10,
      shiftType: 'day',
      startSmr: 12080,
      stopSmr: 12088,
      operatorId: null,
      operatorName: 'John',
      delays: {
        natural: 0,
        blasting: 0,
        lunches: 0,
        safetyTalks: 0,
        refueling: 0,
        noOperator: 0,
        standby: 0,
        other: 0,
        gesMaintenance: 0,
        tyresTracks: 0,
        greasingStartups: 0,
        breakdown: 6,
      },
      comment: 'Cylinder leak',
      endsOnBreakdown: false,
      hasExistingOperation: true,
    },
    {
      machineId: 'mach-ex-01',
      machineName: 'EX-01 Liebherr 984',
      machineType: 'Excavator',
      serialNumber: 'SN-984-001',
      siteId: null,
      siteName: 'Pit North',
      date: '2026-10-20',
      dayOfMonth: 20,
      shiftType: 'day',
      startSmr: 12160,
      stopSmr: 12168,
      operatorId: null,
      operatorName: 'John',
      delays: {
        natural: 0,
        blasting: 0,
        lunches: 0,
        safetyTalks: 0,
        refueling: 0,
        noOperator: 0,
        standby: 0,
        other: 0,
        gesMaintenance: 0,
        tyresTracks: 0,
        greasingStartups: 0,
        breakdown: 6,
      },
      comment: 'Hydraulic hose replacement',
      endsOnBreakdown: false,
      hasExistingOperation: true,
    },
  ];

  const engineeringLogs: EngineeringLogItem[] = [
    {
      id: 'log-1',
      date: '2026-10-10',
      shift: 'day',
      source: 'breakdown',
      machineName: 'EX-01 Liebherr 984',
      category: 'Hydraulics',
      severity: 'high',
      status: 'resolved',
      description: 'Boom cylinder leak',
      actionTaken: 'Repaired seal',
    },
    {
      id: 'log-2',
      date: '2026-10-20',
      shift: 'day',
      source: 'breakdown',
      machineName: 'EX-01 Liebherr 984',
      category: 'Hydraulics',
      severity: 'high',
      status: 'resolved',
      description: 'Hose replacement',
      actionTaken: 'Replaced hydraulic hose',
    },
  ];

  it('should accurately calculate MTBF and MTTR for a machine with breakdowns', () => {
    const metrics = computeMachinePredictiveMetrics({
      summaryRow: baseSummaryRow,
      dayRows,
      engineeringLogs,
    });

    // 240 worked hours / 2 breakdowns = 120.0h MTBF
    expect(metrics.mtbfHours).toBe(120);
    // 12 breakdown hours / 2 breakdowns = 6.0h MTTR
    expect(metrics.mttrHours).toBe(6);
    expect(metrics.breakdownCount).toBe(2);
    expect(metrics.totalBreakdownHours).toBe(12);
  });

  it('should detect when a machine is approaching its 250h standard service interval', () => {
    const metrics = computeMachinePredictiveMetrics({
      summaryRow: baseSummaryRow,
      dayRows,
      engineeringLogs,
    });

    // Closing SMR 12240 % 250 = 240 -> 10 hours until 250h service (12250)
    expect(metrics.serviceIntervalProximity.hoursToNext250Service).toBe(10);
    expect(metrics.serviceIntervalProximity.isApproaching250Service).toBe(true);
    expect(metrics.healthRiskLevel).toBe('elevated');
  });

  it('should assign low risk to a machine with zero breakdowns and far from service intervals', () => {
    const cleanSummary: MachineMonthlySummaryRow = {
      ...baseSummaryRow,
      closingSmr: 12100, // 100h into 250h cycle -> 150h remaining
      totalSmrWorked: 100,
      delays: { ...baseSummaryRow.delays, breakdown: 0 },
      engineeringDelayHours: 0,
      totalDelayHours: 0,
    };

    const metrics = computeMachinePredictiveMetrics({
      summaryRow: cleanSummary,
      dayRows: [],
      engineeringLogs: [],
    });

    expect(metrics.breakdownCount).toBe(0);
    expect(metrics.mtbfHours).toBe(100);
    expect(metrics.mttrHours).toBe(0);
    expect(metrics.serviceIntervalProximity.isApproaching250Service).toBe(false);
    expect(metrics.healthRiskLevel).toBe('low');
  });
});
