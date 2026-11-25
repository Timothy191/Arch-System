import { createReadReplicaClient } from '@repo/supabase/read-replica';

export interface RecentMigrationEntry {
  readonly id: string;
  readonly file: string;
  readonly scope: string;
  readonly summary: string;
}

export interface DepartmentDataRequirement {
  readonly departmentSlug: string;
  readonly departmentName: string;
  readonly departmentHref: string;
  readonly manageHref: string;
  readonly manageLabel: string;
  readonly summary: string;
  readonly masterTables: readonly string[];
  readonly operationalTables: readonly string[];
}

export interface DepartmentReadinessReport {
  readonly requirement: DepartmentDataRequirement;
  readonly status: 'ready' | 'attention' | 'standby';
  readonly emptyMasterTables: readonly string[];
  readonly populatedTableCount: number;
  readonly totalRequiredTables: number;
  readonly totalRows: number;
}

export interface DepartmentReadinessSummary {
  readonly reports: readonly DepartmentReadinessReport[];
  readonly readyDepartmentsCount: number;
  readonly attentionDepartmentsCount: number;
  readonly populatedTablesCount: number;
  readonly totalTrackedTables: number;
}

export interface DatabaseTableCountsResult {
  readonly rowCounts: Readonly<Record<string, number | null>>;
  readonly isLiveConnected: boolean;
  readonly totalLiveRows: number;
}

export interface MasterReferenceSnapshot {
  readonly isLiveConnected: boolean;
  readonly activeSites: readonly { readonly name: string; readonly siteCode: string }[];
  readonly mineBlocksCount: number;
  readonly mineBlockNames: readonly string[];
  readonly totalMachines: number;
  readonly activeMachines: number;
  readonly machineTypesSummary: readonly string[];
  readonly operatorsCount: number;
  readonly delayCategories: readonly string[];
  readonly materialDensities: readonly {
    readonly materialType: string;
    readonly densityFactor: number;
  }[];
  readonly monthlyTargetsCount: number;
  readonly latestTargetMonth: string | null;
  readonly plantInventoryItemsCount: number;
  readonly tiresCount: number;
  readonly cardPrintersCount: number;
  readonly cardTemplatesCount: number;
}

const PREVIEW_NAMES_LIMIT = 6;

export const DATABASE_MIGRATION_SUMMARY: {
  readonly latestMigrationNumber: number;
  readonly totalMigrationFiles: number;
  readonly latestMigrationFile: string;
  readonly recentMigrations: readonly RecentMigrationEntry[];
} = {
  latestMigrationNumber: 229,
  totalMigrationFiles: 179,
  latestMigrationFile: '229_enrich_fleet_machines_metadata.sql',
  recentMigrations: [
    {
      id: '229',
      file: '229_enrich_fleet_machines_metadata.sql',
      scope: 'Engineering Fleet',
      summary: 'Enriched fleet machine metadata, serial numbers, models, and asset images',
    },
    {
      id: '228',
      file: '228_add_employee_profile_fields.sql',
      scope: 'Org & Auth',
      summary: 'Added extended employee profile columns for cross-department provisioning',
    },
    {
      id: '227',
      file: '227_add_presentation_department.sql',
      scope: 'Departments Registry',
      summary: 'Registered dedicated Presentation department RBAC scope and navigation routes',
    },
    {
      id: '226',
      file: '226_quality_intelligence_engine.sql',
      scope: 'Quality & Integrity',
      summary:
        'Added quality release certifications, compliance audit runs, and shift completeness tables',
    },
    {
      id: '224',
      file: '224_control_room_security_hardening.sql',
      scope: 'Control Room Security',
      summary: 'Tightened Control Room RLS InitPlan guards and shift report execution policies',
    },
    {
      id: '220',
      file: '220_fix_access_control_perpetual_badge_metrics.sql',
      scope: 'Access Control',
      summary: 'Repaired perpetual QR/RFID badge validity metrics and muster expiry queries',
    },
  ],
};

