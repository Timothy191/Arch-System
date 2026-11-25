import { DATABASE_SCHEMA } from '../lib/data';

export type ErDomainGroupId = 'org' | 'access' | 'operations' | 'fleet' | 'telemetry';

export interface ErDomainGroupMeta {
  readonly id: ErDomainGroupId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly accentVar: string;
  readonly colIndex: number;
}

export interface ErTableNode {
  readonly name: string;
  readonly rls: boolean;
  readonly columns: readonly string[];
  readonly description: string;
  readonly domainGroup: ErDomainGroupId;
  readonly colIndex: number;
  readonly rowIndex: number;
}

export interface ErRelationshipEdge {
  readonly id: string;
  readonly sourceTable: string;
  readonly targetTable: string;
  readonly fkColumn: string;
  readonly cardinality: '1:N' | '1:1';
  readonly description: string;
}

export const ER_CANVAS_LEFT_PAD = 24;
export const ER_CANVAS_TOP_PAD = 68;
export const ER_COL_WIDTH = 232;
export const ER_COL_GAP = 36;
export const ER_ROW_HEIGHT = 122;
export const ER_ROW_GAP = 34;
export const ER_MAX_ROW_COUNT = 9;
export const ER_CANVAS_WIDTH = ER_CANVAS_LEFT_PAD * 2 + 5 * ER_COL_WIDTH + 4 * ER_COL_GAP;
export const ER_CANVAS_HEIGHT =
  ER_CANVAS_TOP_PAD + ER_MAX_ROW_COUNT * ER_ROW_HEIGHT + (ER_MAX_ROW_COUNT - 1) * ER_ROW_GAP + 28;

export const ER_DOMAIN_GROUPS: readonly ErDomainGroupMeta[] = [
  {
    id: 'org',
    label: 'Core Org & Auth',
    shortLabel: 'Org & Auth',
    description: 'Department RBAC boundaries, employee auth principals, and compliance registry',
    accentVar: 'var(--accent-green)',
    colIndex: 0,
  },
  {
    id: 'access',
    label: 'Access Control & Gate',
    shortLabel: 'Access & Gate',
    description: 'Turnstile muster logs, RFID badges, contractor visitors, and CR80 card printing',
    accentVar: 'var(--accent-blue)',
    colIndex: 1,
  },
  {
    id: 'operations',
    label: 'Operations & Daily Logs',
    shortLabel: 'Operations',
    description: 'Shift daily logs, production targets, delay entries, and excavator-truck loads',
    accentVar: 'var(--accent-amber)',
    colIndex: 2,
  },
  {
    id: 'fleet',
    label: 'Engineering Fleet & Tires',
    shortLabel: 'Fleet & Tires',
    description:
      'Machinery registry, SMR operations, breakdowns, haul tires, and tread inspections',
    accentVar: 'var(--accent-blue)',
    colIndex: 3,
  },
  {
    id: 'telemetry',
    label: 'Telemetry & Audit',
    shortLabel: 'Telemetry & Audit',
    description:
      'SMR odometer streams, monthly rollups, SCADA PLC tags, and immutable audit trails',
    accentVar: 'var(--accent-red)',
    colIndex: 4,
  },
];

interface ErTablePlacement {
  readonly domainGroup: ErDomainGroupId;
  readonly colIndex: number;
  readonly rowIndex: number;
}

