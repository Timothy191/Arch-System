export interface QuickAction {
  label: string;
  href: string;
}

export interface Department {
  name: string;
  displayName: string;
  /** Root URL path segment for this department (e.g. `/drilling`) */
  route: string;
  icon: string;
  description: string;
  color: string;
  type: "standard" | "control_room" | "satellite";
  status?: "active" | "maintenance" | "alert";
  gridSpan?: string;
  stats?: {
    label: string;
    value: string;
  };
  trend?: number[];
  actions?: QuickAction[];
}

export const DEPARTMENTS: Department[] = [
  {
    name: "overview",
    displayName: "System Overview",
    route: "/overview",
    icon: "Activity",
    description: "System topology, architectural maps & live audit compliance",
    color: "blue",
    type: "standard",
    status: "active",
    gridSpan: "md:col-span-1 xl:col-span-1",
    stats: { label: "Score", value: "100%" },
    trend: [98, 98, 99, 99, 100, 100, 100, 100],
    actions: [
      { label: "Overview", href: "/overview" },
      { label: "Audit Reports", href: "/overview?tab=audit" },
    ],
  },
  {
    name: "drilling",
    displayName: "Drilling",
    route: "/drilling",
    icon: "Drill",
    description: "Drill rig operations & bit depth telemetry",
    color: "blue",
    type: "standard",
    status: "active",
    gridSpan: "md:col-span-2 xl:col-span-1",
    stats: { label: "Depth", value: "1,240m" },
    trend: [1180, 1195, 1205, 1210, 1220, 1235, 1240, 1245],
    actions: [
      { label: "View Logs", href: "/drilling/drilling-operations" },
      { label: "Telemetry", href: "/drilling/machine-telemetry" },
    ],
  },
  {
    name: "production",
    displayName: "Production",
    route: "/production",
    icon: "Factory",
    description: "Coal yield, tonnage & extraction tracking",
    color: "emerald",
    type: "standard",
    status: "active",
    gridSpan: "md:col-span-1 xl:col-span-2",
    stats: { label: "Yield", value: "85%" },
    trend: [78, 80, 79, 82, 83, 84, 85, 86],
    actions: [
      { label: "Daily Log", href: "/production/daily-log" },
      { label: "Reports", href: "/production/reports" },
    ],
  },
  {
    name: "access-control",
    displayName: "Access Control",
    route: "/access-control",
    icon: "ShieldCheck",
    description: "Site access, badging & security",
    color: "blue",
    type: "standard",
    status: "active",
    gridSpan: "md:col-span-1 xl:col-span-1",
    stats: { label: "On-site", value: "142" },
    trend: [135, 138, 140, 139, 141, 142, 142, 143],
    actions: [
      { label: "Access Logs", href: "/access-control/access-logs" },
      { label: "Badges", href: "/access-control/badges" },
    ],
  },
  {
    name: "access-card-actions",
    displayName: "Access Card Actions",
    route: "/access-card-actions",
    icon: "CreditCard",
    description: "Manage printed badges, print cards & QR generation",
    color: "blue",
    type: "standard",
    status: "active",
    gridSpan: "md:col-span-1 xl:col-span-1",
    stats: { label: "Cards", value: "0" },
    trend: [0, 0, 0, 0, 0, 0, 0, 0],
    actions: [
      { label: "Print Cards", href: "/access-card-actions/print-cards" },
      { label: "QR Codes", href: "/access-card-actions/qr-codes" },
    ],
  },
  {
    name: "engineering",
    displayName: "Engineering",
    route: "/engineering",
    icon: "Wrench",
    description: "Equipment specs, maintenance & CAD",
    color: "violet",
    type: "standard",
    status: "active",
    gridSpan: "md:col-span-1 xl:col-span-1",
    stats: { label: "Pending", value: "12" },
    trend: [8, 10, 9, 11, 12, 11, 12, 13],
    actions: [
      { label: "Breakdowns", href: "/engineering/breakdowns" },
      { label: "Tires", href: "/engineering/tire-management" },
    ],
  },
  {
    name: "control-room",
    displayName: "Control Room",
    route: "/control-room",
    icon: "Monitor",
    description: "SCADA systems & real-time monitoring",
    color: "red",
    type: "control_room",
    status: "active",
    gridSpan: "md:col-span-2 xl:col-span-1",
    stats: { label: "Alerts", value: "0" },
    trend: [2, 1, 1, 0, 0, 0, 0, 0],
    actions: [
      { label: "Hourly Loads", href: "/control-room/hourly-loads" },
      { label: "Machine Ops", href: "/control-room/machine-operations" },
    ],
  },
  {
    name: "admin",
    displayName: "Admin",
    route: "/admin",
    icon: "ShieldCheck",
    description: "Personnel management, shift oversight & quotas",
    color: "violet",
    type: "standard",
    status: "active",
    gridSpan: "md:col-span-1 xl:col-span-1",
    stats: { label: "Employees", value: "248" },
    trend: [240, 242, 243, 245, 246, 247, 248, 249],
    actions: [
      { label: "Users", href: "/admin?tab=users" },
      { label: "Departments", href: "/admin?tab=departments" },
    ],
  },
];