export const DEPARTMENT_DATA_REQUIREMENTS: readonly DepartmentDataRequirement[] = [
  {
    departmentSlug: 'admin',
    departmentName: 'Administration',
    departmentHref: '/admin',
    manageHref: '/admin?tab=sites',
    manageLabel: 'Manage in Admin',
    summary: 'Sites, blocks, employee RBAC access matrix, webhooks, and audit logs',
    masterTables: ['departments', 'employees', 'sites', 'mine_blocks', 'roles'],
    operationalTables: [
      'employee_department_access',
      'webhook_endpoints',
      'audit_logs',
      'system_logs',
    ],
  },
  {
    departmentSlug: 'control-room',
    departmentName: 'Control Room',
    departmentHref: '/control-room',
    manageHref: '/control-room',
    manageLabel: 'Open Control Room',
    summary: 'Shift SMR odometer capture, excavator loads, dozer rolls, and closeout reports',
    masterTables: ['sites', 'mine_blocks', 'machines', 'operators', 'delay_categories'],
    operationalTables: [
      'machine_operations',
      'smr_readings',
      'hourly_loads',
      'excavator_activity',
      'excavator_dumper_assignments',
      'dozer_rolls',
      'delay_entries',
      'engineering_notes',
      'shift_status',
      'control_room_shift_reports',
    ],
  },
  {
    departmentSlug: 'production',
    departmentName: 'Production',
    departmentHref: '/production',
    manageHref: '/production/daily-log',
    manageLabel: 'Configure Targets',
    summary: 'Monthly coal & waste BCM targets, material densities, and pit extraction ledgers',
    masterTables: ['production_monthly_targets', 'material_density', 'machines'],
    operationalTables: [
      'production_logs',
      'hourly_loads',
      'excavator_activity',
      'daily_logs',
      'delay_entries',
      'machine_operations',
    ],
  },
  {
    departmentSlug: 'drilling',
    departmentName: 'Drilling',
    departmentHref: '/drilling',
    manageHref: '/drilling/daily-log',
    manageLabel: 'Open Drill Log',
    summary: 'Blast pattern hole counts, drilled meters per rig, operators, and rig delays',
    masterTables: ['machines', 'operators', 'sites', 'mine_blocks'],
    operationalTables: ['drill_operations', 'daily_logs', 'delay_entries'],
  },
  {
    departmentSlug: 'plant-processing',
    departmentName: 'Plant & Processing',
    departmentHref: '/plant-processing',
    manageHref: '/plant-processing',
    manageLabel: 'Open Hourly Sheet',
    summary: 'CHPP ROM feed vs clean coal yield sheets, circuit delays, and density factors',
    masterTables: ['sites', 'material_density'],
    operationalTables: ['plant_hourly_logs', 'plant_delays', 'daily_logs'],
  },
  {
    departmentSlug: 'plant-inventory',
    departmentName: 'Plant Inventory',
    departmentHref: '/plant-inventory',
    manageHref: '/plant-inventory/machines',
    manageLabel: 'Manage Item List',
    summary: 'Reagents, dense medium consumables, wear spares catalog, and shift usage ledger',
    masterTables: ['plant_inventory_items', 'machines', 'sites'],
    operationalTables: ['plant_inventory_usage'],
  },
  {
    departmentSlug: 'engineering',
    departmentName: 'Engineering',
    departmentHref: '/engineering',
    manageHref: '/engineering/machines',
    manageLabel: 'Inspect Fleet',
    summary: 'Fleet machinery database, breakdown dispatches, tyre lifecycle, and shift fuel/hours',
    masterTables: ['machines', 'machine_types'],
    operationalTables: [
      'tires',
      'breakdowns',
      'tire_inspections',
      'engineering_notes',
      'machine_hours',
      'fuel_logs',
    ],
  },
  {
    departmentSlug: 'availability-utilization',
    departmentName: 'Availability & Utilization',
    departmentHref: '/availability-utilization',
    manageHref: '/availability-utilization',
    manageLabel: 'Open 30-Day Sheet',
    summary: '30-day mechanical availability, MTBF, SMR snapshots, and telemetry streams',
    masterTables: ['machines'],
    operationalTables: [
      'machine_operations',
      'smr_readings',
      'monthly_machine_snapshots',
      'breakdowns',
      'delay_entries',
      'machine_telemetry',
    ],
  },
  {
    departmentSlug: 'access-control',
    departmentName: 'Access Control',
    departmentHref: '/access-control',
    manageHref: '/database/panels',
    manageLabel: 'Provision Personnel',
    summary: 'Personnel records, medical/induction compliance, QR/RFID badges, and CR80 printers',
    masterTables: ['personnel', 'badges', 'card_printers'],
    operationalTables: [
      'card_templates',
      'access_logs',
      'visitors',
      'muster_events',
      'card_print_jobs',
      'issued_cards',
    ],
  },
  {
    departmentSlug: 'office',
    departmentName: 'Office',
    departmentHref: '/office',
    manageHref: '/office',
    manageLabel: 'Open Office Suite',
    summary: 'Report templates, compliance document repository, exports, and AI token telemetry',
    masterTables: ['report_templates'],
    operationalTables: ['documents', 'generated_reports', 'ai_token_usage'],
  },
];

