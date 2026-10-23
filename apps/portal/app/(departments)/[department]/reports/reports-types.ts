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
