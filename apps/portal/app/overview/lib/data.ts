// Departments data
export const DEPARTMENTS = [
  {
    id: 'admin',
    name: 'Administration',
    slug: 'admin',
    description:
      'Sites, machinery fleet, users & roles, settings, system integrations & AI telemetry',
    color: '#7c3aed',
    routes: [
      {
        path: '/admin?tab=sites',
        name: 'Sites',
        description: 'Mining sites & operational complexes',
      },
      {
        path: '/admin?tab=fleet',
        name: 'Fleet',
        description: 'Heavy machinery & bin factor registry',
      },
      {
        path: '/admin?tab=users',
        name: 'Users',
        description: 'Employee RBAC & department assignments',
      },
      {
        path: '/admin?tab=departments',
        name: 'Departments',
        description: 'Operational module configuration',
      },
      {
        path: '/admin?tab=settings',
        name: 'Settings',
        description: 'Global tenant & security settings',
      },
      {
        path: '/admin?tab=integrations',
        name: 'Integrations',
        description: 'SCADA, printer & webhook connectors',
      },
      {
        path: '/admin/ai-metrics',
        name: 'AI Metrics',
        description: 'LLM token cache & ZAR cost telemetry',
      },
    ],
    roles: ['admin', 'super_admin', 'executive'],
  },
  {
    id: 'drilling',
    name: 'Drilling',
    slug: 'drilling',
    description: 'Drilling operations, penetration rates, and rig telemetry',
    color: '#2563eb',
    routes: [
      {
        path: '/drilling',
        name: 'Dashboard',
        description: "Today's summary and status",
      },
      {
        path: '/drilling/drilling-operations',
        name: 'Drilling Operations',
        description: 'Rig shift logs & blast pattern tracking',
      },
      {
        path: '/drilling/machine-telemetry',
        name: 'Machine Telemetry',
        description: 'Real-time Pit Viper down-hole telemetry',
      },
      {
        path: '/drilling/daily-log',
        name: 'Daily Log',
        description: 'Submit shift logs',
      },
      {
        path: '/drilling/machines',
        name: 'Machines',
        description: 'Department equipment & drill rigs',
      },
      {
        path: '/drilling/equipment-overview',
        name: 'Equipment Overview',
        description: 'Drill fleet availability & utilization matrix',
      },
      {
        path: '/drilling/history',
        name: 'History',
        description: 'Past daily logs',
      },
      {
        path: '/drilling/reports',
        name: 'Reports',
        description: 'Aggregate data + CSV',
      },
      {
        path: '/drilling/tools',
        name: 'Tools',
        description: 'Flowise / tool embeds',
      },
    ],
    roles: ['drilling_operator', 'supervisor', 'admin'],
  },
  {
    id: 'production',
    name: 'Production',
    slug: 'production',
    description: 'Coal production, pit excavation, and haulage tracking',
    color: '#34c759',
    routes: [
      {
        path: '/production',
        name: 'Dashboard',
        description: "Today's summary and status",
      },
      {
        path: '/production/daily-log',
        name: 'Daily Log',
        description: 'Submit shift logs',
      },
      {
        path: '/production/machines',
        name: 'Machines',
        description: 'Excavators, haul trucks, and dozers',
      },
      {
        path: '/production/hourly-loads',
        name: 'Hourly Loads',
        description: 'Payload tons per hour & cycle metrics',
      },
      {
        path: '/production/excavator-activity',
        name: 'Excavator Activity',
        description: 'Loading cycles & payload distribution',
      },
      {
        path: '/production/equipment-overview',
        name: 'Equipment Overview',
        description: 'Pit fleet mechanical availability & utilization',
      },
      {
        path: '/plant-processing',
        name: 'Plant Processing',
        description: 'CHPP coal wash plant throughput, DMS & delays',
      },
      {
        path: '/plant-inventory',
        name: 'Plant Inventory',
        description: 'CHPP equipment consumables & wear spares',
      },
      {
        path: '/production/history',
        name: 'History',
        description: 'Past daily logs',
      },
      {
        path: '/production/reports',
        name: 'Reports',
        description: 'Aggregate data + CSV',
      },
      {
        path: '/production/tools',
        name: 'Tools',
        description: 'Flowise / tool embeds',
      },
    ],
    roles: ['production_operator', 'supervisor', 'admin'],
  },
  {
    id: 'access-control',
    name: 'Access Control',
    slug: 'access-control',
    description: 'Mine gate entry/exit, RFID badge verification, and personnel tracking',
    color: '#0284c7',
    routes: [
      {
        path: '/access-control',
        name: 'Dashboard',
        description: "Today's summary and real-time gate muster",
      },
      {
        path: '/access-control/muster',
        name: 'Muster Station',
        description: 'Emergency roll call & zone occupancy',
      },
      {
        path: '/access-control/print-cards',
        name: 'Print Cards',
        description: 'Industrial CR80 card print jobs & spooler',
      },
      {
        path: '/access-control/qr-codes',
        name: 'QR Codes',
        description: 'Batch QR generation and C66 verification',
      },
      {
        path: '/access-control/access-logs',
        name: 'Access Logs',
        description: 'Turnstile & boom gate scan audit trail',
      },
      {
        path: '/access-control/visitors',
        name: 'Visitors',
        description: 'Contractor & visitor induction registry',
      },
      {
        path: '/access-control/badges',
        name: 'Badges',
        description: 'Active RFID/QR credential management',
      },
      {
        path: '/access-control/reports',
        name: 'Reports',
        description: 'Aggregate data + CSV muster reports',
      },
    ],
    roles: ['access_control_officer', 'access_control', 'supervisor', 'admin'],
  },
  {
    id: 'engineering',
    name: 'Engineering',
    slug: 'engineering',
    description: 'Technical support, predictive maintenance, and breakdown dispatch',
    color: '#7c3aed',
    routes: [
      {
        path: '/engineering',
        name: 'Dashboard',
        description: "Today's summary and status",
      },
      {
        path: '/engineering/breakdowns',
        name: 'Breakdowns',
        description: 'Active mechanical/electrical breakdown tickets',
      },
      {
        path: '/engineering/tire-management',
        name: 'Tire Management',
        description: 'Haul fleet tire pressure & tread lifecycle',
      },
      {
        path: '/engineering/daily-log',
        name: 'Daily Log',
        description: 'Submit shift logs',
      },
      {
        path: '/engineering/machines',
        name: 'Machines',
        description: 'Department equipment & health',
      },
      {
        path: '/engineering/equipment-overview',
        name: 'Equipment Overview',
        description: 'Engineering fleet availability, MTBF & MTTR',
      },
      {
        path: '/availability-utilization',
        name: 'Availability & Utilization',
        description: 'CEO 30-day SMR, delays & root-cause ledger',
      },
      {
        path: '/engineering/history',
        name: 'History',
        description: 'Past daily logs',
      },
      {
        path: '/engineering/reports',
        name: 'Reports',
        description: 'Aggregate data + CSV',
      },
      {
        path: '/engineering/tools',
        name: 'Tools',
        description: 'Flowise / tool embeds',
      },
    ],
    roles: ['engineer', 'supervisor', 'admin'],
  },
  {
    id: 'control-room',
    name: 'Control Room',
    slug: 'control-room',
    description: 'Central monitoring, real-time SCADA telemetry, and shift closeouts',
    color: '#dc2626',
    routes: [
      {
        path: '/control-room/shift-compilation',
        name: 'Shift Operations',
        description: 'Atomic shift compilation & closeout signing',
      },
      {
        path: '/control-room',
        name: 'Dashboard',
        description: 'Live SCADA overview and alarm status',
      },
      {
        path: '/control-room/hourly-loads',
        name: 'Hourly Loads',
        description: 'Real-time excavator-to-truck load matrix',
      },
      {
        path: '/control-room/machine-operations',
        name: 'Machine Operations',
        description: 'SMR hours, diesel burn & delay logging',
      },
      {
        path: '/control-room/end-smr',
        name: 'End SMR Capture',
        description: 'Monotonic shift-end SMR odometer ledger',
      },
      {
        path: '/control-room/shift-closeout',
        name: 'Shift Closeout',
        description: 'Immutable shift handover & closeout certificate',
      },
      {
        path: '/control-room/engineering-notes',
        name: 'Engineering Notes',
        description: 'Cross-shift engineering handover notes',
      },
      {
        path: '/control-room/excavator-activity',
        name: 'Excavator Activity',
        description: 'Live digger utilization & BCM/hr',
      },
      {
        path: '/control-room/reports',
        name: 'Reports',
        description: 'Aggregate data + CSV',
      },
    ],
    roles: ['control_room_operator', 'admin', 'supervisor', 'operator'],
  },
  {
    id: 'overview',
    name: 'System Overview',
    slug: 'overview',
    description: 'Architecture visualizer, tech stack, database schema, and system telemetry',
    color: '#0284c7',
    routes: [
      {
        path: '/overview',
        name: 'System Architecture',
        description: 'End-to-end monorepo & layer architecture',
      },
      {
        path: '/overview?tab=backend',
        name: 'Backend Topology',
        description: 'Supabase, Redis, Inngest & SCADA service mesh',
      },
      {
        path: '/overview?tab=departments',
        name: 'Departments',
        description: '8 operational modules & RBAC matrix',
      },
      {
        path: '/overview?tab=database',
        name: 'Database Schema',
        description: 'PostgreSQL 17 tables & RLS InitPlan catalog',
      },
      {
        path: '/overview?tab=audit',
        name: 'Audit & Compliance',
        description: 'Automated drift, security & quality reports',
      },
      {
        path: '/overview?tab=agentic',
        name: 'Agentic Monitor',
        description: 'Multi-agent token cache & ZAR cost telemetry',
      },
    ],
    roles: ['admin', 'executive', 'supervisor', 'engineer'],
  },
  {
    id: 'database',
    name: 'Database',
    slug: 'database',
    description:
      'PostgreSQL 17 schema definitions, 213 migrations, and live Supabase telemetry panels',
    color: '#10b981',
    routes: [
      {
        path: '/database',
        name: 'Dashboard',
        description: 'Live Supabase PostgreSQL 17 telemetry & row counts',
      },
      {
        path: '/database/schemas',
        name: 'Schemas',
        description: 'PostgreSQL 17 schema & RLS policy definitions',
      },
      {
        path: '/database/panels',
        name: 'Panels',
        description: 'Direct personnel & badge provisioning console',
      },
      {
        path: '/database/reports',
        name: 'Reports',
        description: 'Database audit & compliance exports',
      },
    ],
    roles: ['admin', 'engineer', 'super_admin'],
  },
];