export const DETAILED_LIVE_COUNT_TABLES = [
  'departments',
  'employees',
  'employee_department_access',
  'roles',
  'personnel',
  'badges',
  'sites',
  'mine_blocks',
  'machines',
  'machine_types',
  'operators',
  'delay_categories',
  'material_density',
  'production_monthly_targets',
  'plant_inventory_items',
  'plant_inventory_usage',
  'plant_hourly_logs',
  'plant_delays',
  'drill_operations',
  'excavator_activity',
  'excavator_dumper_assignments',
  'dozer_rolls',
  'hourly_loads',
  'daily_logs',
  'production_logs',
  'machine_operations',
  'smr_readings',
  'monthly_machine_snapshots',
  'machine_hours',
  'fuel_logs',
  'breakdowns',
  'tires',
  'tire_inspections',
  'delay_entries',
  'engineering_notes',
  'shift_status',
  'control_room_shift_reports',
  'machine_telemetry',
  'access_logs',
  'visitors',
  'muster_events',
  'card_printers',
  'card_templates',
  'card_print_jobs',
  'issued_cards',
  'documents',
  'report_templates',
  'generated_reports',
  'webhook_endpoints',
  'audit_logs',
  'system_logs',
  'ai_token_usage',
] as const;

export type TrackedDatabaseTableName = (typeof DETAILED_LIVE_COUNT_TABLES)[number];

/** Return all operational department names that read or write the given table. */
export function getTableConsumerDepartments(tableName: string): readonly string[] {
  const consumers: string[] = [];
  for (const req of DEPARTMENT_DATA_REQUIREMENTS) {
    if (req.masterTables.includes(tableName) || req.operationalTables.includes(tableName)) {
      consumers.push(req.departmentName);
    }
  }
  return consumers;
}

/** Query live exact row counts for all cross-department tables with graceful standby fallback. */
export async function fetchDatabaseTableCounts(): Promise<DatabaseTableCountsResult> {
  const rowCounts: Record<string, number | null> = {};
  let isLiveConnected = false;

  try {
    const supabase = await createReadReplicaClient();
    const results = await Promise.allSettled(
      DETAILED_LIVE_COUNT_TABLES.map(async (tableName) => {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        if (error) return { tableName, count: null };
        return { tableName, count: count ?? 0 };
      })
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.count !== null) {
        rowCounts[res.value.tableName] = res.value.count;
        isLiveConnected = true;
      }
    }
  } catch {
    isLiveConnected = false;
  }

  const totalLiveRows = Object.values(rowCounts).reduce<number>(
    (acc, val) => acc + (typeof val === 'number' ? val : 0),
    0
  );

  return { rowCounts, isLiveConnected, totalLiveRows };
}