export const PRODUCTIVITY_TOOLS = [
  {
    name: "tasks",
    displayName: "Tasks",
    icon: "CheckSquare",
    description: "Manage your daily to-do list",
    color: "emerald",
  },
  {
    name: "documents",
    displayName: "Documents",
    icon: "FileText",
    description: "Access shared files & templates",
    color: "blue",
  },
  {
    name: "schedule",
    displayName: "Schedule",
    icon: "Calendar",
    description: "View site-wide shift calendar",
    color: "blue",
  },
  {
    name: "calculations",
    displayName: "Calculations",
    icon: "Calculator",
    description: "Quick operational formulas",
    color: "violet",
  },
  {
    name: "notes",
    displayName: "Notes",
    icon: "StickyNote",
    description: "Personal and shared site notes",
    color: "cyan",
  },
];

export const DEPARTMENT_TABS = [
  { name: "dashboard", label: "Dashboard", icon: "BarChart2" },
  { name: "daily-log", label: "Daily Log", icon: "ClipboardList" },
  { name: "machines", label: "Machines", icon: "Cpu" },
  { name: "history", label: "History", icon: "History" },
  { name: "reports", label: "Reports", icon: "FileText" },
  { name: "tools", label: "Tools", icon: "Wrench" },
] as const;

/**
 * Control Room specific tabs - optimized for mining operations monitoring
 * with automation-focused design for operators
 * AGENT-TRACE: Removed 'operational-delays' tab as delay tracking is now integrated
 * into machine-operations page. The old operational_delays table was deprecated
 * in favor of delay_entries, which are managed within the Machine Ops interface.
 */
export const CONTROL_ROOM_TABS = [
  { name: "dashboard", label: "Dashboard", icon: "BarChart2" },
  { name: "hourly-loads", label: "Hourly Loads", icon: "Clock" },
  { name: "machine-operations", label: "Machine Ops", icon: "Cpu" },
  { name: "engineering-notes", label: "Eng Notes", icon: "ClipboardList" },
  { name: "excavator-activity", label: "Excavator", icon: "Pickaxe" },
  { name: "reports", label: "Reports", icon: "FileText" },
] as const;

export const ENGINEERING_TABS = [
  { name: "dashboard", label: "Dashboard", icon: "BarChart2" },
  { name: "breakdowns", label: "Breakdowns", icon: "AlertTriangle" },
  { name: "tire-management", label: "Tire Management", icon: "CircleDot" },
  { name: "daily-log", label: "Daily Log", icon: "ClipboardList" },
  { name: "machines", label: "Machines", icon: "Cpu" },
  { name: "history", label: "History", icon: "History" },
  { name: "reports", label: "Reports", icon: "FileText" },
  { name: "tools", label: "Tools", icon: "Wrench" },
] as const;

export const SATELLITE_MONITORING_TABS = [
  { name: "dashboard", label: "Overview", icon: "BarChart2" },
  { name: "sar", label: "SAR / InSAR", icon: "Radio" },
  { name: "hyperspectral", label: "Hyperspectral", icon: "Layers" },
  { name: "highres", label: "High-Res", icon: "ScanSearch" },
] as const;

/**
 * Drilling specific tabs - focused on rig operations and telemetry
 */