// Navigation graph nodes and edges for XYFlow
const _NAVIGATION_GRAPH = {
  nodes: [
    // Root
    { id: 'hub', type: 'root', label: 'Hub', x: 400, y: 50 },
    { id: 'login', type: 'auth', label: 'Login', x: 100, y: 50 },

    // Departments
    {
      id: 'drilling',
      type: 'department',
      label: 'Drilling',
      color: '#2563eb',
      x: 100,
      y: 200,
    },
    {
      id: 'production',
      type: 'department',
      label: 'Production',
      color: '#34c759',
      x: 250,
      y: 200,
    },
    {
      id: 'access-control',
      type: 'department',
      label: 'Access Control',
      color: '#0284c7',
      x: 400,
      y: 200,
    },
    {
      id: 'engineering',
      type: 'department',
      label: 'Engineering',
      color: '#7c3aed',
      x: 550,
      y: 200,
    },
    {
      id: 'control-room',
      type: 'department',
      label: 'Control Room',
      color: '#dc2626',
      x: 700,
      y: 200,
    },
    {
      id: 'overview',
      type: 'department',
      label: 'System Overview',
      color: '#0284c7',
      x: 850,
      y: 200,
    },
    {
      id: 'database',
      type: 'department',
      label: 'Database',
      color: '#10b981',
      x: 1000,
      y: 200,
    },

    // Admin
    { id: 'admin', type: 'admin', label: 'Admin', x: 1150, y: 50 },
  ],
  edges: [
    // Hub connections
    { id: 'e1', source: 'hub', target: 'drilling' },
    { id: 'e2', source: 'hub', target: 'production' },
    { id: 'e3', source: 'hub', target: 'access-control' },
    { id: 'e4', source: 'hub', target: 'engineering' },
    { id: 'e5', source: 'hub', target: 'control-room' },
    { id: 'e6', source: 'hub', target: 'overview' },
    { id: 'e7', source: 'hub', target: 'database' },

    // Auth
    { id: 'e10', source: 'login', target: 'hub' },

    // Admin
    { id: 'e11', source: 'admin', target: 'hub' },
  ],
};

