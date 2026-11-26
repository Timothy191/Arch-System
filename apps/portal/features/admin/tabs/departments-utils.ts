export interface DepartmentRecord {
  readonly id: string;
  readonly name: string;
  readonly display_name: string | null;
  readonly description?: string | null;
  readonly color?: string | null;
  readonly icon?: string | null;
  readonly created_at?: string | null;
}

export interface SiteRecord {
  readonly id: string;
  readonly name: string;
  readonly site_code: string;
  readonly active: boolean;
  readonly created_at?: string | null;
}

export interface MineBlockRecord {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly site_id: string | null;
  readonly active: boolean;
}

export interface DepartmentEmployeeRecord {
  readonly id: string;
  readonly full_name: string;
  readonly role: string;
  readonly job_title?: string | null;
  readonly department_id?: string | null;
  readonly accessible_departments?: readonly string[] | null;
  readonly areas?: readonly string[] | null;
}

export interface DepartmentAccessRecord {
  readonly department_id: string;
  readonly employee_id: string;
  readonly access_level: string;
}

export interface DepartmentMachineRecord {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly active: boolean;
  readonly department_id: string;
  readonly site_id: string | null;
  readonly starting_smr?: number | null;
}

export interface DepartmentBreakdownRecord {
  readonly id: string;
  readonly department_id: string;
  readonly status: string;
  readonly site_code?: string | null;
  readonly date_in?: string | null;
  readonly delay_hours?: number | null;
}

export interface DepartmentDailyLogRecord {
  readonly id: string;
  readonly department_id: string;
  readonly log_date: string;
  readonly shift: string;
}

export interface DepartmentSiteDetail {
  readonly site: SiteRecord;
  readonly mineBlocks: readonly MineBlockRecord[];
  readonly departmentMachineCount: number;
  readonly totalMachinesAtSite: number;
}

export interface DepartmentPersonnelSummary {
  readonly id: string;
  readonly fullName: string;
  readonly roleLabel: string;
}

export interface DepartmentMetrics {
  readonly departmentId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly summaryDescription: string;
  readonly employeeCount: number;
  readonly operateAccessCount: number;
  readonly readOnlyAccessCount: number;
  readonly samplePersonnel: readonly DepartmentPersonnelSummary[];
  readonly totalMachines: number;
  readonly activeMachines: number;
  readonly totalStartingSmr: number;
  readonly openBreakdowns: number;
  readonly totalBreakdownDelayHours: number;
  readonly recentShiftLogsCount: number;
  readonly latestLogDate: string | null;
  readonly siteCoverageMode: 'direct' | 'cross-site';
  readonly sites: readonly DepartmentSiteDetail[];
}

export interface DepartmentsOverview {
  readonly totalDepartments: number;
  readonly totalSites: number;
  readonly activeSites: number;
  readonly totalBlocks: number;
  readonly activeBlocks: number;
  readonly totalEmployees: number;
  readonly totalMachines: number;
  readonly activeMachines: number;
  readonly openBreakdowns: number;
  readonly totalShiftLogs: number;
}

const MAX_PERSONNEL_PREVIEW = 4;
const FALLBACK_DESCRIPTION =
  'Operational mining portal division managing site permissions, workforce assignments, and telemetry.';

const DEPARTMENT_DEFAULT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'access-card-actions':
    'Credential issuance, badge printing, QR verification, and gate access audit actions across sites.',
  'access-control':
    'Security perimeter logs, site entry screening, induction validity, and contractor gate compliance.',
  admin:
    'Enterprise portal governance, user permissions, fleet registry, site topology, and system configuration.',
  'availability-and-utilization':
    'Equipment readiness ratios, scheduled vs. operating runtime telemetry, and downtime attribution.',
  'control-room':
    '24/7 dispatch coordination, live hourly load tracking, machine SMR logs, and shift closeout workflows.',
  database:
    'PostgreSQL telemetry store administration, schema governance, and audit log observability.',
  drilling:
    'Blast-hole pattern drilling progress, penetration rates, rig utilization, and block readiness.',
  engineering:
    'Workshop maintenance lifecycle, open breakdown remediation, MTTR tracking, and parts readiness.',
  office:
    'Site administration, head-office reporting, compliance documentation, and executive coordination.',
  'plant-inventory':
    'Wash-plant stockpiles, reagent consumables, spare parts custody, and stock-take verification.',
  'plant-processing':
    'Crushing circuit throughput, feed rates, wash-plant yields, and plant stoppage monitoring.',
  presentation:
    'Executive boardroom briefings, KPI scorecards, and cross-pit operational summaries.',
  production:
    'Primary haulage, overburden stripping, ROM coal extraction, and pit fleet deployment.',
};

function matchesDepartmentEmployee(
  employee: DepartmentEmployeeRecord,
  departmentId: string,
  slugLower: string,
  displayNameLower: string,
  explicitGrantIds: ReadonlySet<string>
): boolean {
  if (explicitGrantIds.has(employee.id)) return true;
  if (employee.department_id === departmentId) return true;

  const accessible = (employee.accessible_departments ?? []).map((entry) => entry.toLowerCase());
  if (accessible.includes(slugLower) || accessible.includes(displayNameLower)) return true;

  const areas = (employee.areas ?? []).map((entry) => entry.toLowerCase());
  return areas.includes(slugLower) || areas.includes(displayNameLower);
}