const ER_TABLE_PLACEMENTS: Readonly<Record<string, ErTablePlacement>> = {
  departments: { domainGroup: 'org', colIndex: 0, rowIndex: 0 },
  employees: { domainGroup: 'org', colIndex: 0, rowIndex: 1 },
  personnel: { domainGroup: 'org', colIndex: 0, rowIndex: 2 },
  sites: { domainGroup: 'org', colIndex: 0, rowIndex: 3 },
  mine_blocks: { domainGroup: 'org', colIndex: 0, rowIndex: 4 },
  operators: { domainGroup: 'org', colIndex: 0, rowIndex: 5 },
  material_density: { domainGroup: 'org', colIndex: 0, rowIndex: 6 },
  delay_categories: { domainGroup: 'org', colIndex: 0, rowIndex: 7 },
  visitors: { domainGroup: 'access', colIndex: 1, rowIndex: 0 },
  card_print_jobs: { domainGroup: 'access', colIndex: 1, rowIndex: 1 },
  badges: { domainGroup: 'access', colIndex: 1, rowIndex: 2 },
  access_logs: { domainGroup: 'access', colIndex: 1, rowIndex: 3 },
  muster_events: { domainGroup: 'access', colIndex: 1, rowIndex: 4 },
  daily_logs: { domainGroup: 'operations', colIndex: 2, rowIndex: 0 },
  production_monthly_targets: { domainGroup: 'operations', colIndex: 2, rowIndex: 1 },
  delay_entries: { domainGroup: 'operations', colIndex: 2, rowIndex: 2 },
  hourly_loads: { domainGroup: 'operations', colIndex: 2, rowIndex: 3 },
  production_logs: { domainGroup: 'operations', colIndex: 2, rowIndex: 4 },
  excavator_activity: { domainGroup: 'operations', colIndex: 2, rowIndex: 5 },
  drill_operations: { domainGroup: 'operations', colIndex: 2, rowIndex: 6 },
  plant_hourly_logs: { domainGroup: 'operations', colIndex: 2, rowIndex: 7 },
  plant_delays: { domainGroup: 'operations', colIndex: 2, rowIndex: 8 },
  machines: { domainGroup: 'fleet', colIndex: 3, rowIndex: 0 },
  breakdowns: { domainGroup: 'fleet', colIndex: 3, rowIndex: 1 },
  machine_operations: { domainGroup: 'fleet', colIndex: 3, rowIndex: 2 },
  tires: { domainGroup: 'fleet', colIndex: 3, rowIndex: 3 },
  tire_inspections: { domainGroup: 'fleet', colIndex: 3, rowIndex: 4 },
  engineering_notes: { domainGroup: 'fleet', colIndex: 3, rowIndex: 5 },
  plant_inventory_items: { domainGroup: 'fleet', colIndex: 3, rowIndex: 6 },
  plant_inventory_usage: { domainGroup: 'fleet', colIndex: 3, rowIndex: 7 },
  audit_logs: { domainGroup: 'telemetry', colIndex: 4, rowIndex: 0 },
  smr_readings: { domainGroup: 'telemetry', colIndex: 4, rowIndex: 1 },
  monthly_machine_snapshots: { domainGroup: 'telemetry', colIndex: 4, rowIndex: 2 },
  scada_telemetry_records: { domainGroup: 'telemetry', colIndex: 4, rowIndex: 3 },
  shift_status: { domainGroup: 'telemetry', colIndex: 4, rowIndex: 4 },
  system_logs: { domainGroup: 'telemetry', colIndex: 4, rowIndex: 5 },
};

const SUPPLEMENTAL_SCHEMA_TABLES: readonly Omit<
  ErTableNode,
  'domainGroup' | 'colIndex' | 'rowIndex'
>[] = [
  {
    name: 'visitors',
    rls: true,
    columns: [
      'id (UUID PK)',
      'department_id (FK)',
      'host_id (FK)',
      'name (text)',
      'company (text)',
      'check_in_time',
      'check_out_time',
      'status',
    ],
    description:
      'Contractor and site visitor induction registry with host sign-off and gate check-in timestamps',
  },
  {
    name: 'tires',
    rls: true,
    columns: [
      'id (UUID PK)',
      'machine_id (FK)',
      'serial_number (text)',
      'brand (text)',
      'size (text)',
      'position (text)',
      'installed_hours (numeric)',
      'status',
    ],
    description:
      'Heavy haul-truck and earthmover tire asset lifecycle tracked per wheel position and SMR hours',
  },
  {
    name: 'tire_inspections',
    rls: true,
    columns: [
      'id (UUID PK)',
      'tire_id (FK)',
      'machine_operation_id (FK)',
      'pressure_psi (numeric)',
      'tread_depth_mm (numeric)',
      'condition_status',
      'inspection_date',
    ],
    description:
      'Shift-level tire pressure, tread wear, and safety condition audits linked to machine operations',
  },
];

function buildErTables(): readonly ErTableNode[] {
  const existingNames = new Set(DATABASE_SCHEMA.map((table) => table.name));
  const combinedTables = [
    ...DATABASE_SCHEMA,
    ...SUPPLEMENTAL_SCHEMA_TABLES.filter((table) => !existingNames.has(table.name)),
  ];

  return combinedTables.map((table) => {
    const placement = ER_TABLE_PLACEMENTS[table.name] ?? {
      domainGroup: 'telemetry' as const,
      colIndex: 4,
      rowIndex: 4,
    };
    return {
      ...table,
      domainGroup: placement.domainGroup,
      colIndex: placement.colIndex,
      rowIndex: placement.rowIndex,
    };
  });
}

