// Departments data
export const DEPARTMENTS = [
  {
    id: "drilling",
    name: "Drilling",
    slug: "drilling",
    description: "Drilling operations and equipment management",
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
        description: "Department equipment",
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
    description: "Coal production and extraction operations",
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
        description: "Department equipment",
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
    description: "Mine entry/exit and personnel tracking",
    color: "#60a5fa",
    routes: [
      {
        path: "/access-control",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/access-control/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/access-control/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/access-control/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/access-control/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/access-control/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["access_control_officer", "supervisor", "admin"],
  },
  {
    id: "engineering",
    name: "Engineering",
    slug: "engineering",
    description: "Technical support and maintenance planning",
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
        description: "Department equipment",
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
    description: "Central monitoring and alert management",
    color: "#007aff",
    routes: [
      {
        path: "/control-room",
        name: "Dashboard",
        description: "Alert panel and monitoring",
      },
      {
        path: "/control-room/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/control-room/machines",
        name: "Machines",
        description: "Department equipment",
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
    roles: ["control_room_operator", "admin"],
  },
  {
    id: "safety",
    name: "Safety",
    slug: "safety",
    description: "Safety compliance and incident reporting",
    color: "#ef4444",
    routes: [
      {
        path: "/safety",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/safety/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/safety/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/safety/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/safety/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/safety/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["safety_officer", "supervisor", "admin"],
  },
  {
    id: "training",
    name: "Training",
    slug: "training",
    description: "Employee training and certification",
    color: "#ec4899",
    routes: [
      {
        path: "/training",
        name: "Dashboard",
        description: "Today's summary and status",
      },
      {
        path: "/training/daily-log",
        name: "Daily Log",
        description: "Submit shift logs",
      },
      {
        path: "/training/machines",
        name: "Machines",
        description: "Department equipment",
      },
      {
        path: "/training/history",
        name: "History",
        description: "Past daily logs",
      },
      {
        path: "/training/reports",
        name: "Reports",
        description: "Aggregate data + CSV",
      },
      {
        path: "/training/tools",
        name: "Tools",
        description: "n8n / Flowise embeds",
      },
    ],
    roles: ["trainer", "supervisor", "admin"],
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

    // Admin
    { id: "admin", type: "admin", label: "Admin", x: 1150, y: 50 },
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

    // Auth
    { id: "e8", source: "login", target: "hub" },

    // Admin
    { id: "e9", source: "admin", target: "hub" },
  ],
};

// Tech stack data
export const TECH_STACK = [
  {
    category: "Frontend",
    color: "#3ecf8e",
    items: [
      {
        name: "Next.js 14",
        version: "14.2.8",
        description: "App Router, React Server Components",
      },
      {
        name: "React 18",
        version: "18.3.1",
        description: "Concurrent features, Suspense",
      },
      {
        name: "Tailwind CSS",
        version: "3.4.13",
        description: "Utility-first styling",
      },
      {
        name: "Framer Motion",
        version: "",
        description: "Animations and transitions",
      },
      { name: "Lucide React", version: "", description: "Icon library" },
    ],
  },
  {
    category: "Backend",
    color: "#60a5fa",
    items: [
      {
        name: "Supabase",
        version: "",
        description: "Auth, Postgres, Realtime",
      },
      {
        name: "PostgreSQL",
        version: "",
        description: "Primary database with RLS",
      },
      {
        name: "Row Level Security",
        version: "",
        description: "Per-row access control",
      },
    ],
  },
  {
    category: "DevOps",
    color: "#007aff",
    items: [
      {
        name: "pnpm",
        version: "",
        description: "Package manager with workspaces",
      },
      { name: "Turborepo", version: "", description: "Monorepo build system" },
      {
        name: "Docker",
        version: "",
        description: "Containerization for tools",
      },
      {
        name: "Node.js",
        version: "20.17.0+",
        description: "Runtime with Volta",
      },
    ],
  },
  {
    category: "Testing",
    color: "#ec4899",
    items: [
      { name: "Jest", version: "", description: "Unit testing with ts-jest" },
      {
        name: "Playwright",
        version: "1.56.1",
        description: "E2E browser testing",
      },
    ],
  },
  {
    category: "Integration Tools",
    color: "#a78bfa",
    items: [
      { name: "n8n", version: "", description: "Workflow automation (iframe)" },
      {
        name: "Flowise",
        version: "",
        description: "LLM workflow builder (iframe)",
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
    description: "7 departments (drilling, production, etc.)",
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
      "created_at",
    ],
    description: "Linked to auth.users via trigger",
  },
  {
    name: "machines",
    rls: true,
    columns: ["id (UUID PK)", "department_id (FK)", "name", "type", "status", "created_at"],
    description: "Per-department equipment",
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
      "created_by",
      "created_at",
    ],
    description: "Append-only (no DELETE policies)",
  },
  {
    name: "machine_hours",
    rls: true,
    columns: ["id (UUID PK)", "daily_log_id (FK)", "machine_id (FK)", "hours", "created_at"],
    description: "Child of daily_logs",
  },
  {
    name: "fuel_logs",
    rls: true,
    columns: ["id (UUID PK)", "daily_log_id (FK)", "machine_id (FK)", "liters", "created_at"],
    description: "Fuel consumption records",
  },
  {
    name: "production_logs",
    rls: true,
    columns: ["id (UUID PK)", "daily_log_id (FK)", "tons", "created_at"],
    description: "Production output records",
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
}

export interface BackendConnection {
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
    role: "Type-Safe RPC Gateway",
    description:
      "Server-side mutation and authorization layer validating Zod schemas before touching data stores.",
    tech: "Node.js Edge / Serverless + Zod",
    color: "#3b82f6",
    protocols: ["Direct Server RPC", "HTTPS"],
    security: "Server-side Session & RLS Context",
    sla: "<25ms Execution",
    features: [
      "Shift Closeout Verification",
      "Log Submission",
      "Access Card Issuance",
      "Audit Log Triggers",
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
      "PostgreSQL 15 cluster with 95+ versioned migrations, partition pruning, and strict Row Level Security policies.",
    tech: "PostgreSQL 15 + PostgREST + pgvector",
    color: "#3ecf8e",
    protocols: ["PostgreSQL Wire (5432)", "HTTPS / PostgREST"],
    security: "95 RLS Policies, Encrypted at rest (AES-256)",
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
    label: "ACID Queries & RLS Mutations",
    protocol: "Postgres Wire (5432) / PostgREST",
    flowType: "data",
    description:
      "Data persistence enforcing 95 Row Level Security policies and department partitioning.",
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