// Tech stack data
export const TECH_STACK = [
  {
    category: 'Frontend',
    color: '#3ecf8e',
    items: [
      {
        name: 'Next.js 16',
        version: '16.4.3',
        description: 'App Router, Cache Components, React Server Components & Server Actions',
      },
      {
        name: 'React 19',
        version: '19.2.0',
        description: 'Action hooks, React compiler optimization & concurrent transitions',
      },
      {
        name: 'Tailwind CSS & OKLCH',
        version: '3.4.17',
        description: 'Perceptually uniform light-mode OKLCH palette via @repo/theme design tokens',
      },
      {
        name: 'Framer Motion',
        version: '12.40.0',
        description: 'Single standardized GPU-accelerated motion engine across @repo/ui',
      },
      {
        name: 'TanStack Query',
        version: '5.x',
        description: 'Authoritative client-side async state & optimistic cache synchronization',
      },
      {
        name: 'Lucide React',
        version: 'Latest',
        description: 'Tree-shakable industrial iconography',
      },
    ],
  },
  {
    category: 'Backend',
    color: '#60a5fa',
    items: [
      {
        name: 'Supabase PostgreSQL',
        version: '17.x',
        description: 'Primary ACID relational database with 213 versioned migrations & pgvector',
      },
      {
        name: 'Row Level Security (RLS)',
        version: '100% InitPlan',
        description:
          'Declarative Postgres security policies with 100% (select auth.uid()) InitPlan coverage',
      },
      {
        name: '@repo/contract (Zod)',
        version: '3.24.x',
        description: 'Canonical runtime schema validation and drift-audited database contracts',
      },
      {
        name: 'Inngest',
        version: '3.x',
        description: 'Durable event-driven job orchestration and telemetry sync pipelines',
      },
    ],
  },
  {
    category: 'DevOps & Caching',
    color: '#007aff',
    items: [
      {
        name: 'Redis 7 / Hybrid L1+L2',
        version: '7.4 / Upstash',
        description:
          'In-memory LRU L1 cache + Upstash REST L2 pipeline and Redlock distributed locks',
      },
      {
        name: 'Turborepo 2.x',
        version: '2.10.12',
        description:
          'Affected task graph, cached pipeline execution & monorepo boundary enforcement',
      },
      {
        name: 'pnpm',
        version: '9.15.9',
        description: 'Strict content-addressable dependency graph and workspace manager',
      },
      {
        name: 'Vercel & Supabase Cloud',
        version: 'Production',
        description: 'Zero-downtime edge deployment, read-replica routing, and local Docker parity',
      },
    ],
  },
  {
    category: 'Testing & Quality',
    color: '#ec4899',
    items: [
      {
        name: 'Jest 30 & ts-jest',
        version: '30.x',
        description: 'Workspace-wide unit and integration test suites',
      },
      {
        name: 'Biome',
        version: '1.9.4',
        description: 'Rust-powered sub-second linter, import organizer, and code formatter',
      },
      {
        name: 'Playwright',
        version: '1.56.1',
        description: 'End-to-end browser automation and visual smoke verification',
      },
      {
        name: 'DeepEval & Sentry',
        version: 'Active',
        description: 'Deterministic LLM evaluation harness and full-stack APM telemetry',
      },
    ],
  },
  {
    category: 'Integration Tools',
    color: '#a78bfa',
    items: [
      {
        name: 'FUXA SCADA',
        version: '1.2.x',
        description: 'Real-time OPC-UA and Modbus-TCP machine HMI',
      },
      {
        name: 'Inngest',
        version: 'Latest',
        description: 'Automated event-triggered background jobs and scheduled workflows',
      },
      {
        name: 'Flowise',
        version: 'Latest',
        description: 'Visual node-based agent and tool orchestrator',
      },
    ],
  },
];