export const ER_TABLES: readonly ErTableNode[] = buildErTables();

export const ER_RELATIONSHIPS: readonly ErRelationshipEdge[] = [
  {
    id: 'fk-employees-department',
    sourceTable: 'departments',
    targetTable: 'employees',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Each department owns primary employee RBAC assignments',
  },
  {
    id: 'fk-visitors-department',
    sourceTable: 'departments',
    targetTable: 'visitors',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Visitors check into an authorized operational department',
  },
  {
    id: 'fk-daily-logs-department',
    sourceTable: 'departments',
    targetTable: 'daily_logs',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Shift daily logs are partitioned by department RLS scope',
  },
  {
    id: 'fk-machines-department',
    sourceTable: 'departments',
    targetTable: 'machines',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Fleet machinery is allocated to owning operational departments',
  },
  {
    id: 'fk-breakdowns-department',
    sourceTable: 'departments',
    targetTable: 'breakdowns',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Breakdowns dispatch to Engineering while sharing 12h shift delays',
  },
  {
    id: 'fk-delay-entries-department',
    sourceTable: 'departments',
    targetTable: 'delay_entries',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Delay logs enforce department-level RLS isolation',
  },
  {
    id: 'fk-access-logs-department',
    sourceTable: 'departments',
    targetTable: 'access_logs',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Gate muster scans associate personnel with destination departments',
  },
  {
    id: 'fk-employees-visitors',
    sourceTable: 'employees',
    targetTable: 'visitors',
    fkColumn: 'host_id',
    cardinality: '1:N',
    description: 'Authorized employees sponsor site contractor and visitor entries',
  },
  {
    id: 'fk-employees-card-print',
    sourceTable: 'employees',
    targetTable: 'card_print_jobs',
    fkColumn: 'employee_id',
    cardinality: '1:N',
    description: 'CR80 badge print spooler jobs track employee issuance requests',
  },
  {
    id: 'fk-employees-daily-logs',
    sourceTable: 'employees',
    targetTable: 'daily_logs',
    fkColumn: 'created_by',
    cardinality: '1:N',
    description: 'Operators and supervisors sign immutable shift logs',
  },
  {
    id: 'fk-employees-targets',
    sourceTable: 'employees',
    targetTable: 'production_monthly_targets',
    fkColumn: 'updated_by',
    cardinality: '1:N',
    description: 'Authorized planners maintain monthly coal & waste BCM targets',
  },
  {
    id: 'fk-employees-audit-logs',
    sourceTable: 'employees',
    targetTable: 'audit_logs',
    fkColumn: 'user_id',
    cardinality: '1:N',
    description: 'Every server mutation writes an actor-attributed audit record',
  },
  {
    id: 'fk-employees-smr-readings',
    sourceTable: 'employees',
    targetTable: 'smr_readings',
    fkColumn: 'recorded_by',
    cardinality: '1:N',
    description: 'Control Room operators stamp monotonic SMR odometer readings',
  },
  {
    id: 'fk-personnel-badges',
    sourceTable: 'personnel',
    targetTable: 'badges',
    fkColumn: 'personnel_id',
    cardinality: '1:N',
    description: 'Site personnel hold active QR/RFID turnstile credentials',
  },
  {
    id: 'fk-badges-access-logs',
    sourceTable: 'badges',
    targetTable: 'access_logs',
    fkColumn: 'badge_id',
    cardinality: '1:N',
    description: 'Chainway C66 scans resolve physical badges into muster logs',
  },
  {
    id: 'fk-personnel-machine-ops',
    sourceTable: 'personnel',
    targetTable: 'machine_operations',
    fkColumn: 'operator_id',
    cardinality: '1:N',
    description: 'Certified operators are linked to shift machine operation logs',
  },
  {
    id: 'fk-machines-breakdowns',
    sourceTable: 'machines',
    targetTable: 'breakdowns',
    fkColumn: 'fleet_id',
    cardinality: '1:N',
    description: 'Equipment breakdown tickets reference fleet asset IDs',
  },
  {
    id: 'fk-machines-operations',
    sourceTable: 'machines',
    targetTable: 'machine_operations',
    fkColumn: 'machine_id',
    cardinality: '1:N',
    description: 'Shift SMR hours and diesel burn roll up per machine',
  },
  {
    id: 'fk-machines-delay-entries',
    sourceTable: 'machines',
    targetTable: 'delay_entries',
    fkColumn: 'machine_id',
    cardinality: '1:N',
    description: 'Downtime reasons attribute lost hours to specific fleet units',
  },
  {
    id: 'fk-machines-hourly-loads',
    sourceTable: 'machines',
    targetTable: 'hourly_loads',
    fkColumn: 'excavator_id / truck_id',
    cardinality: '1:N',
    description: 'Excavator-to-truck payload cycles join both fleet assets',
  },
  {
    id: 'fk-machines-snapshots',
    sourceTable: 'machines',
    targetTable: 'monthly_machine_snapshots',
    fkColumn: 'machine_id',
    cardinality: '1:N',
    description: 'Monthly availability, utilization & MTBF snapshots per machine',
  },
  {
    id: 'fk-machines-tires',
    sourceTable: 'machines',
    targetTable: 'tires',
    fkColumn: 'machine_id',
    cardinality: '1:N',
    description: 'Haul fleet tires mount to active machine wheel positions',
  },
  {
    id: 'fk-tires-inspections',
    sourceTable: 'tires',
    targetTable: 'tire_inspections',
    fkColumn: 'tire_id',
    cardinality: '1:N',
    description: 'Pressure and tread depth inspections monitor each tire asset',
  },
  {
    id: 'fk-machine-ops-tire-inspections',
    sourceTable: 'machine_operations',
    targetTable: 'tire_inspections',
    fkColumn: 'machine_operation_id',
    cardinality: '1:N',
    description: 'Tire inspections bind to the active shift SMR operation record',
  },
  {
    id: 'fk-sites-mine-blocks',
    sourceTable: 'sites',
    targetTable: 'mine_blocks',
    fkColumn: 'site_id',
    cardinality: '1:N',
    description: 'Mining sites partition into active excavation blocks and benches',
  },
  {
    id: 'fk-sites-machines',
    sourceTable: 'sites',
    targetTable: 'machines',
    fkColumn: 'site_id',
    cardinality: '1:N',
    description: 'Machinery assets are stationed at an active mining site',
  },
  {
    id: 'fk-machines-drill-ops',
    sourceTable: 'machines',
    targetTable: 'drill_operations',
    fkColumn: 'machine_id',
    cardinality: '1:N',
    description: 'Drill rigs log shift hole counts and penetrated meters',
  },
  {
    id: 'fk-machines-excavator-activity',
    sourceTable: 'machines',
    targetTable: 'excavator_activity',
    fkColumn: 'machine_id',
    cardinality: '1:N',
    description: 'Excavator shifts link pit location, material, and SMR odometer',
  },
  {
    id: 'fk-mine-blocks-excavator-activity',
    sourceTable: 'mine_blocks',
    targetTable: 'excavator_activity',
    fkColumn: 'block_mined_id',
    cardinality: '1:N',
    description: 'Excavation shifts attribute loads to active pit blocks',
  },
  {
    id: 'fk-operators-excavator-activity',
    sourceTable: 'operators',
    targetTable: 'excavator_activity',
    fkColumn: 'operator_id',
    cardinality: '1:N',
    description: 'Certified operators are assigned to shift excavator activity',
  },
  {
    id: 'fk-daily-logs-production-logs',
    sourceTable: 'daily_logs',
    targetTable: 'production_logs',
    fkColumn: 'daily_log_id',
    cardinality: '1:N',
    description: 'Daily closeouts anchor verified coal and waste extraction tonnes',
  },
  {
    id: 'fk-departments-plant-hourly',
    sourceTable: 'departments',
    targetTable: 'plant_hourly_logs',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'CHPP wash plant hourly logs isolate by department scope',
  },
  {
    id: 'fk-departments-plant-delays',
    sourceTable: 'departments',
    targetTable: 'plant_delays',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Wash plant circuit delays isolate by department scope',
  },
  {
    id: 'fk-inventory-items-usage',
    sourceTable: 'plant_inventory_items',
    targetTable: 'plant_inventory_usage',
    fkColumn: 'item_id',
    cardinality: '1:N',
    description: 'Consumable stock deductions append to inventory usage history',
  },
  {
    id: 'fk-departments-shift-status',
    sourceTable: 'departments',
    targetTable: 'shift_status',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Department closeout workflows lock completed shifts monotonically',
  },
  {
    id: 'fk-machines-engineering-notes',
    sourceTable: 'machines',
    targetTable: 'engineering_notes',
    fkColumn: 'machine_id',
    cardinality: '1:N',
    description: 'Control Room handover defects target specific fleet machines',
  },
  {
    id: 'fk-personnel-muster-events',
    sourceTable: 'personnel',
    targetTable: 'muster_events',
    fkColumn: 'personnel_id',
    cardinality: '1:N',
    description: 'On-site muster roll calls track verified site personnel',
  },
  {
    id: 'fk-departments-system-logs',
    sourceTable: 'departments',
    targetTable: 'system_logs',
    fkColumn: 'department_id',
    cardinality: '1:N',
    description: 'Portal trace and runtime error logs record department scope',
  },
];

