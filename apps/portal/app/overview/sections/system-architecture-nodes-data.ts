type NodeCategory = 'edge' | 'departments' | 'gateway' | 'cache' | 'database' | 'observability';

export type PipelineFilterId = 'all' | 'scada' | 'shift-budget' | 'access-badge' | 'auth-rls';

export interface ArchCanvasNode {
  id: string;
  col: number; // 0..5
  row: number; // 0..4
  category: NodeCategory;
  typeLabel: string;
  title: string;
  subtitle: string;
  metricBadge: string;
  protocol: string;
  status: 'active' | 'synced' | 'enforced';
  color: string;
  iconName:
    | 'lock'
    | 'radio'
    | 'printer'
    | 'globe'
    | 'building'
    | 'activity'
    | 'qrcode'
    | 'database'
    | 'server'
    | 'shield'
    | 'cpu'
    | 'zap'
    | 'refresh'
    | 'harddrive'
    | 'bot'
    | 'sparkles';
  filePath: string;
  description: string;
  inputs: string[];
  outputs: string[];
  pipelines: Array<PipelineFilterId>;
}

export interface ArchCanvasEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  protocol: string;
  color: string;
  animated?: boolean;
  pipelines: Array<PipelineFilterId>;
}

export const CANVAS_NODES: ArchCanvasNode[] = [
  // COLUMN 0: EDGE, AUTH & INDUSTRIAL FIELD HARDWARE
  {
    id: 'edge-proxy',
    col: 0,
    row: 0,
    category: 'edge',
    typeLabel: 'TRIGGER · EDGE PROXY',
    title: 'Next.js 16 Proxy & Auth',
    subtitle: 'JWT + PKCE + CSP Nonce Gate',
    metricBadge: '<2ms Edge',
    protocol: 'HTTPS / HttpOnly',
    status: 'enforced',
    color: '#2563eb',
    iconName: 'lock',
    filePath: 'apps/portal/proxy.ts → server/proxy.ts',
    description:
      'Intercepts all incoming requests, refreshes Supabase JWT sessions, resolves Redis-cached employee RBAC claims, and gates DEPARTMENT_ROUTES.',
    inputs: ['Browser HTTPS Request', 'Supabase PKCE Cookie'],
    outputs: ['Verified Session Context', 'RBAC Department Claims'],
    pipelines: ['all', 'auth-rls', 'shift-budget', 'access-badge'],
  },
  {
    id: 'pit-plc-sensors',
    col: 0,
    row: 1.5,
    category: 'edge',
    typeLabel: 'IOT TRIGGER · PIT FLEET',
    title: 'Pit Fleet PLCs & Sensors',
    subtitle: 'Cat 6040 · 930E · Pit Viper',
    metricBadge: '10Hz Stream',
    protocol: 'Modbus-TCP / OPC-UA',
    status: 'active',
    color: '#0284c7',
    iconName: 'radio',
    filePath: 'packages/connectors/src/scada/',
    description:
      'Streams real-time excavator payload tons, haul truck cycle SMR hours, hydraulic pressure, and drill penetration telemetry from pit machinery.',
    inputs: ['CAN-Bus 250kbps', 'Onboard PLC Registers'],
    outputs: ['10Hz Tag Frames', 'SMR & Payload Counters'],
    pipelines: ['all', 'scada'],
  },
  {
    id: 'gate-badge-hw',
    col: 0,
    row: 3,
    category: 'edge',
    typeLabel: 'HARDWARE · GATE & PVC',
    title: 'C66 Scanners & Neo 300',
    subtitle: 'Turnstile QR/RFID & Card Spooler',
    metricBadge: '300 DPI / 2D QR',
    protocol: 'TCP 9100 / Android HID',
    status: 'active',
    color: '#7c3aed',
    iconName: 'printer',
    filePath: 'apps/portal/app/(departments)/access-control/',
    description:
      'Physical mine gate Chainway C66 handheld/turnstile scanners and Magicard Neo 300 dual-sided CR80 PVC badge printers.',
    inputs: ['Employee Portrait & ID', 'Turnstile QR/RFID Scan'],
    outputs: ['CR80 Badge Job', '2-Step Gate Check-In'],
    pipelines: ['all', 'access-badge'],
  },

  // COLUMN 1: 8 CORE DEPARTMENT MODULES (apps/portal)
  {
    id: 'dept-hub-admin',
    col: 1,
    row: 0,
    category: 'departments',
    typeLabel: 'MODULE · COMMAND',
    title: 'Central Hub & Admin',
    subtitle: '/hub · /admin · /overview',
    metricBadge: '14 Routes',
    protocol: 'RSC + CommandBar ⌘K',
    status: 'active',
    color: '#4f46e5',
    iconName: 'globe',
    filePath: 'apps/portal/app/hub/ & app/admin/',
    description:
      'Central executive command center, multi-site fleet registry, employee RBAC management, connector health, and live architecture topology.',
    inputs: ['Verified Session Context', 'Live KPI Rollups'],
    outputs: ['Admin Mutations', 'Cross-Module Navigation'],
    pipelines: ['all', 'auth-rls'],
  },
  {
    id: 'dept-prod-drill',
    col: 1,
    row: 1.1,
    category: 'departments',
    typeLabel: 'MODULE · PIT OPS',
    title: 'Production & Drilling',
    subtitle: '/production · /drilling',
    metricBadge: '16 Routes',
    protocol: 'React 19 + TanStack Query',
    status: 'active',
    color: '#16a34a',
    iconName: 'building',
    filePath: 'apps/portal/app/(departments)/production & drilling',
    description:
      'Coal production tonnage, hourly excavator loads, haulage cycles, blast hole drilling logs, and A4 Landscape Shift PDF reports.',
    inputs: ['Operator Shift Logs', 'SCADA Tag Stream'],
    outputs: ['Hourly Load Batches', 'Shift PDF Report Binary'],
    pipelines: ['all', 'scada'],
  },
  {
    id: 'dept-cr-eng',
    col: 1,
    row: 2.2,
    category: 'departments',
    typeLabel: 'MODULE · DISPATCH & FLEET',
    title: 'Control Room & Engineering',
    subtitle: '/control-room · /engineering',
    metricBadge: '15 Routes',
    protocol: '12h Shift Cap Guard',
    status: 'enforced',
    color: '#dc2626',
    iconName: 'activity',
    filePath: 'apps/portal/app/(departments)/control-room & engineering',
    description:
      'Enforces coupled 12.0h shift budget: Engineering breakdown hours automatically deduct from Control Room available operating hours.',
    inputs: ['Breakdown Job Cards', 'SMR & Delay Entries'],
    outputs: ['Clamped 12h Shift Log', 'Shift Closeout Certificate'],
    pipelines: ['all', 'shift-budget'],
  },
  {
    id: 'dept-access-safety',
    col: 1,
    row: 3.3,
    category: 'departments',
    typeLabel: 'MODULE · SECURITY & HSE',
    title: 'Access Control & Safety',
    subtitle: '/access-control · /database',
    metricBadge: '11 Routes',
    protocol: 'Muster + Medical Interlock',
    status: 'enforced',
    color: '#0284c7',
    iconName: 'qrcode',
    filePath: 'apps/portal/app/(departments)/access-control & database',
    description:
      'Real-time gate muster station, Neo 300 photo studio, C66 QR verification, breathalyzer interlocks, and database schema explorer.',
    inputs: ['C66 Scan Payload', 'Portrait Photo Crop'],
    outputs: ['upsertEmployeeForCardPrinting', 'Gate Access Grant/Deny'],
    pipelines: ['all', 'access-badge', 'auth-rls'],
  },

  // COLUMN 2: CONTRACT, RPC & INGEST GATEWAY
  {
    id: 'server-actions-rpc',
    col: 2,
    row: 0.5,
    category: 'gateway',
    typeLabel: 'RPC GATEWAY · ACTIONS',
    title: 'Server Actions & Route API',
    subtitle: 'Auth → RBAC → Validate → Mutate',
    metricBadge: 'Zero-Proxy',
    protocol: 'Next.js 16 Server RPC',
    status: 'enforced',
    color: '#2563eb',
    iconName: 'server',
    filePath: 'apps/portal/app/**/actions.ts',
    description:
      'Executes all server-side mutations: verifies user session, checks employee role, validates payload via @repo/contract, rate-limits, and invalidates cache tags.',
    inputs: ['Department Form Action', 'Session JWT'],
    outputs: ['Validated DTO', 'revalidateTag() Signal'],
    pipelines: ['all', 'auth-rls', 'shift-budget', 'access-badge'],
  },
  {
    id: 'zod-contract',
    col: 2,
    row: 1.8,
    category: 'gateway',
    typeLabel: 'SCHEMA GUARD · ZOD',
    title: '@repo/contract Validator',
    subtitle: 'Strict Type & Drift Enforcement',
    metricBadge: '100% Typed',
    protocol: 'Zod v3 Schema AST',
    status: 'enforced',
    color: '#059669',
    iconName: 'shield',
    filePath: 'packages/contract/src/index.ts',
    description:
      'Single source of truth for domain schemas across all 8 departments. Audited continuously against PostgreSQL 17 columns via pnpm audit:drift.',
    inputs: ['Raw Client Payload', 'Webhook Body'],
    outputs: ['Parsed Domain Contract', 'Structured ValidationError'],
    pipelines: ['all', 'auth-rls', 'shift-budget', 'access-badge'],
  },
  {
    id: 'fuxa-scada-gw',
    col: 2,
    row: 3.1,
    category: 'gateway',
    typeLabel: 'IOT CONCENTRATOR',
    title: 'FUXA SCADA Gateway',
    subtitle: 'OPC-UA / Modbus Normalizer',
    metricBadge: 'Sub-50ms',
    protocol: 'WSS / JSON-RPC',
    status: 'active',
    color: '#0284c7',
    iconName: 'cpu',
    filePath: 'packages/connectors/src/fuxa/',
    description:
      'Aggregates high-frequency PLC tag streams from excavators, drills, and weighbridges into normalized JSON-RPC batches.',
    inputs: ['10Hz PLC Tag Frames'],
    outputs: ['Normalized Telemetry Batch', 'Equipment Alarm Events'],
    pipelines: ['all', 'scada'],
  },

  // COLUMN 3: HYBRID REDIS CACHE & INNGEST ORCHESTRATION
  {
    id: 'hybrid-redis',
    col: 3,
    row: 0.9,
    category: 'cache',
    typeLabel: 'CACHE & MUTEX · L1/L2',
    title: 'Hybrid Redis 7.4 Cluster',
    subtitle: 'In-Memory LRU + Upstash REST',
    metricBadge: 'Sub-2ms Hit',
    protocol: 'RESP / HTTPS Pipeline',
    status: 'active',
    color: '#d97706',
    iconName: 'zap',
    filePath: 'packages/redis/src/index.ts',
    description:
      'Two-tier caching & locking engine: L1 process LRU cache paired with L2 Upstash Redis 7.4, sliding-window rate limiters, and Redlock shift mutexes.',
    inputs: ['RBAC Lookup', 'Redlock Request', 'Tag Invalidation'],
    outputs: ['Cached Employee Profile', 'Distributed Shift Lock'],
    pipelines: ['all', 'auth-rls', 'shift-budget'],
  },
  {
    id: 'inngest-workers',
    col: 3,
    row: 2.5,
    category: 'cache',
    typeLabel: 'DURABLE WORKFLOWS',
    title: 'Inngest & Event Workers',
    subtitle: 'Rollups, Spooler & Sync Jobs',
    metricBadge: '20 Connectors',
    protocol: 'Event-Driven Cron/RPC',
    status: 'active',
    color: '#7c3aed',
    iconName: 'refresh',
    filePath: 'packages/agents/ & apps/portal/app/api/',
    description:
      'Executes durable background workflows: hourly production rollups, Magicard Neo 300 print queue dispatch, and cross-department cache warmups.',
    inputs: ['Telemetry Batch', 'Card Print Queue Event'],
    outputs: ['SQL Rollup Upsert', 'TCP 9100 Printer Stream'],
    pipelines: ['all', 'scada', 'access-badge'],
  },

  // COLUMN 4: SUPABASE DATA PLATFORM (packages/supabase + packages/database)
  {
    id: 'supabase-primary',
    col: 4,
    row: 0.4,
    category: 'database',
    typeLabel: 'PRIMARY DB · POSTGRES 17',
    title: 'Supabase PostgreSQL 17',
    subtitle: '189 Migrations · 100% RLS InitPlan',
    metricBadge: '35+ Tables',
    protocol: 'PgBouncer Transaction Pool',
    status: 'enforced',
    color: '#10b981',
    iconName: 'database',
    filePath: 'packages/database/migrations/ (001..189)',
    description:
      'Primary transactional datastore enforcing Row Level Security on every table via (select auth.uid()) InitPlan policies and atomic PL/pgSQL triggers.',
    inputs: ['Authenticated Server RPC', 'PL/pgSQL Trigger Events'],
    outputs: ['ACID Row Commit', 'WAL Realtime Change Event'],
    pipelines: ['all', 'auth-rls', 'scada', 'shift-budget', 'access-badge'],
  },
  {
    id: 'supabase-replica',
    col: 4,
    row: 1.8,
    category: 'database',
    typeLabel: 'READ REPLICA · ANALYTICS',
    title: 'Read Replica Client Pool',
    subtitle: 'createReadReplicaClient()',
    metricBadge: 'Zero Lock',
    protocol: 'Read-Only SSL Pool',
    status: 'synced',
    color: '#059669',
    iconName: 'harddrive',
    filePath: 'packages/supabase/src/server.ts',
    description:
      'Offloads heavy analytical queries, multi-site shift PDF report aggregations, and historical KPI charts from the primary transactional writer.',
    inputs: ['Reports & Dashboard SSR Queries'],
    outputs: ['Site-Grouped Shift Dataset', 'Executive KPI Series'],
    pipelines: ['all', 'scada'],
  },
  {
    id: 'plpgsql-triggers',
    col: 4,
    row: 3.1,
    category: 'database',
    typeLabel: 'DB ENGINE · TRIGGERS',
    title: 'PL/pgSQL Domain Triggers',
    subtitle: 'Shift Delay Clamp & Operator Sync',
    metricBadge: 'SET search_path',
    protocol: 'Internal Kernel Trigger',
    status: 'enforced',
    color: '#0d9488',
    iconName: 'shield',
    filePath: 'packages/database/migrations/185..189',
    description:
      'Executes trg_compute_breakdown_shift_delay (clamping 0..12h breakdown delays) and trg_sync_personnel_to_operators across departments automatically.',
    inputs: ['INSERT/UPDATE on breakdowns & personnel'],
    outputs: ['Clamped delay_hours', 'Synced public.operators Row'],
    pipelines: ['all', 'shift-budget', 'access-badge'],
  },

  // COLUMN 5: AI INTELLIGENCE, REALTIME & OBSERVABILITY MESH
  {
    id: 'supabase-realtime-storage',
    col: 5,
    row: 0.6,
    category: 'observability',
    typeLabel: 'BROADCAST & STORAGE',
    title: 'Realtime WAL & S3 Buckets',
    subtitle: 'Live Push + Portrait/PDF Storage',
    metricBadge: 'WebSocket + S3',
    protocol: 'WSS Multiplex / S3 REST',
    status: 'active',
    color: '#10b981',
    iconName: 'radio',
    filePath: 'packages/supabase/src/realtime.ts',
    description:
      'Broadcasts PostgreSQL WAL row changes to subscribed Control Room / Muster clients and stores employee badge photos & signed closeout PDFs.',
    inputs: ['WAL Commit Stream', 'Signed Asset Upload'],
    outputs: ['Client Live UI Patch', 'Signed CDN Asset URL'],
    pipelines: ['all', 'scada', 'access-badge'],
  },
  {
    id: 'ai-pgvector-rag',
    col: 5,
    row: 1.9,
    category: 'observability',
    typeLabel: 'AI ENGINE · PGVECTOR',
    title: 'AI Copilot & Vector RAG',
    subtitle: 'HNSW Embeddings + Agent Mesh',
    metricBadge: '1536-dim HNSW',
    protocol: 'Claude / OpenAI + MCP',
    status: 'active',
    color: '#8b5cf6',
    iconName: 'bot',
    filePath: 'packages/agents/ & apps/portal/app/admin/ai-metrics',
    description:
      'Semantic search over mine SOPs, shift logs, and maintenance manuals with token budget enforcement and ZAR cost telemetry.',
    inputs: ['Semantic Query', 'Shift Context Slice'],
    outputs: ['Grounded Diagnostic Answer', 'Token Ledger Entry'],
    pipelines: ['all'],
  },
  {
    id: 'otel-sentry-langfuse',
    col: 5,
    row: 3.1,
    category: 'observability',
    typeLabel: 'APM & AUDIT TELEMETRY',
    title: 'OpenTelemetry + Sentry',
    subtitle: 'Distributed Traces & Langfuse',
    metricBadge: '99.98% SLA',
    protocol: 'OTLP / HTTPS',
    status: 'synced',
    color: '#e11d48',
    iconName: 'sparkles',
    filePath: 'apps/portal/instrumentation.ts',
    description:
      'End-to-end OpenTelemetry span export, Sentry error boundary capture, and Langfuse LLM trace observability across all server actions.',
    inputs: ['Server Action Spans', 'Client Vitals'],
    outputs: ['Trace Waterfall', 'Audit Compliance Ledger'],
    pipelines: ['all', 'auth-rls'],
  },
];