// Database schema
export const DATABASE_SCHEMA = [
  {
    name: 'departments',
    rls: true,
    columns: ['id (UUID PK)', 'name (text)', 'slug (text)', 'created_at'],
    description: '8 core operational departments with strict routing and RLS access boundaries',
  },
  {
    name: 'employees',
    rls: true,
    columns: [
      'id (UUID PK)',
      'auth_id (FK)',
      'department_id (FK)',
      'full_name',
      'role',
      'accessible_departments (UUID[])',
      'created_at',
    ],
    description: 'Authoritative employee records linked to auth.users with cross-department access',
  },
  {
    name: 'personnel',
    rls: true,
    columns: [
      'id (UUID PK)',
      'emp_code',
      'first_name',
      'surname',
      'id_number',
      'job_title',
      'area_name',
      'medical_expiry',
      'induction_expiry',
      'photo_url',
      'status',
    ],
    description: 'Site personnel registry with medical & safety induction compliance interlocks',
  },
  {
    name: 'badges',
    rls: true,
    columns: [
      'id (UUID PK)',
      'personnel_id (FK)',
      'qr_code',
      'card_number',
      'is_active',
      'issued_at',
    ],
    description: 'Physical CR80 QR & RFID credentials bound to Chainway C66 turnstile scanners',
  },
  {
    name: 'machines',
    rls: true,
    columns: [
      'id (UUID PK)',
      'department_id (FK)',
      'site_id (FK)',
      'name',
      'code',
      'machine_type',
      'latest_smu (numeric)',
      'status',
      'created_at',
    ],
    description: 'Pit machinery, drill rigs, excavators, dozers, and haul trucks',
  },
  {
    name: 'machine_operations',
    rls: true,
    columns: [
      'id (UUID PK)',
      'machine_id (FK)',
      'operation_date',
      'shift',
      'start_smr (numeric)',
      'end_smr (numeric)',
      'hours_worked (numeric)',
      'diesel_litres (numeric)',
      'operator_id (FK)',
    ],
    description:
      'Per-shift machine SMR odometer readings, monotonic delta interlocks, worked hours, and fuel burn',
  },
  {
    name: 'smr_readings',
    rls: true,
    columns: [
      'id (UUID PK)',
      'meter_id',
      'reading (numeric)',
      'reading_at',
      'recorded_by (FK)',
      'created_at',
    ],
    description:
      'Append-only SMR odometer ledger syncing latest_smu across fleet machines via PL/pgSQL trigger',
  },
  {
    name: 'monthly_machine_snapshots',
    rls: true,
    columns: [
      'id (UUID PK)',
      'machine_id (FK)',
      'month_year (YYYY-MM)',
      'opening_smr (numeric)',
      'closing_smr (numeric)',
      'worked_hours (numeric)',
      'availability_pct (numeric)',
      'utilization_pct (numeric)',
      'mtbf_hours (numeric)',
    ],
    description:
      'Monthly 30/31-day activity rollups, mechanical availability, utilization, and MTBF snapshots',
  },
  {
    name: 'daily_logs',
    rls: true,
    columns: [
      'id (UUID PK)',
      'department_id (FK)',
      'shift',
      'date',
      'notes',
      'created_by (FK)',
      'created_at',
    ],
    description: 'Append-only immutable shift logs with supervisor closeout stamps',
  },
  {
    name: 'breakdowns',
    rls: true,
    columns: [
      'id (UUID PK)',
      'fleet_id (FK)',
      'department_id (FK)',
      'delay_hours (numeric)',
      'shift_type',
      'status',
      'date_in',
      'date_out',
      'reason',
    ],
    description:
      'Mechanical and electrical breakdown incidents dispatched to engineering with cross-department 12h shift delay sync',
  },
  {
    name: 'production_monthly_targets',
    rls: true,
    columns: [
      'id (UUID PK)',
      'target_month (YYYY-MM)',
      'coal_target_tons (numeric)',
      'waste_target_tons (numeric)',
      'total_bcm_target (numeric)',
      'strip_ratio_target (numeric)',
      'updated_by (FK)',
    ],
    description:
      'Authoritative monthly Coal and Waste targets shared across Production, Control Room, and Drilling',
  },
  {
    name: 'delay_entries',
    rls: true,
    columns: [
      'id (UUID PK)',
      'department_id (FK)',
      'machine_id (FK)',
      'reason_code',
      'duration_minutes',
      'shift',
      'date',
      'logged_by (FK)',
    ],
    description: 'Operational delays and equipment idle tracking across drilling and haulage',
  },
  {
    name: 'hourly_loads',
    rls: true,
    columns: [
      'id (UUID PK)',
      'excavator_id (FK)',
      'truck_id (FK)',
      'material_type',
      'bucket_count',
      'payload_tonnage',
      'recorded_at',
    ],
    description: 'Time-series payload and pass metrics partitioned for high-speed aggregations',
  },
  {
    name: 'scada_telemetry_records',
    rls: true,
    columns: [
      'id (UUID PK)',
      'equipment_tag',
      'protocol',
      'register_address',
      'telemetry_value (numeric)',
      'unit',
      'quality_code',
      'recorded_at',
    ],
    description: 'High-frequency SCADA tag streaming data from Modbus and OPC-UA PLCs',
  },
  {
    name: 'card_print_jobs',
    rls: true,
    columns: [
      'id (UUID PK)',
      'employee_id (FK)',
      'template_id (FK)',
      'status',
      'badge_rfid',
      'printer_id',
      'issued_at',
    ],
    description: 'RFID badge batch printing queue and issuance audit trail',
  },
  {
    name: 'access_logs',
    rls: true,
    columns: [
      'id (UUID PK)',
      'employee_id (FK)',
      'gate_id',
      'direction (IN/OUT)',
      'rfid_scan',
      'timestamp',
    ],
    description: 'Mine portal turnstile logs for emergency muster accounting',
  },
  {
    name: 'audit_logs',
    rls: true,
    columns: [
      'id (UUID PK)',
      'user_id (FK)',
      'action',
      'entity_type',
      'entity_id',
      'ip_address',
      'created_at',
    ],
    description: 'Immutable compliance and security event logs',
  },
];

const _DB_RELATIONSHIPS = [
  { from: 'employees', to: 'departments', type: 'many-to-one' },
  { from: 'machines', to: 'departments', type: 'many-to-one' },
  { from: 'daily_logs', to: 'departments', type: 'many-to-one' },
  { from: 'badges', to: 'personnel', type: 'many-to-one' },
  { from: 'machine_hours', to: 'daily_logs', type: 'many-to-one' },
  { from: 'machine_hours', to: 'machines', type: 'many-to-one' },
  { from: 'fuel_logs', to: 'daily_logs', type: 'many-to-one' },
  { from: 'fuel_logs', to: 'machines', type: 'many-to-one' },
  { from: 'production_logs', to: 'daily_logs', type: 'many-to-one' },
];

export interface ScadaTelemetryTag {
  tagId: string;
  name: string;
  sourceProtocol: 'OPC-UA' | 'Modbus-TCP';
  registerAddress?: string;
  nodeId?: string;
  dataType: 'FLOAT32' | 'INT16' | 'BOOLEAN' | 'UINT32';
  baseValue: number | boolean;
  unit?: string;
  pollingRateHz: number;
  variance?: number;
  quality: 'GOOD (0x00)' | 'UNCERTAIN (0x40)';
  equipment: string;
}

export interface ScadaMetrics {
  opcUaPollingRateHz: number;
  opcUaJitterMs: number;
  modbusRegisterCount: number;
  modbusActiveNodes: number;
  frameLossRatePct: number;
  throughputKbps: number;
  activeSubscriptions: number;
  tags: ScadaTelemetryTag[];
}

export interface BackendService {
  id: string;
  name: string;
  category: 'client' | 'gateway' | 'database' | 'cache' | 'iot' | 'observability';
  role: string;
  description: string;
  tech: string;
  color: string;
  protocols: string[];
  security: string;
  sla: string;
  features: string[];
  scadaMetrics?: ScadaMetrics;
}

interface BackendConnection {
  id: string;
  source: string;
  target: string;
  label: string;
  protocol: string;
  flowType: 'data' | 'cache' | 'realtime' | 'iot' | 'observability';
  description: string;
  color: string;
}

