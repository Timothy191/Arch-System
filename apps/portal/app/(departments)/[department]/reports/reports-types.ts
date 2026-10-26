export interface MachineOperationLogItem {
  id: string;
  date: string;
  shift: 'day' | 'night';
  machineName: string;
  machineType: string;
  operatorName: string;
  siteName: string;
  startSmu: number | null;
  endSmu: number | null;
  hoursWorked: number;
  bcmMoved: number;
  isDozer: boolean;
  delayMinutes: number;
  productionDelayMinutes?: number;
  engineeringDelayMinutes?: number;
  naturalDelayMinutes?: number;
  nonSiteDelayMinutes?: number;
  excavatorActivity?: string;
  siteGroupRole?: 'excavator' | 'rollover' | 'site_machine';
  loadsCount?: number;
  bladePasses?: number;
  status: 'completed' | 'active';
}

export interface PdfSiteGroup {
  site: string;
  excavators: MachineOperationLogItem[];
  rollovers: MachineOperationLogItem[];
  siteMachines: MachineOperationLogItem[];
  orderedMachines: MachineOperationLogItem[];
  totalHours: number;
  totalBcm: number;
  excavatorBcm: number;
  rolloverBcm: number;
  productionDelayMin: number;
  engineeringDelayMin: number;
  naturalDelayMin: number;
  nonSiteDelayMin: number;
}

export interface ShiftReportRow {
  id: string;
  site: string;
  date: string;
  shift: 'day' | 'night';
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
  notes: string;
}

export interface EngineeringLogItem {
  id: string;
  date: string;
  shift: 'day' | 'night';
  source: 'breakdown' | 'engineering_note' | 'daily_log';
  machineName: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved';
  description: string;
  actionTaken: string;
}

export interface ShiftCoverageMissingItem {
  machineId: string;
  machineName: string;
  machineType: string;
  formPath: string;
  formLabel: string;
}

export type ReportSubtab = 'shift' | 'day' | 'archived' | 'pdf-report';

export interface PdfReportDataPayload {
  title: string;
  subtitle: string;
  kpis: Array<{ label: string; value: string }>;
  tableHeaders: string[];
  tableRows: string[][];
}

export interface ReportsDashboardClientProps {
  departmentId: string;
  departmentSlug: string;
  departmentName: string;
  isControlRoom: boolean;
  initialTab?: ReportSubtab;
  todayStr: string;
  currentShift: 'day' | 'night';
  fromDateStr: string;
  toDateStr: string;
  totalFleetCount: number;
  coveredFleetCount: number;
  missingCoverage: ShiftCoverageMissingItem[];
  shiftRows: ShiftReportRow[];
  machineOperationLogs: MachineOperationLogItem[];
  engineeringLogs: EngineeringLogItem[];
  csvContent: string;
  exportRows: Record<string, string | number>[];
  pdfReportData: PdfReportDataPayload;
  queryWarnings?: string[];
}

export interface ReportsKpiStats {
  totalHours: number;
  totalLoads: number;
  totalHaulBcm: number;
  totalDozerBcm: number;
  totalBcm: number;
  totalDelayMin: number;
  totalPasses: number;
  todayBcm: number;
  todayLoads: number;
  todayHours: number;
  openIssues: number;
  resolvedIssues: number;
  coveragePct: number;
  bcmPerHour: number;
}

export interface ShiftComparisonMetrics {
  dayBcm: number;
  nightBcm: number;
  dayLoads: number;
  nightLoads: number;
  dayHours: number;
  nightHours: number;
  dayDelays: number;
  nightDelays: number;
  dayPct: number;
  nightPct: number;
}

export interface SiteBreakdownItem {
  site: string;
  bcm: number;
  loads: number;
  hours: number;
  delays: number;
  pct: number;
  bcmPerHour: number;
}

export interface DailyAggregatedRow {
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
  siteList: string[];
  shiftCount: number;
  bcmPct: number;
  bcmPerHour: number;
}

export interface MonthlyRollupItem {
  month: string;
  shiftCount: number;
  hours: number;
  loads: number;
  haulBcm: number;
  dozerRolloverBcm: number;
  totalBcm: number;
  delayMin: number;
}

export interface ArchivedReportData {
  historicalRows: ShiftReportRow[];
  monthlyRollups: MonthlyRollupItem[];
  priorDaysRows: ShiftReportRow[];
}
