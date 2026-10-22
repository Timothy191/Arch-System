'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Card } from '@repo/ui/components/ui/card';
import {
  Activity,
  Bot,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  Filter,
  GitCommit,
  Globe,
  HardDrive,
  Layers,
  Lock,
  Maximize2,
  Network,
  Play,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useMemo, useState } from 'react';

export type NodeCategory =
  | 'edge'
  | 'departments'
  | 'gateway'
  | 'cache'
  | 'database'
  | 'observability';

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
  pipelines: Array<'all' | 'scada' | 'shift-budget' | 'access-badge' | 'auth-rls'>;
}

export interface ArchCanvasEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  protocol: string;
  color: string;
  animated?: boolean;
  pipelines: Array<'all' | 'scada' | 'shift-budget' | 'access-badge' | 'auth-rls'>;
}

const CANVAS_NODES: ArchCanvasNode[] = [
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

const CANVAS_EDGES: ArchCanvasEdge[] = [
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

const COLUMN_HEADERS = [
  { col: 0, title: '01 · Edge & Field Triggers', subtitle: 'Auth Proxy, PLCs & Gate HW' },
  { col: 1, title: '02 · 8 Department Modules', subtitle: 'Next.js 16 App Router UI' },
  { col: 2, title: '03 · RPC & Contract Gate', subtitle: 'Server Actions, Zod & SCADA' },
  { col: 3, title: '04 · Cache & Orchestration', subtitle: 'Hybrid Redis 7.4 & Inngest' },
  { col: 4, title: '05 · Data Platform (RLS)', subtitle: 'PostgreSQL 17 Primary & Replica' },
  { col: 5, title: '06 · Realtime, AI & OTel', subtitle: 'WAL Broadcast, RAG & Sentry' },
];

const PIPELINE_FILTERS: Array<{
  id: 'all' | 'scada' | 'shift-budget' | 'access-badge' | 'auth-rls';
  label: string;
  badge: string;
}> = [
  { id: 'all', label: 'Complete Architecture (All Nodes)', badge: '16 Nodes · 21 Wires' },
  { id: 'scada', label: 'SCADA → Production Auto-Report', badge: 'Pipeline A' },
  { id: 'shift-budget', label: '12h Shift Budget & Breakdown Lock', badge: 'Pipeline B' },
  { id: 'access-badge', label: 'Neo 300 Badge & C66 Gate Sync', badge: 'Pipeline C' },
  { id: 'auth-rls', label: 'Zero-Trust Auth → Zod → Postgres RLS', badge: 'Security Gate' },
];

function NodeIcon({ name, className }: { name: ArchCanvasNode['iconName']; className?: string }) {
  switch (name) {
    case 'lock':
      return <Lock className={className} />;
    case 'radio':
      return <Radio className={className} />;
    case 'printer':
      return <Printer className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'building':
      return <Building2 className={className} />;
    case 'activity':
      return <Activity className={className} />;
    case 'qrcode':
      return <QrCode className={className} />;
    case 'database':
      return <Database className={className} />;
    case 'server':
      return <Server className={className} />;
    case 'shield':
      return <ShieldCheck className={className} />;
    case 'cpu':
      return <Cpu className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'refresh':
      return <RefreshCw className={className} />;
    case 'harddrive':
      return <HardDrive className={className} />;
    case 'bot':
      return <Bot className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
  }
}

// Geometry constants for SVG coordinate calculation
const COL_WIDTH = 285;
const COL_GAP = 68;
const LEFT_PAD = 28;
const TOP_PAD = 76;
const ROW_HEIGHT = 152;
const NODE_WIDTH = 256;
const NODE_HEIGHT = 116;

function getNodePosition(node: ArchCanvasNode) {
  const x = LEFT_PAD + node.col * (COL_WIDTH + COL_GAP);
  const y = TOP_PAD + node.row * ROW_HEIGHT;
  return { x, y };
}

export function SystemArchitectureNodeCanvas() {
  const [activePipeline, setActivePipeline] = useState<
    'all' | 'scada' | 'shift-budget' | 'access-badge' | 'auth-rls'
  >('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('supabase-primary');
  const [zoom, setZoom] = useState<number>(1);
  const [animatePulses, setAnimatePulses] = useState<boolean>(true);

  const selectedNode = useMemo(
    () => CANVAS_NODES.find((n) => n.id === selectedNodeId) ?? CANVAS_NODES[0]!,
    [selectedNodeId]
  );

  const activeNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of CANVAS_NODES) {
      if (activePipeline === 'all' || node.pipelines.includes(activePipeline)) {
        ids.add(node.id);
      }
    }
    return ids;
  }, [activePipeline]);

  const connectedEdges = useMemo(
    () => CANVAS_EDGES.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id),
    [selectedNode.id]
  );

  const canvasWidth = LEFT_PAD * 2 + 6 * COL_WIDTH + 5 * COL_GAP;
  const canvasHeight = 670;

  return (
    <Card
      data-testid="n8n-architecture-canvas"
      className="overflow-hidden border border-white/60 bg-white/85 backdrop-blur-2xl shadow-glass-depth"
    >
      {/* Top n8n Workflow Toolbar */}
      <div className="px-5 py-4 border-b border-border-subtle bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-inner">
            <Workflow className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-white">
                n8n-Style System Architecture Node & Wire Canvas
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                LIVE TOPOLOGY · 6 TIERS
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Interactive box-and-wire graph of all 16 architecture subsystems & 21 data pipelines —
              click any node to inspect inputs, outputs, and file boundaries
            </p>
          </div>
        </div>

        {/* Pipeline Scenario Filter Pills & Canvas Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-lg p-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            {PIPELINE_FILTERS.map((pf) => {
              const active = activePipeline === pf.id;
              return (
                <button
                  key={pf.id}
                  type="button"
                  onClick={() => setActivePipeline(pf.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                    active
                      ? 'bg-accent-blue text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  {pf.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setAnimatePulses((prev) => !prev)}
              className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 cursor-pointer ${
                animatePulses
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle live packet flow animation"
            >
              <Play className="w-3 h-3" />
              <span>{animatePulses ? 'Flow Live' : 'Paused'}</span>
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))))}
              aria-label="Zoom out canvas"
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300 px-1.5">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.15, Number((z + 0.1).toFixed(2))))}
              aria-label="Zoom in canvas"
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label="Reset canvas zoom"
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
              title="Reset zoom (100%)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable n8n Dot-Grid Node & Wire Viewport */}
      <div
        className="relative overflow-x-auto overflow-y-hidden bg-[#f8fafc]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(100, 116, 139, 0.22) 1.25px, transparent 1.25px)',
          backgroundSize: '20px 20px',
        }}
      >
        <div
          className="relative transition-transform origin-top-left"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `scale(${zoom})`,
            marginBottom: zoom < 1 ? `${(zoom - 1) * canvasHeight}px` : '0px',
          }}
        >
          {/* Column Lane Headers */}
          {COLUMN_HEADERS.map((colHeader) => {
            const left = LEFT_PAD + colHeader.col * (COL_WIDTH + COL_GAP);
            return (
              <div
                key={colHeader.col}
                className="absolute top-3 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200/90 px-3 py-1.5 shadow-xs"
                style={{ left: `${left}px`, width: `${NODE_WIDTH}px` }}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                  {colHeader.title}
                </div>
                <div className="text-[10px] text-slate-500 truncate">{colHeader.subtitle}</div>
              </div>
            );
          })}

          {/* SVG Bezier Wires Layer */}
          <svg
            width={canvasWidth}
            height={canvasHeight}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            className="absolute inset-0 pointer-events-none"
            aria-label="System Architecture Node Connections"
          >
            <defs>
              <marker
                id="n8n-arrow-active"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
              </marker>
              <marker
                id="n8n-arrow-muted"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
              </marker>
            </defs>

            {CANVAS_EDGES.map((edge) => {
              const sourceNode = CANVAS_NODES.find((n) => n.id === edge.source);
              const targetNode = CANVAS_NODES.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const srcPos = getNodePosition(sourceNode);
              const tgtPos = getNodePosition(targetNode);

              const startX = srcPos.x + NODE_WIDTH;
              const startY = srcPos.y + NODE_HEIGHT / 2;
              const endX = tgtPos.x;
              const endY = tgtPos.y + NODE_HEIGHT / 2;

              const dx = Math.max(60, (endX - startX) * 0.52);
              const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

              const isInPipeline =
                activePipeline === 'all' || edge.pipelines.includes(activePipeline);
              const isSelectedEdge =
                selectedNode.id === edge.source || selectedNode.id === edge.target;

              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              return (
                <g
                  key={edge.id}
                  style={{
                    opacity: isInPipeline ? (isSelectedEdge ? 1 : 0.78) : 0.16,
                    transition: 'opacity 200ms ease',
                  }}
                >
                  {/* Soft glow under active/selected wire */}
                  {isSelectedEdge && isInPipeline && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={6}
                      strokeOpacity={0.18}
                    />
                  )}

                  {/* Main Bezier Wire */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isInPipeline ? edge.color : '#cbd5e1'}
                    strokeWidth={isSelectedEdge ? 2.6 : 1.8}
                    strokeDasharray={animatePulses && isInPipeline ? '6 4' : undefined}
                    markerEnd={isInPipeline ? 'url(#n8n-arrow-active)' : 'url(#n8n-arrow-muted)'}
                  />

                  {/* Animated data packet dot along the bezier curve */}
                  {animatePulses && isInPipeline && (
                    <circle r={isSelectedEdge ? 4 : 3} fill={edge.color}>
                      <animateMotion
                        dur={isSelectedEdge ? '2.2s' : '3.4s'}
                        repeatCount="indefinite"
                        path={pathD}
                      />
                    </circle>
                  )}

                  {/* Edge Protocol Label Pill */}
                  {(isSelectedEdge || activePipeline !== 'all') && isInPipeline && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-54}
                        y={-10}
                        width={108}
                        height={19}
                        rx={5}
                        fill="#ffffff"
                        stroke={edge.color}
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        className="text-[9px] font-mono font-semibold fill-slate-700"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive n8n Node Boxes Layer */}
          {CANVAS_NODES.map((node) => {
            const { x, y } = getNodePosition(node);
            const isSelected = selectedNode.id === node.id;
            const isVisible = activeNodeIds.has(node.id);
            const isConnectedToSelected = connectedEdges.some(
              (e) => e.source === node.id || e.target === node.id
            );

            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                data-testid={`n8n-node-${node.id}`}
                onClick={() => setSelectedNodeId(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNodeId(node.id);
                  }
                }}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${NODE_WIDTH}px`,
                  height: `${NODE_HEIGHT}px`,
                  borderColor: isSelected
                    ? node.color
                    : isConnectedToSelected
                      ? `${node.color}99`
                      : 'rgba(148, 163, 184, 0.45)',
                  opacity: isVisible ? 1 : 0.25,
                }}
                className={`absolute rounded-xl bg-white border-2 shadow-md transition-all duration-200 cursor-pointer select-none flex flex-col justify-between overflow-hidden group ${
                  isSelected
                    ? 'ring-4 ring-accent-blue/20 -translate-y-0.5 shadow-xl z-20'
                    : 'hover:-translate-y-0.5 hover:shadow-lg z-10'
                }`}
              >
                {/* Top Colored Node Bar */}
                <div className="h-1.5 w-full" style={{ backgroundColor: node.color }} />

                {/* Input Connection Port (Left) */}
                {node.col > 0 && (
                  <span
                    className="absolute -left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs"
                    style={{ backgroundColor: node.color }}
                    title="Input Port"
                  />
                )}

                {/* Output Connection Port (Right) */}
                {node.col < 5 && (
                  <span
                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs"
                    style={{ backgroundColor: node.color }}
                    title="Output Port"
                  />
                )}

                {/* Node Body */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${node.color}15`,
                          color: node.color,
                        }}
                      >
                        {node.typeLabel}
                      </span>
                      <span className="text-[9px] font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {node.metricBadge}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className="p-1.5 rounded-lg shrink-0"
                        style={{
                          backgroundColor: `${node.color}15`,
                          color: node.color,
                        }}
                      >
                        <NodeIcon name={node.iconName} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {node.title}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{node.subtitle}</div>
                      </div>
                    </div>
                  </div>

                  {/* Node Footer Protocol Bar */}
                  <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500 truncate">{node.protocol}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {node.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom n8n Node Inspector Drawer (Shows Selected Node Details & Connected Wires) */}
      <div
        data-testid="n8n-node-inspector"
        className="p-5 bg-white border-t border-border-subtle grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
              style={{
                backgroundColor: `${selectedNode.color}18`,
                color: selectedNode.color,
              }}
            >
              {selectedNode.typeLabel}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {selectedNode.protocol}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] font-mono text-emerald-700 border-emerald-200 bg-emerald-50"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {selectedNode.metricBadge}
            </Badge>
          </div>

          <h4 className="text-base font-bold text-text-heading flex items-center gap-2">
            {selectedNode.title}
            <span className="text-xs font-normal text-text-secondary">
              — {selectedNode.subtitle}
            </span>
          </h4>

          <p className="text-xs text-text-secondary leading-relaxed">{selectedNode.description}</p>

          <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-accent-blue">
            <GitCommit className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Source SSoT: {selectedNode.filePath}</span>
          </div>
        </div>

        {/* Inputs & Outputs Ports */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-bg-secondary/70 border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-semibold mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-accent-blue" />
              Input Signals ({selectedNode.inputs.length})
            </div>
            <ul className="space-y-1">
              {selectedNode.inputs.map((inp) => (
                <li
                  key={inp}
                  className="text-[11px] font-mono text-text-heading flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
                  <span>{inp}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-bg-secondary/70 border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-semibold mb-1.5 flex items-center gap-1.5">
              <Network className="w-3 h-3 text-accent-green" />
              Output Emissions ({selectedNode.outputs.length})
            </div>
            <ul className="space-y-1">
              {selectedNode.outputs.map((out) => (
                <li
                  key={out}
                  className="text-[11px] font-mono text-text-heading flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                  <span>{out}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Connected Wires List */}
        <div className="lg:col-span-3 p-3 rounded-xl bg-bg-secondary/70 border border-border-subtle">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-semibold mb-1.5">
            Active Wire Connections ({connectedEdges.length})
          </div>
          <div className="space-y-1.5 max-h-[115px] overflow-y-auto pr-1">
            {connectedEdges.map((edge) => {
              const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
              const otherNode = CANVAS_NODES.find((n) => n.id === otherId);
              const direction = edge.source === selectedNode.id ? '──►' : '◄──';
              return (
                <button
                  key={edge.id}
                  type="button"
                  onClick={() => setSelectedNodeId(otherId)}
                  className="w-full text-left px-2 py-1 rounded bg-white border border-border-subtle hover:border-accent-blue/50 flex items-center justify-between gap-2 text-[10px] font-mono transition-colors cursor-pointer"
                >
                  <span className="truncate text-text-heading font-medium">
                    {direction} {otherNode?.title ?? otherId}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] shrink-0"
                    style={{ backgroundColor: `${edge.color}18`, color: edge.color }}
                  >
                    {edge.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