/** Evaluate per-department schema and master-data readiness from live table counts. */
export function evaluateDepartmentReadiness(options: {
  readonly rowCounts: Readonly<Record<string, number | null>>;
  readonly isLiveConnected: boolean;
}): DepartmentReadinessSummary {
  const { rowCounts, isLiveConnected } = options;

  let populatedTablesCount = 0;
  for (const tableName of DETAILED_LIVE_COUNT_TABLES) {
    const count = rowCounts[tableName];
    if (typeof count === 'number' && count > 0) {
      populatedTablesCount += 1;
    }
  }

  const reports: DepartmentReadinessReport[] = DEPARTMENT_DATA_REQUIREMENTS.map((requirement) => {
    const combinedTables = Array.from(
      new Set([...requirement.masterTables, ...requirement.operationalTables])
    );

    const emptyMasterTables: string[] = [];
    let populatedTableCount = 0;
    let totalRows = 0;

    for (const tableName of combinedTables) {
      const count = rowCounts[tableName];
      if (typeof count === 'number') {
        totalRows += count;
        if (count > 0) {
          populatedTableCount += 1;
        } else if (requirement.masterTables.includes(tableName)) {
          emptyMasterTables.push(tableName);
        }
      } else if (isLiveConnected && requirement.masterTables.includes(tableName)) {
        emptyMasterTables.push(tableName);
      }
    }

    const status: DepartmentReadinessReport['status'] = !isLiveConnected
      ? 'standby'
      : emptyMasterTables.length === 0
        ? 'ready'
        : 'attention';

    return {
      requirement,
      status,
      emptyMasterTables,
      populatedTableCount,
      totalRequiredTables: combinedTables.length,
      totalRows,
    };
  });

  const readyDepartmentsCount = reports.filter((r) => r.status === 'ready').length;
  const attentionDepartmentsCount = reports.filter((r) => r.status === 'attention').length;

  return {
    reports,
    readyDepartmentsCount,
    attentionDepartmentsCount,
    populatedTablesCount,
    totalTrackedTables: DETAILED_LIVE_COUNT_TABLES.length,
  };
}

function createEmptyMasterReferenceSnapshot(): MasterReferenceSnapshot {
  return {
    isLiveConnected: false,
    activeSites: [],
    mineBlocksCount: 0,
    mineBlockNames: [],
    totalMachines: 0,
    activeMachines: 0,
    machineTypesSummary: [],
    operatorsCount: 0,
    delayCategories: [],
    materialDensities: [],
    monthlyTargetsCount: 0,
    latestTargetMonth: null,
    plantInventoryItemsCount: 0,
    tiresCount: 0,
    cardPrintersCount: 0,
    cardTemplatesCount: 0,
  };
}