export const CANVAS_EDGES: ArchCanvasEdge[] = [
  // Edge -> Departments
  {
    id: 'e-proxy-hub',
    source: 'edge-proxy',
    target: 'dept-hub-admin',
    label: 'RBAC Session',
    protocol: 'JWT + Claims',
    color: '#2563eb',
    animated: true,
    pipelines: ['all', 'auth-rls'],
  },
  {
    id: 'e-proxy-prod',
    source: 'edge-proxy',
    target: 'dept-prod-drill',
    label: 'Dept Guard',
    protocol: 'SSR Cookie',
    color: '#2563eb',
    pipelines: ['all', 'auth-rls'],
  },
  {
    id: 'e-proxy-cr',
    source: 'edge-proxy',
    target: 'dept-cr-eng',
    label: 'Supervisor Auth',
    protocol: 'SSR Cookie',
    color: '#2563eb',
    pipelines: ['all', 'auth-rls', 'shift-budget'],
  },
  {
    id: 'e-proxy-access',
    source: 'edge-proxy',
    target: 'dept-access-safety',
    label: 'Security Clearance',
    protocol: 'SSR Cookie',
    color: '#2563eb',
    pipelines: ['all', 'auth-rls', 'access-badge'],
  },

  // Hardware/IoT -> Gateways & Modules
  {
    id: 'e-plc-fuxa',
    source: 'pit-plc-sensors',
    target: 'fuxa-scada-gw',
    label: '10Hz Telemetry',
    protocol: 'OPC-UA / Modbus',
    color: '#0284c7',
    animated: true,
    pipelines: ['all', 'scada'],
  },
  {
    id: 'e-hw-access',
    source: 'gate-badge-hw',
    target: 'dept-access-safety',
    label: 'QR Scan / Print',
    protocol: 'TCP 9100 / HID',
    color: '#7c3aed',
    animated: true,
    pipelines: ['all', 'access-badge'],
  },

  // Departments -> Server Actions & Contract
  {
    id: 'e-hub-actions',
    source: 'dept-hub-admin',
    target: 'server-actions-rpc',
    label: 'Admin RPC',
    protocol: 'Server Action',
    color: '#4f46e5',
    pipelines: ['all', 'auth-rls'],
  },
  {
    id: 'e-prod-actions',
    source: 'dept-prod-drill',
    target: 'server-actions-rpc',
    label: 'Shift Log Submit',
    protocol: 'Server Action',
    color: '#16a34a',
    animated: true,
    pipelines: ['all', 'scada'],
  },
  {
    id: 'e-cr-actions',
    source: 'dept-cr-eng',
    target: 'server-actions-rpc',
    label: '12h Budget & Breakdown',
    protocol: 'saveDelayEntriesBatch',
    color: '#dc2626',
    animated: true,
    pipelines: ['all', 'shift-budget'],
  },
  {
    id: 'e-access-actions',
    source: 'dept-access-safety',
    target: 'server-actions-rpc',
    label: 'Badge & Gate RPC',
    protocol: 'upsertEmployee',
    color: '#0284c7',
    animated: true,
    pipelines: ['all', 'access-badge'],
  },

  // Server Actions <-> Zod Contract & Redis
  {
    id: 'e-actions-zod',
    source: 'server-actions-rpc',
    target: 'zod-contract',
    label: 'Schema Parse',
    protocol: '@repo/contract',
    color: '#059669',
    animated: true,
    pipelines: ['all', 'auth-rls', 'shift-budget', 'access-badge'],
  },
  {
    id: 'e-actions-redis',
    source: 'server-actions-rpc',
    target: 'hybrid-redis',
    label: 'Rate-Limit & Redlock',
    protocol: 'Upstash REST / L1',
    color: '#d97706',
    animated: true,
    pipelines: ['all', 'auth-rls', 'shift-budget'],
  },

  // FUXA & Contract -> Inngest & Primary DB
  {
    id: 'e-fuxa-inngest',
    source: 'fuxa-scada-gw',
    target: 'inngest-workers',
    label: 'Tag Stream Batch',
    protocol: 'WSS / JSON-RPC',
    color: '#0284c7',
    animated: true,
    pipelines: ['all', 'scada'],
  },
  {
    id: 'e-zod-primary',
    source: 'zod-contract',
    target: 'supabase-primary',
    label: 'Validated SQL RPC',
    protocol: 'Direct RLS Context',
    color: '#10b981',
    animated: true,
    pipelines: ['all', 'auth-rls', 'shift-budget', 'access-badge'],
  },

  // Redis & Inngest -> Supabase Primary / Replica
  {
    id: 'e-redis-primary',
    source: 'hybrid-redis',
    target: 'supabase-primary',
    label: 'Mutex Commit & Tag Sync',
    protocol: 'PgBouncer SSL',
    color: '#d97706',
    pipelines: ['all', 'shift-budget'],
  },
  {
    id: 'e-inngest-primary',
    source: 'inngest-workers',
    target: 'supabase-primary',
    label: 'Hourly Production Rollup',
    protocol: 'Batch Upsert',
    color: '#7c3aed',
    animated: true,
    pipelines: ['all', 'scada', 'access-badge'],
  },
  {
    id: 'e-prod-replica',
    source: 'dept-prod-drill',
    target: 'supabase-replica',
    label: 'Shift PDF & KPI Read',
    protocol: 'Read Replica Pool',
    color: '#059669',
    pipelines: ['all', 'scada'],
  },

  // Primary DB -> Triggers, Realtime, AI & Observability
  {
    id: 'e-primary-triggers',
    source: 'supabase-primary',
    target: 'plpgsql-triggers',
    label: 'After Insert/Update',
    protocol: 'PL/pgSQL Kernel',
    color: '#0d9488',
    animated: true,
    pipelines: ['all', 'shift-budget', 'access-badge'],
  },
  {
    id: 'e-primary-realtime',
    source: 'supabase-primary',
    target: 'supabase-realtime-storage',
    label: 'WAL Change Stream',
    protocol: 'Logical Replication',
    color: '#10b981',
    animated: true,
    pipelines: ['all', 'scada', 'access-badge'],
  },
  {
    id: 'e-replica-ai',
    source: 'supabase-replica',
    target: 'ai-pgvector-rag',
    label: 'HNSW Vector Index',
    protocol: 'pgvector Cosine',
    color: '#8b5cf6',
    pipelines: ['all'],
  },
  {
    id: 'e-actions-otel',
    source: 'server-actions-rpc',
    target: 'otel-sentry-langfuse',
    label: 'OTel Spans & Errors',
    protocol: 'OTLP / Sentry SDK',
    color: '#e11d48',
    pipelines: ['all', 'auth-rls'],
  },
];