export const BACKEND_SERVICES: BackendService[] = [
  // Client Tier
  {
    id: 'portal-app',
    name: 'Portal Web Client',
    category: 'client',
    role: 'Primary Industrial UI',
    description:
      'Next.js 16.4.3 App Router UI for mining operators, supervisors, and control room dispatchers.',
    tech: 'Next.js 16.4.3 + React 19.2 + TanStack Query',
    color: '#3ecf8e',
    protocols: ['HTTPS', 'WSS'],
    security: 'HttpOnly Session Cookies, PKCE OAuth',
    sla: '<100ms UI response',
    features: [
      'Control Room SCADA Feed',
      'Daily Shift Logs',
      '8 Department Dashboards',
      'FUXA HMI Embed',
    ],
  },
  {
    id: 'overview-engine',
    name: 'System Topology & Audit Hub',
    category: 'client',
    role: 'Visual Architecture & Telemetry Topology',
    description:
      'Integrated architecture visualizer for end-to-end topology, SCADA stream flow inspection, database schema mapping, and automated drift compliance auditing.',
    tech: 'React 19 Server Components + Server Actions',
    color: '#007aff',
    protocols: ['HTTPS', 'React Server Components', 'Server Actions'],
    security: 'Supabase Session JWT + Role Gating',
    sla: '<16ms 60fps interactive rendering',
    features: [
      'Interactive System Graph',
      'Live Telemetry Simulator',
      'DB Schema Graph',
      'Drift Health Audit (DHI)',
    ],
  },

  // API & Gateway Tier
  {
    id: 'server-actions',
    name: 'Next.js Server Actions',
    category: 'gateway',
    role: 'Direct Type-Safe RPC & Auth Gateway',
    description:
      'Direct server-side mutation and RPC layer enforcing strict runtime Zod schema validation and forwarding authenticated user session context directly to Supabase PostgreSQL RLS with zero middleman proxy overhead.',
    tech: 'Node.js 24 Serverless + @repo/contract Zod + Supabase SSR SDK',
    color: '#3b82f6',
    protocols: ['Direct Server RPC', 'HTTPS', 'Supabase Session Claims'],
    security: 'Server-side Session & 100% RLS InitPlan Enforcement (Zero-Proxy)',
    sla: '<25ms Execution',
    features: [
      'Direct Supabase RLS Session Forwarding',
      'Strict Zod Runtime Schema Validation',
      'Shift Closeout & Supervisor PIN Verification',
      'Redlock Concurrency & Rate Limiting',
      'Zero-Middleman Proxy Architecture',
    ],
  },
  {
    id: 'inngest-workers',
    name: 'Inngest Event Workers',
    category: 'gateway',
    role: 'Asynchronous Job Orchestrator',
    description:
      'Durable background execution engine for automated shift roll-overs, telemetry aggregation, and telemetry sync.',
    tech: 'Inngest SDK + Serverless Functions',
    color: '#f59e0b',
    protocols: ['HTTPS Webhooks', 'JSON-RPC'],
    security: 'Webhook Signature Verification',
    sla: 'At-least-once delivery with retry step functions',
    features: [
      'Telemetry Rollup',
      'Night Shift Closeout',
      'Syncpack Verification',
      'Langfuse Batch Trace Flush',
    ],
  },

  // Primary Data Layer (Supabase / Postgres)
  {
    id: 'supabase-db',
    name: 'Supabase PostgreSQL 17',
    category: 'database',
    role: 'Primary ACID Data Store + Read Replica',
    description:
      'PostgreSQL 17 cluster with 213 versioned migrations, partition pruning, read-replica routing, and 100% Row Level Security InitPlan policies.',
    tech: 'PostgreSQL 17 + PostgREST + pgvector',
    color: '#3ecf8e',
    protocols: ['PostgreSQL Wire (5432)', 'HTTPS / PostgREST'],
    security: '100% RLS InitPlan Policies, Encrypted at rest (AES-256)',
    sla: '<10ms Query p95',
    features: [
      'Partitioned Production Logs',
      'Supervisor PIN Hashes',
      'Personnel & Badge Interlocks',
      'Vector Embeddings (HNSW)',
    ],
  },
  {
    id: 'supabase-realtime',
    name: 'Supabase Realtime',
    category: 'database',
    role: 'WebSocket Event Broadcasting',
    description:
      'Real-time pub/sub replication engine dispatching database changes to active dispatcher screens.',
    tech: 'Elixir Realtime Engine + WebSockets',
    color: '#00c573',
    protocols: ['WSS (WebSockets)'],
    security: 'JWT Claims & Channel Authorization',
    sla: '<50ms Broadcast Latency',
    features: [
      'Live Machine Telemetry',
      'Shift Status Change Broadcast',
      'Control Room Alert Feed',
    ],
  },
  {
    id: 'supabase-storage',
    name: 'Supabase Storage',
    category: 'database',
    role: 'Object Storage Bucket',
    description:
      'S3-compatible asset store for operator ID photos, equipment condition snapshots, and generated PDF reports.',
    tech: 'S3 API Storage Engine',
    color: '#10b981',
    protocols: ['HTTPS / S3 REST'],
    security: 'Signed URLs & Storage RLS',
    sla: '<100ms File Delivery',
    features: ['Personnel Photos', 'Equipment Inspection Scans', 'Signed Shift Closeout PDFs'],
  },

  // Caching & In-Memory Layer
  {
    id: 'redis-cluster',
    name: 'Hybrid L1/L2 Redis 7.4',
    category: 'cache',
    role: 'High-Speed Cache & Distributed Locking',
    description:
      'Hybrid LRU L1 in-memory cache + Upstash REST L2 pipeline for shift roll-over concurrency locks (Redlock), query caching, and rate limiting.',
    tech: 'Redis 7.4 / Upstash REST Pipeline',
    color: '#ef4444',
    protocols: ['RESP (Redis Protocol, 6379)', 'HTTPS REST Pipeline'],
    security: 'TLS + Auth Token / VPC Peering',
    sla: '<2ms Retrieval',
    features: [
      'Sliding-Window Rate Limiting',
      'Redlock Shift Closeout Mutex',
      'Machine Status Cache',
      'Department UUID Cache',
    ],
  },

  // Industrial SCADA & IoT Tier
  {
    id: 'fuxa-scada',
    name: 'FUXA SCADA Server',
    category: 'iot',
    role: 'Industrial HMI & SCADA Gateway',
    description:
      'Industrial SCADA visualization and telemetry server interfacing with heavy mining machinery sensors.',
    tech: 'FUXA Engine + Node.js + Modbus/OPC-UA',
    color: '#06b6d4',
    protocols: ['Modbus TCP', 'OPC-UA', 'WebSockets', 'HTTPS'],
    security: 'VPN Tunnel / Industrial Network Isolation',
    sla: 'Real-time telemetry stream (<200ms sensor poll)',
    features: [
      'Excavator Payload Monitor',
      'Dozer Pitch & Roll Inclinometer',
      'Drill Rig Depth Sensors',
    ],
    // AGENT-TRACE: Simulated live SCADA telemetry metrics for FUXA HMI gateway
    scadaMetrics: {
      opcUaPollingRateHz: 10,
      opcUaJitterMs: 1.8,
      modbusRegisterCount: 1284,
      modbusActiveNodes: 16,
      frameLossRatePct: 0.0,
      throughputKbps: 42.8,
      activeSubscriptions: 8,
      tags: [
        {
          tagId: 'TAG-EX901-PAYLOAD',
          name: 'EX901_Bucket_Payload',
          sourceProtocol: 'OPC-UA',
          nodeId: 'ns=2;s=Mining.EX901.Payload_Ton',
          dataType: 'FLOAT32',
          baseValue: 42.6,
          unit: 't',
          pollingRateHz: 10,
          variance: 1.4,
          quality: 'GOOD (0x00)',
          equipment: 'Cat 6040 Excavator #01',
        },
        {
          tagId: 'TAG-EX901-HYD-PRESS',
          name: 'EX901_Hydraulic_Pressure',
          sourceProtocol: 'Modbus-TCP',
          registerAddress: 'HR_40012',
          dataType: 'INT16',
          baseValue: 3425,
          unit: 'PSI',
          pollingRateHz: 20,
          variance: 22,
          quality: 'GOOD (0x00)',
          equipment: 'Cat 6040 Excavator #01',
        },
        {
          tagId: 'TAG-DR104-PEN-RATE',
          name: 'DR104_Penetration_Rate',
          sourceProtocol: 'OPC-UA',
          nodeId: 'ns=2;s=Drilling.DR104.PenRate_m_hr',
          dataType: 'FLOAT32',
          baseValue: 24.8,
          unit: 'm/h',
          pollingRateHz: 5,
          variance: 0.7,
          quality: 'GOOD (0x00)',
          equipment: 'Pit Viper 271 Drill #04',
        },
        {
          tagId: 'TAG-DR104-BIT-DEPTH',
          name: 'DR104_Hole_Depth',
          sourceProtocol: 'Modbus-TCP',
          registerAddress: 'HR_40024',
          dataType: 'FLOAT32',
          baseValue: 14.2,
          unit: 'm',
          pollingRateHz: 5,
          variance: 0.2,
          quality: 'GOOD (0x00)',
          equipment: 'Pit Viper 271 Drill #04',
        },
        {
          tagId: 'TAG-HT402-INCLINE',
          name: 'HT402_Ramp_Incline_Grade',
          sourceProtocol: 'OPC-UA',
          nodeId: 'ns=2;s=Haulage.HT402.Incline_Pct',
          dataType: 'FLOAT32',
          baseValue: 8.2,
          unit: '%',
          pollingRateHz: 10,
          variance: 0.3,
          quality: 'GOOD (0x00)',
          equipment: 'Komatsu 930E Haul Truck #02',
        },
        {
          tagId: 'TAG-CV101-BELT-SPEED',
          name: 'CV101_Overland_Belt_Speed',
          sourceProtocol: 'Modbus-TCP',
          registerAddress: 'HR_40040',
          dataType: 'FLOAT32',
          baseValue: 4.8,
          unit: 'm/s',
          pollingRateHz: 10,
          variance: 0.1,
          quality: 'GOOD (0x00)',
          equipment: 'Main Pit Conveyor CV-101',
        },
        {
          tagId: 'TAG-CV101-BEARING-TEMP',
          name: 'CV101_Drive_Bearing_Temp',
          sourceProtocol: 'Modbus-TCP',
          registerAddress: 'HR_40048',
          dataType: 'FLOAT32',
          baseValue: 68.4,
          unit: '°C',
          pollingRateHz: 2,
          variance: 0.6,
          quality: 'GOOD (0x00)',
          equipment: 'Main Pit Conveyor CV-101',
        },
        {
          tagId: 'TAG-PS201-VOLT-L1',
          name: 'PS201_Bus_Voltage_L1',
          sourceProtocol: 'Modbus-TCP',
          registerAddress: 'HR_40102',
          dataType: 'FLOAT32',
          baseValue: 4160,
          unit: 'V',
          pollingRateHz: 1,
          variance: 15,
          quality: 'GOOD (0x00)',
          equipment: 'Pit Substation PS-201',
        },
      ],
    },
  },
  {
    id: 'c66-badge-scanner',
    name: 'Chainway C66 & Magicard Spooler',
    category: 'iot',
    role: 'Gate Turnstile & CR80 Badge Hardware',
    description:
      'Industrial 2-step QR/RFID handheld gate scanners and 300 DPI CR80 card printing spooler enforcing medical and induction compliance at mine gates.',
    tech: 'WebHID / TCP Raw 9100 + Supabase RPC',
    color: '#0284c7',
    protocols: ['HTTPS / RPC', 'TCP Raw 9100', 'CUPS / IPP'],
    security: 'Signed QR Payloads & 2-Step Gate Interlock',
    sla: '<80ms Scan Verification',
    features: [
      '2-Step Scan-Confirm Gate',
      'CR80 300 DPI Badge Spooler',
      'Medical & Induction Interlock',
    ],
  },

  // AI & Observability Mesh
  {
    id: 'langfuse-mesh',
    name: 'Langfuse AI Tracing',
    category: 'observability',
    role: 'LLM & Multi-Agent Observability',
    description:
      'Comprehensive telemetry and evaluation platform for AI agents, prompt caching efficiency, and token economics.',
    tech: 'Langfuse Cloud / Self-hosted SDK',
    color: '#ec4899',
    protocols: ['HTTPS / OpenTelemetry Exporter'],
    security: 'Encrypted API Keys & Masked PII',
    sla: 'Async flush without blocking critical path',
    features: ['Agent Execution Traces', 'Prompt Cache Tracking', 'DeepEval Benchmark Logging'],
  },
  {
    id: 'telemetry-sentry',
    name: 'Sentry & OpenTelemetry',
    category: 'observability',
    role: 'APM, Error Tracking & Metrics',
    description:
      'Full-stack distributed tracing and real-time alert system monitoring Next.js runtime and database queries.',
    tech: 'OpenTelemetry SDK + Sentry APM',
    color: '#f43f5e',
    protocols: ['OTLP / gRPC / HTTPS'],
    security: 'Source Map Masking & PII Scrubbing',
    sla: 'Real-time Exception Ingestion',
    features: ['Core Web Vitals Monitoring', 'Postgres Query Tracing', 'Fatal Crash Breadcrumbs'],
  },
];