export interface ErBoxCoordinates {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function getErTableBoxPosition(table: ErTableNode): ErBoxCoordinates {
  return {
    x: ER_CANVAS_LEFT_PAD + table.colIndex * (ER_COL_WIDTH + ER_COL_GAP),
    y: ER_CANVAS_TOP_PAD + table.rowIndex * (ER_ROW_HEIGHT + ER_ROW_GAP),
    width: ER_COL_WIDTH,
    height: ER_ROW_HEIGHT,
  };
}

export interface ErEdgeGeometry {
  readonly pathD: string;
  readonly labelX: number;
  readonly labelY: number;
}

export function computeErEdgeGeometry(options: {
  readonly sourceTable: ErTableNode;
  readonly targetTable: ErTableNode;
  readonly edgeIndex: number;
}): ErEdgeGeometry {
  const { sourceTable, targetTable, edgeIndex } = options;
  const src = getErTableBoxPosition(sourceTable);
  const tgt = getErTableBoxPosition(targetTable);
  const laneSpread = ((edgeIndex % 5) - 2) * 8;

  if (sourceTable.colIndex === targetTable.colIndex) {
    const isAdjacentDown = targetTable.rowIndex === sourceTable.rowIndex + 1;
    if (isAdjacentDown) {
      const startX = src.x + src.width * 0.5;
      const startY = src.y + src.height;
      const endX = tgt.x + tgt.width * 0.5;
      const endY = tgt.y;
      return {
        pathD: `M ${startX} ${startY} L ${endX} ${endY}`,
        labelX: startX,
        labelY: (startY + endY) / 2,
      };
    }

    const sideDirection = sourceTable.colIndex >= 3 ? 1 : -1;
    const gutterOffset = 22 + (edgeIndex % 3) * 8;
    const startX = sideDirection > 0 ? src.x + src.width : src.x;
    const startY = src.y + src.height * 0.55;
    const endX = sideDirection > 0 ? tgt.x + tgt.width : tgt.x;
    const endY = tgt.y + tgt.height * 0.45;
    const ctrlX = startX + sideDirection * gutterOffset;
    return {
      pathD: `M ${startX} ${startY} C ${ctrlX} ${startY}, ${ctrlX} ${endY}, ${endX} ${endY}`,
      labelX: ctrlX - sideDirection * 4,
      labelY: (startY + endY) / 2,
    };
  }

  const goesRight = targetTable.colIndex > sourceTable.colIndex;
  const colDelta = Math.abs(targetTable.colIndex - sourceTable.colIndex);

  if (colDelta > 1 && sourceTable.rowIndex === targetTable.rowIndex) {
    const archY = Math.min(src.y, tgt.y) - (24 + (colDelta - 1) * 14);
    const startX = src.x + src.width * 0.5;
    const startY = src.y;
    const endX = tgt.x + tgt.width * 0.5;
    const endY = tgt.y;
    return {
      pathD: `M ${startX} ${startY} C ${startX} ${archY}, ${endX} ${archY}, ${endX} ${endY}`,
      labelX: (startX + endX) / 2,
      labelY: archY + 8,
    };
  }

  const startX = goesRight ? src.x + src.width : src.x;
  const startY = src.y + src.height * 0.5 + laneSpread * 0.5;
  const endX = goesRight ? tgt.x : tgt.x + tgt.width;
  const endY = tgt.y + tgt.height * 0.5 - laneSpread * 0.5;
  const horizontalGap = Math.abs(endX - startX);
  const curveSpan = Math.max(44, horizontalGap * 0.46);
  const ctrl1X = goesRight ? startX + curveSpan : startX - curveSpan;
  const ctrl2X = goesRight ? endX - curveSpan : endX + curveSpan;

  return {
    pathD: `M ${startX} ${startY} C ${ctrl1X} ${startY}, ${ctrl2X} ${endY}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 + laneSpread * 0.4,
  };
}