export function buildDepartmentMetrics(options: {
  readonly department: DepartmentRecord;
  readonly sites: readonly SiteRecord[];
  readonly mineBlocks: readonly MineBlockRecord[];
  readonly employees: readonly DepartmentEmployeeRecord[];
  readonly accessGrants: readonly DepartmentAccessRecord[];
  readonly machines: readonly DepartmentMachineRecord[];
  readonly breakdowns: readonly DepartmentBreakdownRecord[];
  readonly dailyLogs: readonly DepartmentDailyLogRecord[];
  readonly exactShiftLogsCount?: number;
}): DepartmentMetrics {
  const {
    department,
    sites,
    mineBlocks,
    employees,
    accessGrants,
    machines,
    breakdowns,
    dailyLogs,
    exactShiftLogsCount,
  } = options;

  const slug = department.name.trim();
  const slugLower = slug.toLowerCase();
  const displayName = (department.display_name ?? department.name).trim();
  const displayNameLower = displayName.toLowerCase();

  const deptGrants = accessGrants.filter((grant) => grant.department_id === department.id);
  const explicitGrantIds = new Set(deptGrants.map((grant) => grant.employee_id));
  const operateAccessCount = deptGrants.filter((grant) => grant.access_level === 'operate').length;
  const readOnlyAccessCount = deptGrants.filter((grant) => grant.access_level !== 'operate').length;

  const matchedEmployees = employees.filter((employee) =>
    matchesDepartmentEmployee(
      employee,
      department.id,
      slugLower,
      displayNameLower,
      explicitGrantIds
    )
  );

  const samplePersonnel: DepartmentPersonnelSummary[] = matchedEmployees
    .slice(0, MAX_PERSONNEL_PREVIEW)
    .map((employee) => ({
      id: employee.id,
      fullName: employee.full_name,
      roleLabel: employee.job_title?.trim() || employee.role || 'Operator',
    }));

  const deptMachines = machines.filter((machine) => machine.department_id === department.id);
  const activeMachines = deptMachines.filter((machine) => machine.active).length;
  const totalStartingSmr = Math.round(
    deptMachines.reduce((sum, machine) => sum + Number(machine.starting_smr ?? 0), 0)
  );

  const deptBreakdowns = breakdowns.filter((bd) => bd.department_id === department.id);
  const openBreakdowns = deptBreakdowns.filter(
    (bd) => bd.status === 'open' || bd.status === 'in_progress'
  ).length;
  const totalBreakdownDelayHours =
    Math.round(deptBreakdowns.reduce((sum, bd) => sum + Number(bd.delay_hours ?? 0), 0) * 10) / 10;

  const deptLogs = dailyLogs.filter((log) => log.department_id === department.id);
  const latestLogDate =
    deptLogs
      .map((log) => log.log_date)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const directSiteIds = new Set<string>();
  const directSiteCodes = new Set<string>();
  for (const machine of deptMachines) {
    if (machine.site_id) directSiteIds.add(machine.site_id);
  }
  for (const bd of deptBreakdowns) {
    if (bd.site_code) directSiteCodes.add(bd.site_code.toLowerCase());
  }

  const directMatchedSites = sites.filter(
    (site) => directSiteIds.has(site.id) || directSiteCodes.has(site.site_code.toLowerCase())
  );

  const hasDirectSiteCoverage = directMatchedSites.length > 0;
  const activeSitesOnly = sites.filter((site) => site.active);
  const effectiveSites = hasDirectSiteCoverage
    ? directMatchedSites
    : activeSitesOnly.length > 0
      ? activeSitesOnly
      : sites;

  const siteDetails: DepartmentSiteDetail[] = effectiveSites.map((site) => ({
    site,
    mineBlocks: mineBlocks.filter((block) => block.site_id === site.id),
    departmentMachineCount: deptMachines.filter((machine) => machine.site_id === site.id).length,
    totalMachinesAtSite: machines.filter((machine) => machine.site_id === site.id).length,
  }));

  const explicitDescription = department.description?.trim();
  const summaryDescription =
    explicitDescription || DEPARTMENT_DEFAULT_DESCRIPTIONS[slugLower] || FALLBACK_DESCRIPTION;

  return {
    departmentId: department.id,
    slug,
    displayName,
    summaryDescription,
    employeeCount: matchedEmployees.length,
    operateAccessCount,
    readOnlyAccessCount,
    samplePersonnel,
    totalMachines: deptMachines.length,
    activeMachines,
    totalStartingSmr,
    openBreakdowns,
    totalBreakdownDelayHours,
    recentShiftLogsCount: exactShiftLogsCount ?? deptLogs.length,
    latestLogDate,
    siteCoverageMode: hasDirectSiteCoverage ? 'direct' : 'cross-site',
    sites: siteDetails,
  };
}

export function computeDepartmentsOverview(options: {
  readonly departments: readonly DepartmentRecord[];
  readonly sites: readonly SiteRecord[];
  readonly mineBlocks: readonly MineBlockRecord[];
  readonly employees: readonly DepartmentEmployeeRecord[];
  readonly machines: readonly DepartmentMachineRecord[];
  readonly breakdowns: readonly DepartmentBreakdownRecord[];
  readonly dailyLogs: readonly DepartmentDailyLogRecord[];
  readonly exactTotalShiftLogs?: number;
}): DepartmentsOverview {
  const {
    departments,
    sites,
    mineBlocks,
    employees,
    machines,
    breakdowns,
    dailyLogs,
    exactTotalShiftLogs,
  } = options;

  return {
    totalDepartments: departments.length,
    totalSites: sites.length,
    activeSites: sites.filter((site) => site.active).length,
    totalBlocks: mineBlocks.length,
    activeBlocks: mineBlocks.filter((block) => block.active).length,
    totalEmployees: employees.length,
    totalMachines: machines.length,
    activeMachines: machines.filter((machine) => machine.active).length,
    openBreakdowns: breakdowns.filter((bd) => bd.status === 'open' || bd.status === 'in_progress')
      .length,
    totalShiftLogs: exactTotalShiftLogs ?? dailyLogs.length,
  };
}