export const COLUMN_HEADERS = [
  { col: 0, title: '01 · Edge & Field Triggers', subtitle: 'Auth Proxy, PLCs & Gate HW' },
  { col: 1, title: '02 · 8 Department Modules', subtitle: 'Next.js 16 App Router UI' },
  { col: 2, title: '03 · RPC & Contract Gate', subtitle: 'Server Actions, Zod & SCADA' },
  { col: 3, title: '04 · Cache & Orchestration', subtitle: 'Hybrid Redis 7.4 & Inngest' },
  { col: 4, title: '05 · Data Platform (RLS)', subtitle: 'PostgreSQL 17 Primary & Replica' },
  { col: 5, title: '06 · Realtime, AI & OTel', subtitle: 'WAL Broadcast, RAG & Sentry' },
];

export const PIPELINE_FILTERS: Array<{
  id: PipelineFilterId;
  label: string;
  badge: string;
}> = [
  { id: 'all', label: 'Complete Architecture (All Nodes)', badge: '16 Nodes · 21 Wires' },
  { id: 'scada', label: 'SCADA → Production Auto-Report', badge: 'Pipeline A' },
  { id: 'shift-budget', label: '12h Shift Budget & Breakdown Lock', badge: 'Pipeline B' },
  { id: 'access-badge', label: 'Neo 300 Badge & C66 Gate Sync', badge: 'Pipeline C' },
  { id: 'auth-rls', label: 'Zero-Trust Auth → Zod → Postgres RLS', badge: 'Security Gate' },
];

// Geometry constants for SVG coordinate calculation
export const COL_WIDTH = 285;
export const COL_GAP = 68;
export const LEFT_PAD = 28;
const TOP_PAD = 76;
const ROW_HEIGHT = 152;
export const NODE_WIDTH = 256;
export const NODE_HEIGHT = 116;

export function getNodePosition(node: ArchCanvasNode) {
  const x = LEFT_PAD + node.col * (COL_WIDTH + COL_GAP);
  const y = TOP_PAD + node.row * ROW_HEIGHT;
  return { x, y };
}