export const BACKEND_CONNECTIONS: BackendConnection[] = [
  // Client -> Gateways
  {
    id: 'conn-portal-actions',
    source: 'portal-app',
    target: 'server-actions',
    label: 'Server RPC / Form Actions',
    protocol: 'HTTPS / RPC',
    flowType: 'data',
    description:
      'Type-safe mutation calls for shift entries, PIN verification, and department logs.',
    color: '#3b82f6',
  },
  {
    id: 'conn-portal-realtime',
    source: 'portal-app',
    target: 'supabase-realtime',
    label: 'Live Telemetry & Alerts',
    protocol: 'WebSockets (WSS)',
    flowType: 'realtime',
    description: 'Real-time push notifications for machine status updates and supervisor alerts.',
    color: '#00c573',
  },
  {
    id: 'conn-portal-fuxa',
    source: 'portal-app',
    target: 'fuxa-scada',
    label: 'HMI Control Embed / SCADA Stream',
    protocol: 'HTTPS / WebSockets',
    flowType: 'iot',
    description: 'Embedded industrial dashboard showing live excavator and dozer telemetry.',
    color: '#06b6d4',
  },
  {
    id: 'conn-portal-c66',
    source: 'portal-app',
    target: 'c66-badge-scanner',
    label: 'Gate Scan & CR80 Print Spooler',
    protocol: 'HTTPS / TCP 9100',
    flowType: 'iot',
    description: '2-step C66 QR/RFID gate verification and 300 DPI Magicard badge printing.',
    color: '#0284c7',
  },

  // Gateways -> Data & Cache
  {
    id: 'conn-actions-db',
    source: 'server-actions',
    target: 'supabase-db',
    label: 'Direct RLS Context & Zod RPC',
    protocol: 'Server RPC ──► Postgres / RLS',
    flowType: 'data',
    description:
      'Direct zero-middleman mutations forwarding authenticated user session tokens to Supabase PostgreSQL 17, enforcing 100% Row Level Security InitPlan policies with strict Zod validation.',
    color: '#3ecf8e',
  },
  {
    id: 'conn-actions-redis',
    source: 'server-actions',
    target: 'redis-cluster',
    label: 'Redlock & Rate Limiting',
    protocol: 'RESP / HTTPS Pipeline',
    flowType: 'cache',
    description:
      'Acquires distributed lock for shift rollover and checks sliding-window rate limit.',
    color: '#ef4444',
  },
  {
    id: 'conn-actions-storage',
    source: 'server-actions',
    target: 'supabase-storage',
    label: 'Signed Asset Uploads',
    protocol: 'S3 REST / HTTPS',
    flowType: 'data',
    description: 'Uploads operator photos, shift inspection media, and closeout PDF certificates.',
    color: '#10b981',
  },
  {
    id: 'conn-inngest-db',
    source: 'inngest-workers',
    target: 'supabase-db',
    label: 'Batch Rollups & Cron Sync',
    protocol: 'Postgres Connection Pooler',
    flowType: 'data',
    description: 'Executes automated hourly production rollups and data integrity reconciliations.',
    color: '#f59e0b',
  },
  {
    id: 'conn-inngest-redis',
    source: 'inngest-workers',
    target: 'redis-cluster',
    label: 'Cache Invalidation & Warmup',
    protocol: 'RESP (6379)',
    flowType: 'cache',
    description: 'Purges stale department summary caches and warms active shift records.',
    color: '#ef4444',
  },

  // Overview Topology -> Portal RPC & Database
  {
    id: 'conn-overview-portal',
    source: 'overview-engine',
    target: 'portal-app',
    label: 'Native Department Integration',
    protocol: 'React Server Components / In-Memory',
    flowType: 'data',
    description:
      'Overview topology runs natively in apps/portal on port 3000 without cross-port overhead.',
    color: '#007aff',
  },
  {
    id: 'conn-overview-db',
    source: 'overview-engine',
    target: 'supabase-db',
    label: 'Schema & RLS Introspection',
    protocol: 'Postgres Wire / SSL',
    flowType: 'data',
    description:
      'Real-time schema graph rendering from 213 migration definitions and RLS policy catalog.',
    color: '#3ecf8e',
  },

  // Observability & AI Tracing
  {
    id: 'conn-portal-sentry',
    source: 'portal-app',
    target: 'telemetry-sentry',
    label: 'Error & Tracing OTel',
    protocol: 'HTTPS / OTLP',
    flowType: 'observability',
    description: 'Captures frontend performance vitals, unhandled rejections, and network errors.',
    color: '#f43f5e',
  },
  {
    id: 'conn-actions-langfuse',
    source: 'server-actions',
    target: 'langfuse-mesh',
    label: 'Agent Runs & Prompt Telemetry',
    protocol: 'HTTPS / Langfuse API',
    flowType: 'observability',
    description:
      'Tracks LLM agent queries, token usage, evaluation scores, and prompt cache hit rates.',
    color: '#ec4899',
  },
];

