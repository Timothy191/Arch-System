// Departments data
export const DEPARTMENTS = [
  {
    id: "drilling",
    name: "Drilling",
    slug: "drilling",
    description: "Drilling operations, penetration rates, and rig telemetry",
    color: "#3ecf8e",
    routes: [
      {
        path: "/drilling",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/drilling/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/drilling/machines",
        name: "Machines",
        description: "Department equipment & drill rigs",
      },
      {
        path: "/drilling/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/drilling/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/drilling/operational-delays",
        name: "Operational Delays",
        description: "Drill delay logging and tracking",
      },
      {
        path: "/drilling/shift-coverage",
        name: "Shift Coverage",
        description: "Crew and rig roster assignments",
      },
      {
        path: "/drilling/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["drilling_operator", "supervisor", "admin"],
  },
  {
    id: "production",
    name: "Production",
    slug: "production",
    description: "Coal production, pit excavation, and haulage tracking",
    color: "#00c573",
    routes: [
      {
        path: "/production",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/production/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/production/machines",
        name: "Machines",
        description: "Excavators, haul trucks, and dozers",
      },
      {
        path: "/production/hourly-loads",
        name: "Hourly Loads",
        description: "Payload tons per hour & cycle metrics",
      },
      {
        path: "/production/excavator-activity",
        name: "Excavator Activity",
        description: "Loading cycles & payload distribution",
      },
      {
        path: "/production/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/production/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/production/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["production_operator", "supervisor", "admin"],
  },
  {
    id: "access-control",
    name: "Access Control",
    slug: "access-control",
    description: "Mine gate entry/exit, RFID badge verification, and personnel tracking",
    color: "#60a5fa",
    routes: [
      {
        path: "/access-control",
        name: "Dashboard",
        description: "Today's summary and real-time gate muster",
      },
      {
        path: "/access-control/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/access-control/machines",
        name: "Machines",
        description: "Turnstiles, boom gates & scanners",
      },
      {
        path: "/access-control/history",
        name: "History",
        description: "Past daily logs & entry timestamps",
      },
      {
        path: "/access-control/reports",
        name: "Reports",
        description: "Aggregate data + CSV muster reports",
      },
      {
        path: "/access-control/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["access_control_officer", "access_control", "supervisor", "admin"],
  },
  {
    id: "engineering",
    name: "Engineering",
    slug: "engineering",
    description: "Technical support, predictive maintenance, and breakdown dispatch",
    color: "#a78bfa",
    routes: [
      {
        path: "/engineering",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/engineering/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/engineering/machines",
        name: "Machines",
        description: "Department equipment & health",
      },
      {
        path: "/engineering/breakdowns",
        name: "Breakdowns",
        description: "Active mechanical/electrical breakdown tickets",
      },
      {
        path: "/engineering/engineering-notes",
        name: "Engineering Notes",
        description: "Maintenance logs & predictive alerts",
      },
      {
        path: "/engineering/machine-operations",
        name: "Machine Operations",
        description: "OEM operating limits and compliance",
      },
      {
        path: "/engineering/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/engineering/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/engineering/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["engineer", "supervisor", "admin"],
  },
  {
    id: "control-room",
    name: "Control Room",
    slug: "control-room",
    description: "Central monitoring, real-time SCADA telemetry, and shift closeouts",
    color: "#007aff",
    routes: [
      {
        path: "/control-room",
        name: "Dashboard",
        description: "Live SCADA overview and alarm status",
      },
      {
        path: "/control-room/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/control-room/machines",
        name: "Machines",
        description: "Pit-wide heavy machinery telemetry",
      },
      {
        path: "/control-room/roll-over",
        name: "Roll Over",
        description: "End-of-shift handover & closeout signing",
      },
      {
        path: "/control-room/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/control-room/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/control-room/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["control_room_operator", "admin", "supervisor", "operator"],
  },
  {
    id: "access-card-actions",
    name: "Access Card Actions",
    slug: "access-card-actions",
    description: "RFID badge batch printing, template provisioning, and security chip programming",
    color: "#f59e0b",
    routes: [
      {
        path: "/access-card-actions",
        name: "Dashboard",
        description: "Card print queue and batch status",
      },
      {
        path: "/access-card-actions/print-cards",
        name: "Print Cards",
        description: "Industrial card print jobs and batch queues",
      },
      {
        path: "/access-card-actions/qr-codes",
        name: "QR Codes",
        description: "Batch QR generation and encoding",
      },
      {
        path: "/access-card-actions/daily-log",
        name: "Daily Log",
        description: "Card issuance logs and audit records",
      },
      {
        path: "/access-card-actions/machines",
        name: "Machines",
        description: "Evolis & Zebra industrial badge printers",
      },
      {
        path: "/access-card-actions/history",
        name: "History",
        description: "Printed cards and badge assignment records",
      },
      {
        path: "/access-card-actions/reports",
        name: "Reports",
        description: "Badge provisioning & security audits",
      },
      {
        path: "/access-card-actions/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["access_control", "supervisor", "admin"],
  },
];

// Navigation graph nodes and edges for XYFlow
const _NAVIGATION_GRAPH = {
  nodes: [
    // Root
    { id: "hub", type: "root", label: "Hub", x: 400, y: 50 },
    { id: "login", type: "auth", label: "Login", x: 100, y: 50 },

    // Departments
    {
      id: "drilling",
      type: "department",
      label: "Drilling",
      color: "#3ecf8e",
      x: 100,
      y: 200,
    },
    {
      id: "production",
      type: "department",
      label: "Production",
      color: "#00c573",
      x: 250,
      y: 200,
    },
    {
      id: "access-control",
      type: "department",
      label: "Access Control",
      color: "#60a5fa",
      x: 400,
      y: 200,
    },
    {
      id: "engineering",
      type: "department",
      label: "Engineering",
      color: "#a78bfa",
      x: 550,
      y: 200,
    },
    {
      id: "control-room",
      type: "department",
      label: "Control Room",
      color: "#007aff",
      x: 700,
      y: 200,
    },
    {
      id: "safety",
      type: "department",
      label: "Safety",
      color: "#ef4444",
      x: 850,
      y: 200,
    },
    {
      id: "training",
      type: "department",
      label: "Training",
      color: "#ec4899",
      x: 1000,
      y: 200,
    },
    {
      id: "satellite-monitoring",
      type: "department",
      label: "Satellite Monitoring",
      color: "#14b8a6",
      x: 1150,
      y: 200,
    },
    {
      id: "access-card-actions",
      type: "department",
      label: "Access Card Actions",
      color: "#f59e0b",
      x: 1300,
      y: 200,
    },

    // Admin
    { id: "admin", type: "admin", label: "Admin", x: 1450, y: 50 },
  ],
  edges: [
    // Hub connections
    { id: "e1", source: "hub", target: "drilling" },
    { id: "e2", source: "hub", target: "production" },
    { id: "e3", source: "hub", target: "access-control" },
    { id: "e4", source: "hub", target: "engineering" },
    { id: "e5", source: "hub", target: "control-room" },
    { id: "e6", source: "hub", target: "safety" },
    { id: "e7", source: "hub", target: "training" },
    { id: "e8", source: "hub", target: "satellite-monitoring" },
    { id: "e9", source: "hub", target: "access-card-actions" },

    // Auth
    { id: "e10", source: "login", target: "hub" },

    // Admin
    { id: "e11", source: "admin", target: "hub" },
  ],
};

// Tech stack data
export const TECH_STACK = [
  {
    category: "Frontend",
    color: "#3ecf8e",
    items: [
      {
        name: "Next.js 16",
        version: "16.2.6",
        description: "App Router, React Server Components & Server Actions",
      },
      {
        name: "React 19",
        version: "19.0.0",
        description: "Action hooks, React compiler optimization & Transitions",
      },
      {
        name: "Tailwind CSS & OKLCH",
        version: "3.4.17",
        description: "Perceptually uniform OKLCH palette via @repo/theme design tokens",
      },
      {
        name: "@xyflow/react",
        version: "12.6.0",
        description: "Interactive node-based system topology and telemetry visualizers",
      },
      {
        name: "Lucide React",
        version: "Latest",
        description: "Tree-shakable industrial iconography",
      },
    ],
  },
  {
    category: "Backend",
    color: "#60a5fa",
    items: [
      {
        name: "Supabase PostgreSQL",
        version: "16.x",
        description: "Primary ACID relational database with 150 migrations & pgvector",
      },
      {
        name: "Row Level Security (RLS)",
        version: "Active",
        description: "Declarative Postgres security policies with 100% table coverage",
      },
      {
        name: "Payload CMS v3",
        version: "3.x",
        description: "Headless CMS administration for equipment specs and SOPs",
      },
      {
        name: "Inngest",
        version: "3.x",
        description: "Durable event-driven job orchestration and telemetry sync pipelines",
      },
    ],
  },
  {
    category: "DevOps & Caching",
    color: "#007aff",
    items: [
      {
        name: "Redis 7 / L1+L2 Cache",
        version: "7.x",
        description: "In-memory session, department UUID cache, and Redlock distributed locks",
      },
      {
        name: "Nx 22 + Turborepo",
        version: "22.7.5",
        description: "Affected task graph, cached pipeline execution & monorepo enforcement",
      },
      {
        name: "pnpm",
        version: "9.15.9",
        description: "Strict content-addressable dependency graph and workspace manager",
      },
      {
        name: "Docker & Supabase Local",
        version: "Local/Prod",
        description: "Isolated database, storage, and edge function execution environments",
      },
    ],
  },
  {
    category: "Testing & Quality",
    color: "#ec4899",
    items: [
      { name: "Jest & ts-jest", version: "29.x", description: "Unit and integration test suites" },
      {
        name: "Playwright",
        version: "1.56.1",
        description: "End-to-end browser automation and visual smoke verification",
      },
      {
        name: "DeepEval & Sentry",
        version: "Active",
        description: "Deterministic LLM evaluation harness and full-stack APM telemetry",
      },
    ],
  },
  {
    category: "Integration Tools",
    color: "#a78bfa",
    items: [
      {
        name: "FUXA SCADA",
        version: "1.2.x",
        description: "Real-time OPC-UA and Modbus-TCP machine HMI",
      },
      {
        name: "n8n",
        version: "Latest",
        description: "Automated event-triggered operational workflows",
      },
      {
        name: "Flowise",
        version: "Latest",
        description: "Visual node-based agent and tool orchestrator",
      },
    ],
  },
];

// Database schema
export const DATABASE_SCHEMA = [
  {
    name: "departments",
    rls: true,
    columns: ["id (UUID PK)", "name (text)", "slug (text)", "created_at"],
    description: "9 operational departments with strict routing and access boundaries",
  },
  {
    name: "employees",
    rls: true,
    columns: [
      "id (UUID PK)",
      "auth_id (FK)",
      "department_id (FK)",
      "full_name",
      "role",
      "accessible_departments (UUID[])",
      "created_at",
    ],
    description: "Authoritative employee records linked to auth.users with cross-department access",
  },
  {
    name: "machines",
    rls: true,
    columns: [
      "id (UUID PK)",
      "department_id (FK)",
      "site_id (FK)",
      "name",
      "type",
      "status",
      "created_at",
    ],
    description: "Pit machinery, drill rigs, excavators, dozers, and haul trucks",
  },
  {
    name: "daily_logs",
    rls: true,
    columns: [
      "id (UUID PK)",
      "department_id (FK)",
      "shift",
      "date",
      "notes",
      "created_by (FK)",
      "created_at",
    ],
    description: "Append-only immutable shift logs with supervisor closeout stamps",
  },
  {
    name: "breakdowns",
    rls: true,
    columns: [
      "id (UUID PK)",
      "machine_id (FK)",
      "department_id (FK)",
      "severity",
      "status",
      "reported_at",
      "resolved_at",
      "description",
    ],
    description: "Mechanical and electrical breakdown incidents dispatched to engineering",
  },
  {
    name: "delay_entries",
    rls: true,
    columns: [
      "id (UUID PK)",
      "department_id (FK)",
      "machine_id (FK)",
      "reason_code",
      "duration_minutes",
      "shift",
      "date",
      "logged_by (FK)",
    ],
    description: "Operational delays and equipment idle tracking across drilling and haulage",
  },
  {
    name: "hourly_loads",
    rls: true,
    columns: [
      "id (UUID PK)",
      "excavator_id (FK)",
      "truck_id (FK)",
      "material_type",
      "bucket_count",
      "payload_tonnage",
      "recorded_at",
    ],
    description: "Time-series payload and pass metrics partitioned for high-speed aggregations",
  },
  {
    name: "satellite_insar_deformations",
    rls: true,
    columns: [
      "id (UUID PK)",
      "scene_id (FK)",
      "pit_zone",
      "displacement_mm",
      "velocity_mm_yr",
      "coherence",
      "coordinates (GeoJSON)",
      "measured_at",
    ],
    description: "InSAR interferometric displacement point clouds and slope subsidence records",
  },
  {
    name: "scada_telemetry_records",
    rls: true,
    columns: [
      "id (UUID PK)",
      "equipment_tag",
      "protocol",
      "register_address",
      "telemetry_value (numeric)",
      "unit",
      "quality_code",
      "recorded_at",
    ],
    description: "High-frequency SCADA tag streaming data from Modbus and OPC-UA PLCs",
  },
  {
    name: "card_print_jobs",
    rls: true,
    columns: [
      "id (UUID PK)",
      "employee_id (FK)",
      "template_id (FK)",
      "status",
      "badge_rfid",
      "printer_id",
      "issued_at",
    ],
    description: "RFID badge batch printing queue and issuance audit trail",
  },
  {
    name: "access_logs",
    rls: true,
    columns: [
      "id (UUID PK)",
      "employee_id (FK)",
      "gate_id",
      "direction (IN/OUT)",
      "rfid_scan",
      "timestamp",
    ],
    description: "Mine portal turnstile logs for emergency muster accounting",
  },
  {
    name: "audit_logs",
    rls: true,
    columns: [
      "id (UUID PK)",
      "user_id (FK)",
      "action",
      "entity_type",
      "entity_id",
      "ip_address",
      "created_at",
    ],
    description: "Immutable compliance and security event logs",
  },
];

const _DB_RELATIONSHIPS = [
  { from: "employees", to: "departments", type: "many-to-one" },
  { from: "machines", to: "departments", type: "many-to-one" },
  { from: "daily_logs", to: "departments", type: "many-to-one" },
  { from: "machine_hours", to: "daily_logs", type: "many-to-one" },
  { from: "machine_hours", to: "machines", type: "many-to-one" },
  { from: "fuel_logs", to: "daily_logs", type: "many-to-one" },
  { from: "fuel_logs", to: "machines", type: "many-to-one" },
  { from: "production_logs", to: "daily_logs", type: "many-to-one" },
];

export interface ScadaTelemetryTag {
  tagId: string;
  name: string;
  sourceProtocol: "OPC-UA" | "Modbus-TCP";
  registerAddress?: string;
  nodeId?: string;
  dataType: "FLOAT32" | "INT16" | "BOOLEAN" | "UINT32";
  baseValue: number | boolean;
  unit?: string;
  pollingRateHz: number;
  variance?: number;
  quality: "GOOD (0x00)" | "UNCERTAIN (0x40)";
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
  category: "client" | "gateway" | "database" | "cache" | "iot" | "observability";
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
  flowType: "data" | "cache" | "realtime" | "iot" | "observability";
  description: string;
  color: string;
}

export const BACKEND_SERVICES: BackendService[] = [
  // Client Tier
  {
    id: "portal-app",
    name: "Portal Web Client",
    category: "client",
    role: "Primary Industrial UI",
    description:
      "Next.js 16 App Router UI for mining operators, supervisors, and control room dispatchers.",
    tech: "Next.js 16 + React 19 + TanStack Query",
    color: "#3ecf8e",
    protocols: ["HTTPS", "WSS"],
    security: "HttpOnly Session Cookies, PKCE OAuth",
    sla: "<100ms UI response",
    features: [
      "Control Room SCADA Feed",
      "Daily Shift Logs",
      "Department Dashboards",
      "FUXA HMI Embed",
    ],
  },
  {
    id: "cms-app",
    name: "Payload CMS",
    category: "client",
    role: "Content & Config Admin",
    description:
      "Headless CMS administration portal for report templates, standard operating procedures, and fleet metadata.",
    tech: "Payload CMS v3 + Next.js",
    color: "#a855f7",
    protocols: ["HTTPS", "REST"],
    security: "Admin RBAC & JWT",
    sla: "<150ms Admin response",
    features: ["Equipment Specs", "Safety Checklists", "Report Templates", "Audit Log Inspector"],
  },

  // API & Gateway Tier
  {
    id: "server-actions",
    name: "Next.js Server Actions",
    category: "gateway",
    role: "Direct Type-Safe RPC & Auth Gateway",
    description:
      "Direct server-side mutation and RPC layer enforcing strict runtime Zod schema validation and forwarding authenticated user session context directly to Supabase PostgreSQL RLS with zero middleman proxy overhead.",
    tech: "Node.js Edge / Serverless + Zod + Supabase Server SDK",
    color: "#3b82f6",
    protocols: ["Direct Server RPC", "HTTPS", "Supabase Session Claims"],
    security: "Server-side Session & 354 RLS Policy Enforcement (Zero-Proxy)",
    sla: "<25ms Execution",
    features: [
      "Direct Supabase RLS Session Forwarding",
      "Strict Zod Runtime Schema Validation",
      "Shift Closeout & Supervisor PIN Verification",
      "Redlock Concurrency & Rate Limiting",
      "Zero-Middleman Proxy Architecture",
    ],
  },
  {
    id: "inngest-workers",
    name: "Inngest Event Workers",
    category: "gateway",
    role: "Asynchronous Job Orchestrator",
    description:
      "Durable background execution engine for automated shift roll-overs, telemetry aggregation, and telemetry sync.",
    tech: "Inngest SDK + Serverless Functions",
    color: "#f59e0b",
    protocols: ["HTTPS Webhooks", "JSON-RPC"],
    security: "Webhook Signature Verification",
    sla: "At-least-once delivery with retry step functions",
    features: [
      "Telemetry Rollup",
      "Night Shift Closeout",
      "Syncpack Verification",
      "Langfuse Batch Trace Flush",
    ],
  },

  // Primary Data Layer (Supabase / Postgres)
  {
    id: "supabase-db",
    name: "Supabase PostgreSQL",
    category: "database",
    role: "Primary ACID Data Store",
    description:
      "PostgreSQL 15 cluster with 150 versioned migrations, partition pruning, and strict Row Level Security policies.",
    tech: "PostgreSQL 15 + PostgREST + pgvector",
    color: "#3ecf8e",
    protocols: ["PostgreSQL Wire (5432)", "HTTPS / PostgREST"],
    security: "354 RLS Policies, Encrypted at rest (AES-256)",
    sla: "<10ms Query p95",
    features: [
      "Partitioned Production Logs",
      "Supervisor PIN Hashes",
      "Material Density Constants",
      "Vector Embeddings",
    ],
  },
  {
    id: "supabase-realtime",
    name: "Supabase Realtime",
    category: "database",
    role: "WebSocket Event Broadcasting",
    description:
      "Real-time pub/sub replication engine dispatching database changes to active dispatcher screens.",
    tech: "Elixir Realtime Engine + WebSockets",
    color: "#00c573",
    protocols: ["WSS (WebSockets)"],
    security: "JWT Claims & Channel Authorization",
    sla: "<50ms Broadcast Latency",
    features: [
      "Live Machine Telemetry",
      "Shift Status Change Broadcast",
      "Control Room Alert Feed",
    ],
  },
  {
    id: "supabase-storage",
    name: "Supabase Storage",
    category: "database",
    role: "Object Storage Bucket",
    description:
      "S3-compatible asset store for operator ID photos, equipment condition snapshots, and generated PDF reports.",
    tech: "S3 API Storage Engine",
    color: "#10b981",
    protocols: ["HTTPS / S3 REST"],
    security: "Signed URLs & Storage RLS",
    sla: "<100ms File Delivery",
    features: ["Personnel Photos", "Equipment Inspection Scans", "Signed Shift Closeout PDFs"],
  },

  // Caching & In-Memory Layer
  {
    id: "redis-cluster",
    name: "Redis Cache & Locks",
    category: "cache",
    role: "High-Speed Cache & Distributed Locking",
    description:
      "In-memory key-value data store for shift roll-over concurrency locks (Redlock), query caching, and rate limiting.",
    tech: "Redis 7 / Upstash",
    color: "#ef4444",
    protocols: ["RESP (Redis Protocol, 6379)", "HTTPS REST"],
    security: "TLS + Auth Token / VPC Peering",
    sla: "<2ms Retrieval",
    features: [
      "Sliding-Window Rate Limiting",
      "Redlock Shift Closeout Mutex",
      "Machine Status Cache",
      "Session Store",
    ],
  },

  // Industrial SCADA & IoT Tier
  {
    id: "fuxa-scada",
    name: "FUXA SCADA Server",
    category: "iot",
    role: "Industrial HMI & SCADA Gateway",
    description:
      "Industrial SCADA visualization and telemetry server interfacing with heavy mining machinery sensors.",
    tech: "FUXA Engine + Node.js + Modbus/OPC-UA",
    color: "#06b6d4",
    protocols: ["Modbus TCP", "OPC-UA", "WebSockets", "HTTPS"],
    security: "VPN Tunnel / Industrial Network Isolation",
    sla: "Real-time telemetry stream (<200ms sensor poll)",
    features: [
      "Excavator Payload Monitor",
      "Dozer Pitch & Roll Inclinometer",
      "Drill Rig Depth Sensors",
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
          tagId: "TAG-EX901-PAYLOAD",
          name: "EX901_Bucket_Payload",
          sourceProtocol: "OPC-UA",
          nodeId: "ns=2;s=Mining.EX901.Payload_Ton",
          dataType: "FLOAT32",
          baseValue: 42.6,
          unit: "t",
          pollingRateHz: 10,
          variance: 1.4,
          quality: "GOOD (0x00)",
          equipment: "Cat 6040 Excavator #01",
        },
        {
          tagId: "TAG-EX901-HYD-PRESS",
          name: "EX901_Hydraulic_Pressure",
          sourceProtocol: "Modbus-TCP",
          registerAddress: "HR_40012",
          dataType: "INT16",
          baseValue: 3425,
          unit: "PSI",
          pollingRateHz: 20,
          variance: 22,
          quality: "GOOD (0x00)",
          equipment: "Cat 6040 Excavator #01",
        },
        {
          tagId: "TAG-DR104-PEN-RATE",
          name: "DR104_Penetration_Rate",
          sourceProtocol: "OPC-UA",
          nodeId: "ns=2;s=Drilling.DR104.PenRate_m_hr",
          dataType: "FLOAT32",
          baseValue: 24.8,
          unit: "m/h",
          pollingRateHz: 5,
          variance: 0.7,
          quality: "GOOD (0x00)",
          equipment: "Pit Viper 271 Drill #04",
        },
        {
          tagId: "TAG-DR104-BIT-DEPTH",
          name: "DR104_Hole_Depth",
          sourceProtocol: "Modbus-TCP",
          registerAddress: "HR_40024",
          dataType: "FLOAT32",
          baseValue: 14.2,
          unit: "m",
          pollingRateHz: 5,
          variance: 0.2,
          quality: "GOOD (0x00)",
          equipment: "Pit Viper 271 Drill #04",
        },
        {
          tagId: "TAG-HT402-INCLINE",
          name: "HT402_Ramp_Incline_Grade",
          sourceProtocol: "OPC-UA",
          nodeId: "ns=2;s=Haulage.HT402.Incline_Pct",
          dataType: "FLOAT32",
          baseValue: 8.2,
          unit: "%",
          pollingRateHz: 10,
          variance: 0.3,
          quality: "GOOD (0x00)",
          equipment: "Komatsu 930E Haul Truck #02",
        },
        {
          tagId: "TAG-CV101-BELT-SPEED",
          name: "CV101_Overland_Belt_Speed",
          sourceProtocol: "Modbus-TCP",
          registerAddress: "HR_40040",
          dataType: "FLOAT32",
          baseValue: 4.8,
          unit: "m/s",
          pollingRateHz: 10,
          variance: 0.1,
          quality: "GOOD (0x00)",
          equipment: "Main Pit Conveyor CV-101",
        },
        {
          tagId: "TAG-CV101-BEARING-TEMP",
          name: "CV101_Drive_Bearing_Temp",
          sourceProtocol: "Modbus-TCP",
          registerAddress: "HR_40048",
          dataType: "FLOAT32",
          baseValue: 68.4,
          unit: "°C",
          pollingRateHz: 2,
          variance: 0.6,
          quality: "GOOD (0x00)",
          equipment: "Main Pit Conveyor CV-101",
        },
        {
          tagId: "TAG-PS201-VOLT-L1",
          name: "PS201_Bus_Voltage_L1",
          sourceProtocol: "Modbus-TCP",
          registerAddress: "HR_40102",
          dataType: "FLOAT32",
          baseValue: 4160,
          unit: "V",
          pollingRateHz: 1,
          variance: 15,
          quality: "GOOD (0x00)",
          equipment: "Pit Substation PS-201",
        },
      ],
    },
  },
  {
    id: "satellite-tiles",
    name: "Satellite Tile Service",
    category: "iot",
    role: "Geospatial Pit Mapping",
    description:
      "High-resolution orthomosaic tile server for visual pit exploration and mining progression monitoring.",
    tech: "XYZ Raster Tiles + WebGL Deck.gl",
    color: "#6366f1",
    protocols: ["HTTPS / XYZ Web Mercator"],
    security: "Signed Pit Layer API Tokens",
    sla: "<80ms Tile Cache Response",
    features: [
      "High-Res Pit Topography",
      "Excavation Boundary Overlays",
      "Fleet GPS Vector Layers",
    ],
  },

  // AI & Observability Mesh
  {
    id: "langfuse-mesh",
    name: "Langfuse AI Tracing",
    category: "observability",
    role: "LLM & Multi-Agent Observability",
    description:
      "Comprehensive telemetry and evaluation platform for AI agents, prompt caching efficiency, and token economics.",
    tech: "Langfuse Cloud / Self-hosted SDK",
    color: "#ec4899",
    protocols: ["HTTPS / OpenTelemetry Exporter"],
    security: "Encrypted API Keys & Masked PII",
    sla: "Async flush without blocking critical path",
    features: ["Agent Execution Traces", "Prompt Cache Tracking", "DeepEval Benchmark Logging"],
  },
  {
    id: "telemetry-sentry",
    name: "Sentry & OpenTelemetry",
    category: "observability",
    role: "APM, Error Tracking & Metrics",
    description:
      "Full-stack distributed tracing and real-time alert system monitoring Next.js runtime and database queries.",
    tech: "OpenTelemetry SDK + Sentry APM",
    color: "#f43f5e",
    protocols: ["OTLP / gRPC / HTTPS"],
    security: "Source Map Masking & PII Scrubbing",
    sla: "Real-time Exception Ingestion",
    features: ["Core Web Vitals Monitoring", "Postgres Query Tracing", "Fatal Crash Breadcrumbs"],
  },
];

export const BACKEND_CONNECTIONS: BackendConnection[] = [
  // Client -> Gateways
  {
    id: "conn-portal-actions",
    source: "portal-app",
    target: "server-actions",
    label: "Server RPC / Form Actions",
    protocol: "HTTPS / RPC",
    flowType: "data",
    description:
      "Type-safe mutation calls for shift entries, PIN verification, and department logs.",
    color: "#3b82f6",
  },
  {
    id: "conn-portal-realtime",
    source: "portal-app",
    target: "supabase-realtime",
    label: "Live Telemetry & Alerts",
    protocol: "WebSockets (WSS)",
    flowType: "realtime",
    description: "Real-time push notifications for machine status updates and supervisor alerts.",
    color: "#00c573",
  },
  {
    id: "conn-portal-fuxa",
    source: "portal-app",
    target: "fuxa-scada",
    label: "HMI Control Embed / SCADA Stream",
    protocol: "HTTPS / WebSockets",
    flowType: "iot",
    description: "Embedded industrial dashboard showing live excavator and dozer telemetry.",
    color: "#06b6d4",
  },
  {
    id: "conn-portal-tiles",
    source: "portal-app",
    target: "satellite-tiles",
    label: "Pit Raster Tiles",
    protocol: "HTTPS / XYZ",
    flowType: "iot",
    description: "High-resolution geospatial tile rendering for mining terrain visualization.",
    color: "#6366f1",
  },

  // Gateways -> Data & Cache
  {
    id: "conn-actions-db",
    source: "server-actions",
    target: "supabase-db",
    label: "Direct RLS Context & Zod RPC",
    protocol: "Server RPC ──► Postgres / RLS",
    flowType: "data",
    description:
      "Direct zero-middleman mutations forwarding authenticated user session tokens to Supabase PostgreSQL, enforcing 354 Row Level Security policies with strict Zod validation.",
    color: "#3ecf8e",
  },
  {
    id: "conn-actions-redis",
    source: "server-actions",
    target: "redis-cluster",
    label: "Redlock & Rate Limiting",
    protocol: "RESP / TLS (6379)",
    flowType: "cache",
    description:
      "Acquires distributed lock for shift rollover and checks sliding-window rate limit.",
    color: "#ef4444",
  },
  {
    id: "conn-actions-storage",
    source: "server-actions",
    target: "supabase-storage",
    label: "Signed Asset Uploads",
    protocol: "S3 REST / HTTPS",
    flowType: "data",
    description: "Uploads operator photos, shift inspection media, and closeout PDF certificates.",
    color: "#10b981",
  },
  {
    id: "conn-inngest-db",
    source: "inngest-workers",
    target: "supabase-db",
    label: "Batch Rollups & Cron Sync",
    protocol: "Postgres Connection Pooler",
    flowType: "data",
    description: "Executes automated hourly production rollups and data integrity reconciliations.",
    color: "#f59e0b",
  },
  {
    id: "conn-inngest-redis",
    source: "inngest-workers",
    target: "redis-cluster",
    label: "Cache Invalidation & Warmup",
    protocol: "RESP (6379)",
    flowType: "cache",
    description: "Purges stale department summary caches and warms active shift records.",
    color: "#ef4444",
  },

  // CMS -> DB & Storage
  {
    id: "conn-cms-db",
    source: "cms-app",
    target: "supabase-db",
    label: "Schema & Content Persistence",
    protocol: "Postgres Wire / SSL",
    flowType: "data",
    description: "Payload CMS administration tables, report definitions, and equipment specs.",
    color: "#a855f7",
  },
  {
    id: "conn-cms-storage",
    source: "cms-app",
    target: "supabase-storage",
    label: "Media & Template Assets",
    protocol: "S3 API / HTTPS",
    flowType: "data",
    description: "Stores branding guidelines, SOP documents, and equipment manuals.",
    color: "#10b981",
  },

  // Observability & AI Tracing
  {
    id: "conn-portal-sentry",
    source: "portal-app",
    target: "telemetry-sentry",
    label: "Error & Tracing OTel",
    protocol: "HTTPS / OTLP",
    flowType: "observability",
    description: "Captures frontend performance vitals, unhandled rejections, and network errors.",
    color: "#f43f5e",
  },
  {
    id: "conn-actions-langfuse",
    source: "server-actions",
    target: "langfuse-mesh",
    label: "Agent Runs & Prompt Telemetry",
    protocol: "HTTPS / Langfuse API",
    flowType: "observability",
    description:
      "Tracks LLM agent queries, token usage, evaluation scores, and prompt cache hit rates.",
    color: "#ec4899",
  },
];