/** Query master reference tables required across all operational departments for /database/panels. */
export async function fetchMasterReferenceSnapshot(): Promise<MasterReferenceSnapshot> {
  try {
    const supabase = await createReadReplicaClient();
    const [
      sitesRes,
      blocksRes,
      machinesRes,
      operatorsRes,
      delayCatsRes,
      densitiesRes,
      targetsRes,
      inventoryRes,
      tiresRes,
      printersRes,
      templatesRes,
    ] = await Promise.allSettled([
      supabase.from('sites').select('name, site_code').order('name').limit(20),
      supabase.from('mine_blocks').select('name', { count: 'exact' }).limit(PREVIEW_NAMES_LIMIT),
      supabase.from('machines').select('machine_type, active').limit(200),
      supabase.from('operators').select('id', { count: 'exact', head: true }),
      supabase.from('delay_categories').select('name').order('sort_order').limit(12),
      supabase.from('material_density').select('material_type, density_factor').limit(12),
      supabase
        .from('production_monthly_targets')
        .select('target_month', { count: 'exact' })
        .order('target_month', { ascending: false })
        .limit(1),
      supabase.from('plant_inventory_items').select('id', { count: 'exact', head: true }),
      supabase.from('tires').select('id', { count: 'exact', head: true }),
      supabase.from('card_printers').select('id', { count: 'exact', head: true }),
      supabase.from('card_templates').select('id', { count: 'exact', head: true }),
    ]);

    const sitesData =
      sitesRes.status === 'fulfilled' && !sitesRes.value.error ? (sitesRes.value.data ?? []) : [];
    const blocksOk = blocksRes.status === 'fulfilled' && !blocksRes.value.error;
    const machinesData =
      machinesRes.status === 'fulfilled' && !machinesRes.value.error
        ? (machinesRes.value.data ?? [])
        : [];
    const operatorsCount =
      operatorsRes.status === 'fulfilled' && !operatorsRes.value.error
        ? (operatorsRes.value.count ?? 0)
        : 0;
    const delayCatsData =
      delayCatsRes.status === 'fulfilled' && !delayCatsRes.value.error
        ? (delayCatsRes.value.data ?? [])
        : [];
    const densitiesData =
      densitiesRes.status === 'fulfilled' && !densitiesRes.value.error
        ? (densitiesRes.value.data ?? [])
        : [];
    const targetsOk = targetsRes.status === 'fulfilled' && !targetsRes.value.error;
    const inventoryCount =
      inventoryRes.status === 'fulfilled' && !inventoryRes.value.error
        ? (inventoryRes.value.count ?? 0)
        : 0;
    const tiresCount =
      tiresRes.status === 'fulfilled' && !tiresRes.value.error ? (tiresRes.value.count ?? 0) : 0;
    const cardPrintersCount =
      printersRes.status === 'fulfilled' && !printersRes.value.error
        ? (printersRes.value.count ?? 0)
        : 0;
    const cardTemplatesCount =
      templatesRes.status === 'fulfilled' && !templatesRes.value.error
        ? (templatesRes.value.count ?? 0)
        : 0;

    const isAnySuccess =
      (sitesRes.status === 'fulfilled' && !sitesRes.value.error) ||
      blocksOk ||
      (machinesRes.status === 'fulfilled' && !machinesRes.value.error) ||
      (operatorsRes.status === 'fulfilled' && !operatorsRes.value.error);

    if (!isAnySuccess) {
      return createEmptyMasterReferenceSnapshot();
    }

    const typeCounts = new Map<string, number>();
    let activeMachines = 0;
    for (const machine of machinesData) {
      if (machine.active !== false) {
        activeMachines += 1;
      }
      const machineType =
        typeof (machine as { machine_type?: string | null }).machine_type === 'string' &&
        (machine as { machine_type?: string | null }).machine_type!.trim()
          ? (machine as { machine_type?: string | null }).machine_type!.trim()
          : 'Equipment';
      typeCounts.set(machineType, (typeCounts.get(machineType) ?? 0) + 1);
    }

    const machineTypesSummary = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, PREVIEW_NAMES_LIMIT)
      .map(([typeName, count]) => `${typeName} (${count})`);

    return {
      isLiveConnected: true,
      activeSites: sitesData.map((site) => ({
        name: site.name,
        siteCode: site.site_code ?? 'SITE',
      })),
      mineBlocksCount: blocksOk ? (blocksRes.value.count ?? blocksRes.value.data?.length ?? 0) : 0,
      mineBlockNames: blocksOk
        ? (blocksRes.value.data ?? [])
            .map((block) => block.name)
            .filter((name): name is string => Boolean(name))
        : [],
      totalMachines: machinesData.length,
      activeMachines,
      machineTypesSummary,
      operatorsCount,
      delayCategories: delayCatsData
        .map((cat) => cat.name)
        .filter((name): name is string => Boolean(name)),
      materialDensities: densitiesData.map((density) => ({
        materialType: density.material_type,
        densityFactor: Number(density.density_factor ?? 0),
      })),
      monthlyTargetsCount: targetsOk
        ? (targetsRes.value.count ?? targetsRes.value.data?.length ?? 0)
        : 0,
      latestTargetMonth:
        targetsOk && targetsRes.value.data?.[0]?.target_month
          ? targetsRes.value.data[0].target_month
          : null,
      plantInventoryItemsCount: inventoryCount,
      tiresCount,
      cardPrintersCount,
      cardTemplatesCount,
    };
  } catch {
    return createEmptyMasterReferenceSnapshot();
  }
}