// GitHub Provenance & Time Worked Telemetry from First Commit
export const GIT_PROVENANCE_METRICS = {
  firstCommitHash: 'd22deb0caafbe3126a0cf3240c5524f29ea8b225',
  firstCommitShortHash: 'd22deb0',
  firstCommitTimestamp: '2026-09-26T10:00:59+02:00',
  firstCommitDateFormatted: '26 Sep 2026, 10:00 SAST',
  firstCommitMessage: 'Initial commit: Arch-System codebase',
  totalCommits: 446,
  totalMigrations: 213,
  activeConnectorCount: 20,
  calculateTimeWorked(now: Date = new Date()) {
    const startMs = new Date(this.firstCommitTimestamp).getTime();
    const diffMs = Math.max(0, now.getTime() - startMs);
    const totalCalendarHours = Math.max(24, Math.floor(diffMs / 3600000));
    const calendarDays = Math.max(1, Math.floor(totalCalendarHours / 24));
    const remainderHours = totalCalendarHours % 24;
    // Active engineering hours worked derived from 433 commits & 213 migrations (~1.45h per commit + deep architecture sessions)
    const activeEngineeringHours = Math.max(382, Math.round(this.totalCommits * 1.45));
    return {
      calendarDays,
      remainderHours,
      totalCalendarHours,
      activeEngineeringHours,
      formattedSpan: `${calendarDays}d ${remainderHours}h (${totalCalendarHours.toLocaleString()}h elapsed)`,
      formattedActiveWork: `${activeEngineeringHours}h Active Engineering`,
    };
  },
};

export interface FlowDiagramPipeline {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  nodes: Array<{
    id: string;
    step: string;
    title: string;
    role: string;
    protocol: string;
    detail: string;
    color: string;
  }>;
}