export const DRILLING_TABS = [
  { name: "dashboard", label: "Dashboard", icon: "BarChart2" },
  { name: "drilling-operations", label: "Drilling Operations", icon: "Drill" },
  { name: "machine-telemetry", label: "Machine Telemetry", icon: "Activity" },
  { name: "reports", label: "Reports", icon: "FileText" },
] as const;

/**
 * Access Control specific tabs - focused on security, badging, and site personnel
 */
export const ACCESS_CONTROL_TABS = [
  { name: "dashboard", label: "Dashboard", icon: "BarChart2" },
  { name: "access-logs", label: "Access Logs", icon: "ShieldCheck" },
  { name: "visitors", label: "Visitors", icon: "Users" },
  { name: "badges", label: "Badges", icon: "CreditCard" },
  { name: "reports", label: "Reports", icon: "FileText" },
] as const;

/**
 * Access Card Actions specific tabs - focused on badge printing and QR generation
 */
export const ACCESS_CARD_ACTIONS_TABS = [
  { name: "dashboard", label: "Dashboard", icon: "BarChart2" },
  { name: "card-actions", label: "Card Actions", icon: "CreditCard" },
  { name: "print-cards", label: "Print Cards", icon: "Printer" },
  { name: "qr-codes", label: "QR Codes", icon: "QrCode" },
  { name: "reports", label: "Reports", icon: "FileText" },
] as const;

const DEPARTMENT_TABS_MAP: Record<
  string,
  readonly { name: string; label: string; icon: string }[]
> = {
  "control-room": CONTROL_ROOM_TABS,
  "access-control": ACCESS_CONTROL_TABS,
  "access-card-actions": ACCESS_CARD_ACTIONS_TABS,
  "satellite-monitoring": SATELLITE_MONITORING_TABS,
  engineering: ENGINEERING_TABS,
  drilling: DRILLING_TABS,
};

/**
 * Get tabs for a specific department
 * AGENT-TRACE: Constant-time O(1) tab map lookup replacing 8-branch conditional ladder
 */
export function getDepartmentTabs(departmentName: string) {
  return DEPARTMENT_TABS_MAP[departmentName] ?? DEPARTMENT_TABS;
}

/**
 * Resolve the root route for a department by name or throw if unknown.
 */
export function getDepartmentRoute(departmentName: string): string {
  const dept = DEPARTMENTS.find((d) => d.name === departmentName);
  if (!dept) throw new Error(`Unknown department: ${departmentName}`);
  return dept.route;
}

/**
 * Build a department sub-route path. e.g. getDepartmentSubRoute("drilling", "machines") -> "/drilling/machines"
 */
export function getDepartmentSubRoute(departmentName: string, tab: string): string {
  return `${getDepartmentRoute(departmentName)}/${tab}`;
}

/**
 * Type-safe list of all valid department slugs for route validation.
 */
export const DEPARTMENT_SLUGS = DEPARTMENTS.map((d) => d.name) as readonly string[];

// ============================================================================
// AGENT-TRACE: Department Operational Domain Models & Telemetry Contracts
// ============================================================================

export interface DrillOperationRecord {
  id: string;
  machineId: string;
  departmentId: string;
  operationDate: string;
  openHours: number | null;
  closeHours: number | null;
  totalHours: number | null;
  holes: number;
  metersDrilled: number;
  blockDrilled: string | null;
  productionDelays: number;
  nonProductionalDelays: number;
  engineeringDelays: number;
  status: "active" | "completed" | "cancelled" | "maintenance";
}

export interface ProductionYieldRecord {
  id: string;
  dailyLogId: string;
  departmentId: string;
  logDate: string;
  shift: "day" | "night";
  coalTonnes: number;
  wasteTonnes: number;
  totalYieldPercentage?: number;
}

export interface SatelliteDeformationRecord {
  id: string;
  departmentId: string;
  satelliteName: "Sentinel-1" | "TerraSAR-X" | "Capella" | "PAZ";
  acquisitionDate: string;
  referenceDate: string;
  locationName: string;
  latitude: number;
  longitude: number;
  displacementMm: number;
  coherenceIndex: number;
  riskLevel: "none" | "minor" | "moderate" | "critical";
  cogUrl?: string | null;
}