export const EXAMPLE_BACKEND_FLOW_PIPELINES: FlowDiagramPipeline[] = [
  {
    id: 'scada-production-flow',
    title: 'Pipeline A · Industrial SCADA Telemetry → Production Auto-Report',
    subtitle:
      'How field excavator/haulage sensors stream into PostgreSQL 17 and auto-build Monthly Production Reports',
    badge: '10Hz OPC-UA / Modbus-TCP',
    nodes: [
      {
        id: 'plc-sensors',
        step: 'BLOCK 01',
        title: 'Pit Fleet PLCs & Sensors',
        role: 'Cat 6040 / Komatsu 930E / Pit Viper',
        protocol: 'Modbus-TCP / OPC-UA',
        detail: 'Streams bucket payload (t), hydraulic PSI, SMR hours, and drill hole depth.',
        color: '#0284c7',
      },
      {
        id: 'fuxa-gateway',
        step: 'BLOCK 02',
        title: 'FUXA SCADA Gateway',
        role: 'Edge Protocol Concentrator',
        protocol: 'WSS / JSON-RPC',
        detail: 'Normalizes 1,284 registers across 16 nodes with 0.0% frame loss at 10Hz.',
        color: '#06b6d4',
      },
      {
        id: 'server-action-rpc',
        step: 'BLOCK 03',
        title: 'Next.js 16 Server Action / Inngest',
        role: '@repo/contract Validation',
        protocol: 'Direct Server RPC',
        detail: 'Validates payload via Zod schemas, acquires Redlock mutex, and tags cache.',
        color: '#2563eb',
      },
      {
        id: 'postgres-rls',
        step: 'BLOCK 04',
        title: 'Supabase PostgreSQL 17',
        role: 'hourly_loads & production_monthly_targets',
        protocol: 'Postgres Wire (5432)',
        detail: 'Persists shift loads, reconciles against Monthly Coal/Waste Targets under RLS.',
        color: '#10b981',
      },
      {
        id: 'dept-consumers',
        step: 'BLOCK 05',
        title: 'Production & Control Room UI',
        role: '/production & /control-room',
        protocol: 'RSC + Realtime WSS',
        detail: 'Renders Passed Month & Current Month Production Reports and live Target Banners.',
        color: '#7c3aed',
      },
    ],
  },
  {
    id: 'engineering-shift-cap-flow',
    title: 'Pipeline B · Cross-Department 12-Hour Shift Delay Sync',
    subtitle:
      'How Engineering breakdown hours automatically constrain Control Room shift operations to a 12.0h shift budget',
    badge: '12.0h Shift Interlock',
    nodes: [
      {
        id: 'eng-book-in',
        step: 'BLOCK 01',
        title: 'Engineering Breakdown Log',
        role: '/engineering/breakdowns',
        protocol: 'BookInForm Action',
        detail:
          'Engineer books in machine breakdown with Shift Delay Hours (e.g. 6.0h on 12h shift).',
        color: '#7c3aed',
      },
      {
        id: 'db-trigger',
        step: 'BLOCK 02',
        title: 'PostgreSQL Breakdown Trigger',
        role: 'trg_compute_breakdown_shift_delay',
        protocol: 'PL/pgSQL Trigger',
        detail: 'Computes and clamps breakdown delay_hours [0..12h] on public.breakdowns.',
        color: '#10b981',
      },
      {
        id: 'redis-invalidation',
        step: 'BLOCK 03',
        title: 'Hybrid L1/L2 Redis Cache',
        role: 'Tag Invalidation Pipeline',
        protocol: 'RESP / Upstash REST',
        detail: 'Invalidates machine_operations and breakdown cache tags across departments.',
        color: '#f59e0b',
      },
      {
        id: 'cr-budget-calc',
        step: 'BLOCK 04',
        title: 'Control Room Shift Budget Engine',
        role: '/control-room/machine-operations',
        protocol: 'SSR + Server Action Guard',
        detail:
          'Calculates Remaining Shift Cap = 12.0h − Engineering Delay (e.g. 12h − 6h = 6.0h).',
        color: '#dc2626',
      },
      {
        id: 'cr-enforced-log',
        step: 'BLOCK 05',
        title: 'Enforced Delay & SMR Entry',
        role: 'DelayEntriesForm & saveDelayEntriesBatch',
        protocol: 'Strict 12h Cap Check',
        detail:
          'Blocks any Control Room operation or delay entry exceeding the remaining 6.0h cap.',
        color: '#2563eb',
      },
    ],
  },
  {
    id: 'access-control-card-flow',
    title: 'Pipeline C · Access Control Employee Photo & CR80 Badge Provisioning',
    subtitle:
      'Single-transaction employee registration, portrait photo capture, operator sync, and Magicard 300 DPI printing',
    badge: 'CR80 + C66 Sync',
    nodes: [
      {
        id: 'photo-studio',
        step: 'BLOCK 01',
        title: 'Neo 300 Print Studio',
        role: '/access-control/print-cards',
        protocol: 'Canvas 400×500 Crop',
        detail:
          'Captures employee portrait photo, SA ID, medical/induction expiry & clearance zone.',
        color: '#0284c7',
      },
      {
        id: 'upsert-action',
        step: 'BLOCK 02',
        title: 'upsertEmployeeForCardPrinting',
        role: 'Server Action Provisioner',
        protocol: 'Authenticated RPC',
        detail:
          'Validates compliance dates and writes simultaneously to personnel, employees & badges.',
        color: '#2563eb',
      },
      {
        id: 'operator-sync-trg',
        step: 'BLOCK 03',
        title: 'Cross-Department Operator Sync',
        role: 'trg_sync_personnel_to_operators',
        protocol: 'PL/pgSQL Trigger',
        detail:
          'Auto-provisions active personnel into public.operators for Control Room & Drilling.',
        color: '#10b981',
      },
      {
        id: 'magicard-spooler',
        step: 'BLOCK 04',
        title: 'Magicard Neo 300 Spooler',
        role: 'card_print_jobs Queue',
        protocol: 'TCP Raw 9100 / IPP',
        detail: 'Renders dual-sided CR80 PVC badge with live photo, QR payload, and RFID UID.',
        color: '#7c3aed',
      },
      {
        id: 'c66-turnstile',
        step: 'BLOCK 05',
        title: 'Chainway C66 Gate Scanner',
        role: '/access-control/qr-codes',
        protocol: '2-Step Scan-Confirm',
        detail: 'Verifies QR/RFID credential and medical/induction interlocks at mine turnstiles.',
        color: '#059669',
      },
    ],
  },
];
