#!/usr/bin/env node

/**
 * @fileoverview Automated Codebase Maps Generator & Indexer
 * Scans the workspace topology and generates structured codebase maps inside codebase-maps/log-N(YY-MM-DD)/.
 * Maintains a manifest.json metadata index and a codebase-maps/latest/ directory for zero-regex loading
 * in Server Components and overview dashboards.
 *
 * Usage: node tools/repo/generate-codebase-maps.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MAPS_ROOT = path.join(ROOT, 'codebase-maps');

/**
 * Formats date strings for versioned folder naming and ISO metadata.
 */
function getFormattedDate() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return {
    folderDate: `${yy}-${mm}-${dd}`,
    isoDate: now.toISOString(),
    displayDate: `${now.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
  };
}

/**
 * Determines the next log folder number by inspecting codebase-maps/.
 */
function getNextLogNumber() {
  if (!fs.existsSync(MAPS_ROOT)) {
    fs.mkdirSync(MAPS_ROOT, { recursive: true });
    return 1;
  }

  const entries = fs.readdirSync(MAPS_ROOT, { withFileTypes: true });
  let maxLogNum = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const match = entry.name.match(/^log-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxLogNum) {
          maxLogNum = num;
        }
      }
    }
  }

  return maxLogNum + 1;
}

/**
 * Generates comprehensive maps for the workspace.
 */
function buildCodebaseMaps(dateInfo) {
  return [
    {
      key: 'route-feature',
      filename: 'route-feature-architecture.md',
      title: 'Route & Feature Architecture Map',
      category: 'Routing & Features',
      summary:
        'Next.js 16 App Router hierarchy, edge proxy, Redis-cached RBAC, and leaf client interactivity.',
      content: `# 🗺️ Route & Feature Architecture Map

**Generated:** \${dateInfo.displayDate}  
**System:** Arch-System Mining Operations Portal (Next.js 16.3.8 App Router + React 19)

---

## 🔄 End-to-End Request & Server Action Lifecycle

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor Browser as Mining Pit Client
    participant Proxy as apps/portal/proxy.ts
    participant ServerProxy as server/proxy.ts
    participant Redis as Redis L1/L2 Cache
    participant Layout as Root Layout & Gating
    participant Page as RSC Page (cachedRSC)
    participant Action as Server Action Gate
    participant Supabase as PostgreSQL 17 / CDC

    Browser->>Proxy: HTTP GET /drilling (Edge Request)
    Proxy->>Proxy: Generate cryptographic x-nonce & set strict CSP
    Proxy->>ServerProxy: Check Supabase session & cookies
    ServerProxy->>Redis: Query arch:auth:employee:uid (TTL 3600s)
    Redis-->>ServerProxy: Return Employee Role & Department claims
    ServerProxy->>Layout: Verify route permissions (DEPARTMENT_ROUTES)
    Layout->>Page: Stream React 19 RSC with Suspense
    Page->>Redis: Check cachedRSC tag invalidation
    Page->>Supabase: Execute read query via createServerSupabaseClient()
    Supabase-->>Page: Return tabular telemetry data
    Page-->>Browser: Stream HTML + hydration payload
    Note over Browser,Action: User records shift closeout mutation
    Browser->>Action: Invoke submitShiftCloseout(payload)
    Action->>Action: 1. Auth -> 2. Authorize -> 3. Zod Validate -> 4. Rate-Limit
    Action->>Supabase: Execute atomic PL/pgSQL RPC (ACID transaction)
    Action->>Action: Invalidate cache tags via updateTagInAction()
    Action-->>Browser: Return typed result { success: true, data }
    Supabase-->>Browser: Broadcast Realtime CDC change via WebSocket
\`\`\`

---

## 🏛️ Route Groups & Operational Department Hierarchy

| Route Path | Scope / Access Gate | Core Functionality | Primary Components & SSoT |
| :--- | :--- | :--- | :--- |
| \`/\` -> \`/hub\` | Authenticated Mining Staff | Central Operations Hub, Hero Carousel, Bento Department Grid | \`@repo/hub/ui\`, \`LiveKpiStrip\`, \`useSupabaseRealtime\` |
| \`/overview\` | Authenticated Mining Staff | System Topology, DB Explorer, Codemaps & Invariant Audits | \`DocumentationMaps.tsx\`, \`codebase-maps-data.ts\` |
| \`/(auth)/*\` | Public / PKCE Handshake | Login (\`/login\`), Reset Password, Update Password | \`@repo/auth/ui\`, Supabase SSR Auth cookies |
| \`/(departments)/control-room\` | Gated by \`control_room\` claim | SCADA live telemetry, FUXA diagnostics, OPC-UA alert panels | \`AlertPanel.tsx\`, \`ScadaDiagnosticGrid.tsx\` |
| \`/(departments)/drilling\` | Gated by \`drilling\` claim | Drill rig telemetry, penetration rates, borehole logs | \`DrillRigGrid.tsx\`, \`machine-telemetry/\` |
| \`/(departments)/production\` | Gated by \`production\` claim | Haulage cycles, payload tonnage, excavator tally | \`HourlyLoadsTable.tsx\`, \`shift-compilation/\` |
| \`/(departments)/engineering\` | Gated by \`engineering\` claim | Breakdown logs, preventive maintenance schedule | \`BreakdownLedger.tsx\`, \`machine-operations/\` |
| \`/(departments)/access-control\` | Gated by \`access_control\` claim | On-site C66 visitor badging, card actions, QR scanner | \`BadgeScanner.tsx\`, \`access-logs/\`, \`card-actions/\` |
| \`/admin/*\` | Gated by Admin / Exec role | Sites, fleet registry, employee RBAC, AI token costs | \`app/admin/layout.tsx\` (independent RBAC re-check) |
| \`/database\` | Gated by Admin / Lead | Supabase PostgreSQL schema, query latency, index health | \`createReadReplicaClient()\`, schema explorer |
| \`/api/*\` | Authenticated Handlers | Codebase maps, system health probes, hardware webhooks | \`getAuthenticatedEmployee()\` explicit auth check |

---

## 🔒 Security Invariants & Server Action Contract

Every Server Action strictly adheres to the machine-enforced 7-step execution order:
1. **Authenticate**: Verify identity via \`getAuthenticatedEmployee()\`.
2. **Authorize**: Verify role/department claims against resource requirements.
3. **Validate**: Parse input payload using canonical Zod schemas from \`@repo/contract\`.
4. **Rate-Limit**: Token-bucket limit via \`@repo/rate-limiter\` (\`RedisStore\` / \`MemoryStore\`).
5. **Mutate**: Atomic execution via Supabase PL/pgSQL RPC or Kysely query.
6. **Invalidate**: Clear Next.js data cache and Redis L1/L2 tags via \`updateTagInAction()\`.
7. **Redirect / Return**: Return typed response or trigger \`redirect()\` only after cache eviction.
`,
    },
    {
      key: 'database-schema',
      filename: 'database-schema.md',
      title: 'Database Schema & Topology Map',
      category: 'Database & Security',
      summary:
        'Postgres schema topology, 189 migrations, 100% InitPlan RLS policy enforcement, and entity relationships.',
      content: `# 🔒 Database Schema & Topology Map

**Generated:** \${dateInfo.displayDate}  
**Engine:** PostgreSQL 17 via Supabase  
**Migrations SSoT:** \`packages/database/migrations/\` (189 Applied Immutable Migrations)

---

## 📊 Core Mining Entity Relationship Diagram

\`\`\`mermaid
erDiagram
    EMPLOYEES {
        uuid id PK
        string email UK
        string full_name
        string role
        string department_id FK
        boolean is_active
        timestamp created_at
    }
    DEPARTMENTS {
        string id PK
        string name UK
        string description
        string slug
    }
    OPERATORS {
        uuid id PK
        uuid employee_id FK
        string badge_number UK
        string certification_level
        string machine_class
    }
    SITES {
        uuid id PK
        string name UK
        string location_coordinates
        string operational_status
    }
    MINE_BLOCKS {
        uuid id PK
        uuid site_id FK
        string bench_level
        float material_density
    }
    MACHINES {
        uuid id PK
        uuid site_id FK
        string model
        string machine_type
        string telemetry_tag UK
        string status
    }
    DAILY_LOGS {
        uuid id PK
        uuid site_id FK
        uuid created_by FK
        date log_date
        string shift_type
        string status
    }
    BREAKDOWNS {
        uuid id PK
        uuid machine_id FK
        uuid reported_by FK
        timestamp started_at
        timestamp resolved_at
        string severity
        string delay_reason
    }
    HOURLY_LOADS {
        uuid id PK
        uuid daily_log_id FK
        uuid machine_id FK
        int load_count
        float payload_tonnage
        int hour_interval
    }
    SHIFT_CLOSEOUTS {
        uuid id PK
        uuid daily_log_id FK
        uuid finalized_by FK
        jsonb supervisor_metrics
        timestamp closed_at
    }
    ACCESS_CARDS {
        uuid id PK
        uuid employee_id FK
        string card_hash UK
        boolean is_revoked
    }

    DEPARTMENTS ||--o{ EMPLOYEES : "assigns"
    EMPLOYEES ||--o{ OPERATORS : "rosters"
    EMPLOYEES ||--o{ ACCESS_CARDS : "holds"
    EMPLOYEES ||--o{ DAILY_LOGS : "logs"
    EMPLOYEES ||--o{ BREAKDOWNS : "reports"
    SITES ||--o{ MINE_BLOCKS : "contains"
    SITES ||--o{ MACHINES : "deploys"
    SITES ||--o{ DAILY_LOGS : "locates"
    MACHINES ||--o{ BREAKDOWNS : "incurs"
    MACHINES ||--o{ HOURLY_LOADS : "transports"
    DAILY_LOGS ||--o{ HOURLY_LOADS : "records"
    DAILY_LOGS ||--o{ SHIFT_CLOSEOUTS : "finalizes"
\`\`\`

---

## 🛡️ Security & Row Level Security (RLS) Mandates

1. **100% Table RLS Coverage**: Every table in \`public\` schema has Row Level Security enabled.
2. **InitPlan Subquery Optimization**: Policies wrap \`auth.uid()\` in scalar subqueries (e.g. \`(SELECT auth.uid())\`), enabling PostgreSQL query planner to evaluate authentication once per query rather than once per row.
3. **Multi-Tenant Department Isolation**: Employee access is strictly gated by department membership and verified against \`accessible_departments\` claims.
4. **Primary vs. Read Replica Routing**:
   - Transactional mutations & RPCs use \`createServerSupabaseClient()\` directed to primary PgBouncer.
   - Heavy analytical aggregations & overview reports use \`createReadReplicaClient()\` to protect OLTP throughput.
5. **Contract Parity**: Every database column has a matching runtime Zod validator in \`packages/contract/src/schemas/\`, validated on every commit by \`pnpm audit:drift\`.
`,
    },
    {
      key: 'ci-cd-pipeline',
      filename: 'ci-cd-pipeline.md',
      title: 'CI/CD Pipeline & Quality Gate Map',
      category: 'DevOps & CI/CD',
      summary:
        'Multi-stage pipeline: local preflight, parallel CI matrices, security audits, build, deploy, and health probes.',
      content: `# 🚀 CI/CD Pipeline & Quality Gate Topology Map

**Generated:** \${dateInfo.displayDate}  
**Orchestration:** Local Preflight + GitHub Actions + Vercel Production Deploy

---

## 🧪 Visual Multi-Stage Pipeline & Verification Flow

\`\`\`mermaid
flowchart TD
    subgraph Preflight ["Phase 1: Local Preflight & Completion Gate"]
        H_PRE["Husky pre-commit (lint-staged, skills check)"]
        H_PUSH["Husky pre-push -> agent-verify.sh"]
        GATE["15-Step Gate: TypeCheck -> Lint -> Test -> Policy -> Drift -> Knip"]
        H_PRE --> H_PUSH
        H_PUSH --> GATE
    end

    subgraph CI ["Phase 2: GitHub Actions CI Matrix"]
        CI_LINT["turbo run lint (Biome)"]
        CI_TC["turbo run type-check (Strict TS)"]
        CI_TEST["turbo run test (Jest Unit & Integration)"]
        CI_AUDIT["pnpm audit:compliance (RLS, Caching, Routing)"]
        CI_SEC["Security Scans: CodeQL, Gitleaks, Semgrep, Trivy"]
    end

    subgraph Build ["Phase 3: Deterministic Monorepo Build"]
        SYNC["sync-assets-smart.cjs (Public Assets SSoT)"]
        GLASS["patch-glass-css.mjs (OKLCH Glass Token Fixes)"]
        TURBO_BUILD["turbo run build (Next.js 16 + Remote Cache)"]
        SYNC --> GLASS
        GLASS --> TURBO_BUILD
    end

    subgraph Deploy ["Phase 4: Deployment & Release Engine"]
        VERCEL["Vercel Production Deploy / Canary"]
        DOCKER["Docker Multi-Stage Container Build"]
        KUBE["Kubernetes / Helm Manifest Validation"]
    end

    subgraph PostDeploy ["Phase 5: Post-Deployment Smoke & Health Probes"]
        PROBE_LIVE["GET /api/health/live (Process Liveness)"]
        PROBE_REDIS["GET /api/health/redis (Cache & Limits)"]
        PROBE_DB["GET /api/health (Database Connection Pool)"]
        SYNTH["Synthetic Playwright E2E Navigation Canaries"]
    end

    GATE -->|Git Push| CI
    CI_LINT --> Build
    CI_TC --> Build
    CI_TEST --> Build
    CI_AUDIT --> Build
    CI_SEC --> Build
    TURBO_BUILD --> Deploy
    Deploy --> PostDeploy
\`\`\`

---

## 📋 Comprehensive Quality Gates Reference

1. **\`turbo run type-check\`**: Zero \`any\`, zero \`@ts-ignore\`, concurrency=2.
2. **\`turbo run lint\`**: Biome formatter & linter enforcing single quotes, sorted Tailwind classes, and clean syntax.
3. **\`turbo run test\`**: Hermetic Jest suites across apps, feature libs, and shared packages.
4. **\`pnpm policy:check\`**: Monorepo scope-tagging boundaries verified by \`policy-compiler.cjs\`.
5. **\`pnpm audit:drift\`**: Database schema vs. \`@repo/contract\` Zod definition parity.
6. **\`pnpm audit:compliance\`**: Exhaustive invariant scan across RLS, server cache profiles, RSC, routing, and design system rules.
7. **\`pnpm deps:lint\` & \`pnpm knip\`**: Syncpack version harmonization and dead code eradication.
`,
    },
    {
      key: 'technology-stack',
      filename: 'technology-stack.md',
      title: 'Technology Stack & Catalog Map',
      category: 'Architecture & Stack',
      summary:
        'Inventory of runtime engines, Next.js 16, React 19, OKLCH design system, Redis façade, and Architectural Decision Records.',
      content: `# ⚡ Technology Stack & Catalog Map

**Generated:** \${dateInfo.displayDate}  
**Architecture:** Federated Turborepo Monorepo + Next.js 16 App Router + Supabase PostgreSQL 17

---

## 🛠️ Technology Catalog & Runtime Specifications

| Layer | Technology | Version / Spec | Responsibility |
| :--- | :--- | :--- | :--- |
| **Monorepo Engine** | Turborepo + pnpm | Turbo 2.x, pnpm 9.15.9 | Task pipeline hashing, catalog versioning, remote caching |
| **Frontend Framework** | Next.js App Router | 16.3.8 | Edge request proxy (\`proxy.ts\`), React Server Components, Server Actions |
| **UI Runtime** | React | 19.x | Concurrent transitions, \`use()\` promise unwrap, Server Components |
| **Design System** | OKLCH Tokens + Tailwind | Tailwind 3.4.x | Light-mode only, semantic OKLCH color space, Liquid GlassCard surfaces |
| **Persistence** | Supabase PostgreSQL | PostgreSQL 17 | PgBouncer pool, 189 immutable SQL migrations, 100% InitPlan RLS |
| **Cache & Limits** | Redis Cluster | Redis 7.x | L1/L2 cache tags, RBAC sessions, stream consumer groups, token bucket |
| **Contracts & Validation**| Zod | Zod 3.x (\`@repo/contract\`) | Canonical mutation and query schemas with zero database-to-API drift |
| **Telemetry & Observability** | OpenTelemetry + Langfuse | OTEL SDK + Langfuse | Distributed spans, AI agent cost accounting, trace inspection |
| **Testing & Quality** | Biome, Jest, Playwright | Modern Agent Toolchain | Strict linting, unit/integration testing, visual regression testing |

---

## 🏛️ Architectural Decision Records (ADRs)

- **ADR-001: Next.js 16 Request Proxy over middleware.ts**  
  *Context:* Next.js 16 replaces \`middleware.ts\` with \`proxy.ts\`.  
  *Decision:* Route all edge requests through \`apps/portal/proxy.ts\` to generate per-request \`x-nonce\` and set strict Content-Security-Policy headers before delegating auth claims to \`server/proxy.ts\`.

- **ADR-002: Capability-Only Redis Façade**  
  *Context:* Direct Redis command execution introduces vendor lock-in and fails in serverless environments.  
  *Decision:* All Redis interactions ride the transport façade \`raw.ts\` in \`@repo/redis\`. Exposes dedicated doors: caching, sessions, streams, locks, analytics, and vector search with automatic graceful degradation.

- **ADR-003: Pure Light-Mode OKLCH Design Tokens**  
  *Context:* Industrial mining pit displays require extreme outdoor daylight contrast.  
  *Decision:* Enforce a single canonical light mode (canvas \`#f3f4f6\`) using perceptual OKLCH color primitives from \`@repo/theme\`. Dark mode variants (\`dark:\`) and raw hex codes are strictly prohibited.

- **ADR-004: Zod Contract Parity as Single Source of Truth**  
  *Context:* Discrepancies between SQL schemas and frontend types cause runtime mutation crashes.  
  *Decision:* All API payloads and database tables require Zod schemas in \`packages/contract/src/schemas/\`. CI enforces 100% parity via \`pnpm audit:drift\`.
`,
    },
    {
      key: 'project-dependencies',
      filename: 'project-dependencies.md',
      title: 'Project Dependencies & Monorepo Graph Map',
      category: 'Workspace Graph',
      summary:
        'Dependency relationships, scope-tag hierarchy, and module boundaries in the monorepo.',
      content: `# 🕸️ Project Dependencies & Monorepo Graph Map

**Generated:** \${dateInfo.displayDate}  
**Workspace:** Turborepo Monorepo Workspace (pnpm 9.15.9)

---

## 📦 Package Dependency & Boundary Rules

\`\`\`mermaid
flowchart TD
    subgraph Apps ["Applications (scope:app:portal)"]
        PORTAL["apps/portal (:3000)"]
    end

    subgraph Features ["Domain Feature Libraries (scope:feature)"]
        F_HUB["@repo/hub"]
        F_DEPTS["@repo/departments"]
        F_AUTH["@repo/auth"]
    end

    subgraph Packages ["Shared Packages (scope:package)"]
        P_UI["@repo/ui (scope:package:ui)"]
        P_THEME["@repo/theme (scope:package:theme)"]
        P_SUPA["@repo/supabase (scope:package:supabase)"]
        P_CONTRACT["@repo/contract (scope:package:contract)"]
        P_REDIS["@repo/redis (scope:package:redis)"]
    end

    subgraph Database ["Database Core (scope:package:db-internal)"]
        P_DB["@repo/database (PostgreSQL 17)"]
    end

    PORTAL --> F_HUB
    PORTAL --> F_DEPTS
    PORTAL --> F_AUTH
    PORTAL --> P_UI
    PORTAL --> P_SUPA
    PORTAL --> P_CONTRACT
    PORTAL --> P_REDIS

    F_HUB --> P_UI
    F_DEPTS --> P_UI
    F_AUTH --> P_CONTRACT

    P_UI --> P_THEME
    P_SUPA --> P_DB
    P_CONTRACT --> P_DB
\`\`\`

---

## 🚫 Module Boundary Enforcement Matrix

| Source Scope | Allowed Targets | Strictly Forbidden Targets | Enforcement Gate |
| :--- | :--- | :--- | :--- |
| \`scope:app\` | \`scope:package\`, \`scope:feature\` | \`scope:package:db-internal\` | \`pnpm policy:check\` |
| \`scope:package:ui\` | \`scope:package:theme\` | \`scope:package:db-internal\`, \`scope:package:supabase\`, \`apps/*\` | \`pnpm policy:check\` |
| \`scope:package:theme\` | Tokens source (\`tokens.json\`) | \`scope:package:ui\`, \`apps/*\` | \`pnpm policy:check\` |
| \`scope:feature\` | \`@repo/ui\`, \`@repo/contract\`, \`@repo/supabase\` | \`@repo/database\` direct access | \`pnpm policy:check\` |
| \`scope:tool\` | Local Node utilities, static AST tools | \`apps/*\`, runtime database clients | \`pnpm policy:check\` |
`,
    },
    {
      key: 'turbo-graph',
      filename: 'turbo-graph.md',
      title: 'Turborepo Project Graph & Task Pipeline Map',
      category: 'Monorepo Orchestration',
      summary:
        'Visual Mermaid diagram of Turborepo task execution graph, caching pipelines, and project hierarchy.',
      content: `# ⚡ Turborepo Project Graph & Task Pipeline Map

**Generated:** \${dateInfo.displayDate}  
**Orchestration Engine:** Turborepo 2.x + pnpm Workspaces

---

## 🎨 Visual Turborepo Task Execution Pipeline

\`\`\`mermaid
flowchart TD
    subgraph Inputs ["Inputs & Inputs Hashing"]
        SG["globalDependencies (tsconfig.json, pnpm-workspace.yaml, .env)"]
        PR["$TURBO_DEFAULT$"]
    end

    subgraph Codegen ["Phase 1: Code & Asset Generation"]
        CG["@repo/theme:codegen"]
        SA["apps/portal:sync-assets"]
    end

    subgraph Execution ["Phase 2: Parallel Task Execution"]
        BUILD["turbo run build"]
        LINT["turbo run lint"]
        TC["turbo run type-check"]
        TEST["turbo run test"]
    end

    subgraph Cache ["Phase 3: Cache Storage & Hashing"]
        CACHE[".turbo/cache / Local & Remote Cache"]
    end

    SG --> CG
    PR --> CG
    SG --> SA
    PR --> SA

    CG --> BUILD
    SA --> BUILD
    PR --> BUILD
    PR --> LINT
    PR --> TC
    PR --> TEST

    BUILD --> CACHE
    LINT --> CACHE
    TC --> CACHE
    TEST --> CACHE
\`\`\`

---

## 🏷️ Turborepo Scope Tagging Hierarchy

\`\`\`mermaid
graph TD
    subgraph Apps ["Applications (apps/*)"]
        PORTAL["scope:app:portal (Unified Mining Operations & Overview Portal)"]
    end

    subgraph Features ["Feature Libraries (libs/features/*)"]
        HUB["scope:feature (hub)"]
        DEPTS["scope:feature (departments)"]
        AUTH_FEAT["scope:feature (auth)"]
    end

    subgraph Packages ["Shared Packages (packages/*)"]
        UI["scope:package:ui"]
        THEME["scope:package:theme"]
        SUPABASE["scope:package:supabase"]
        CONTRACT["scope:package:contract"]
        REDIS["scope:package:redis"]
    end

    subgraph Database ["Database Layer (packages/database)"]
        DB["scope:package:db & scope:package:db-internal"]
    end

    PORTAL --> HUB
    PORTAL --> DEPTS
    PORTAL --> UI
    PORTAL --> SUPABASE
    PORTAL --> CONTRACT
    PORTAL --> REDIS

    HUB --> UI
    DEPTS --> UI

    SUPABASE --> DB
    CONTRACT --> DB
\`\`\`

---

## ⚙️ Turborepo Configuration Overview (\`turbo.json\`)

- **Task Pipelines**: \`build\`, \`lint\`, \`type-check\`, \`test\`, \`codegen\`, \`sync-assets\`
- **Task Hashing**: Inputs hash includes \`globalDependencies\`, \`globalEnv\`, and \`$TURBO_DEFAULT$\`
- **Caching**: \`build\`, \`lint\`, \`type-check\`, \`test\`, \`codegen\` set to \`cache: true\`
- **Boundary Rules**: Enforces zero illegal imports from UI to Database internals via \`policy-compiler.cjs\`
`,
    },
    {
      key: 'dependencies-graph',
      filename: 'dependencies-graph.md',
      title: 'Monorepo Dependencies & Topology Graph Map',
      category: 'Workspace Architecture',
      summary:
        'Visual Mermaid diagram of complete monorepo dependency graph and module boundary matrix.',
      content: `# 🕸️ Monorepo Dependencies & Topology Graph Map

**Generated:** \${dateInfo.displayDate}  
**Architecture:** Turborepo Monorepo Topology

---

## 📊 Visual Monorepo Architecture Graph

\`\`\`mermaid
graph LR
    subgraph ClientApps ["Presentation & App Layer"]
        A_PORTAL["apps/portal (:3000 - Portal & Overview)"]
    end

    subgraph DomainLibs ["Domain Feature Libraries"]
        L_HUB["libs/features/hub/ui"]
        L_DEPTS["libs/features/departments/ui"]
        L_AUTH["libs/features/auth/ui"]
    end

    subgraph InfraPackages ["Shared Infrastructure Packages"]
        P_UI["@repo/ui (OKLCH Glass UI)"]
        P_THEME["@repo/theme (OKLCH Palette)"]
        P_SUPABASE["@repo/supabase (Supabase Clients)"]
        P_CONTRACT["@repo/contract (Zod Schemas)"]
        P_REDIS["@repo/redis (Rate Limiter)"]
        P_LOGGER["@repo/logger (Winston/Pino)"]
    end

    subgraph CoreData ["Database Core"]
        P_DB["@repo/database (Migrations & Schema)"]
    end

    A_PORTAL --> L_HUB
    A_PORTAL --> L_DEPTS
    A_PORTAL --> L_AUTH
    A_PORTAL --> P_UI
    A_PORTAL --> P_SUPABASE
    A_PORTAL --> P_CONTRACT
    A_PORTAL --> P_REDIS

    L_HUB --> P_UI
    L_DEPTS --> P_UI
    L_AUTH --> P_CONTRACT

    P_UI --> P_THEME
    P_SUPABASE --> P_DB
    P_CONTRACT --> P_DB

    classDef appStyle fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef libStyle fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#15803d;
    classDef pkgStyle fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#b45309;
    classDef dbStyle fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#b91c1c;

    class A_PORTAL appStyle;
    class L_HUB,L_DEPTS,L_AUTH libStyle;
    class P_UI,P_THEME,P_SUPABASE,P_CONTRACT,P_REDIS,P_LOGGER pkgStyle;
    class P_DB dbStyle;
\`\`\`

---

## 🚫 Module Boundary Enforcement Matrix

| Source Tag | Allowed Dependencies | Forbidden Dependencies |
| :--- | :--- | :--- |
| \`scope:app\` | \`scope:package\`, \`scope:feature\` | \`scope:package:db-internal\` |
| \`scope:package:ui\` | \`scope:package:theme\` | \`scope:package:db\`, \`scope:package:db-internal\`, \`scope:package:supabase\` |
| \`scope:package:theme\` | Primitive tokens | \`scope:package:ui\` |
| \`scope:tool\` | Local Node scripts | \`scope:app\`, \`scope:package:supabase\` |
`,
    },
    {
      key: 'package-structure',
      filename: 'package-structure.md',
      title: 'Package Structure & Module Map',
      category: 'Monorepo Packages',
      summary: 'Directory layout, package responsibilities, and workspace modularization rules.',
      content: `# 📁 Package Structure & Module Map

**Generated:** \${dateInfo.displayDate}  
**Standard**: Clean Workspace Modularization + Strict Directional Layering

---

## 📂 Visual Monorepo Structure & Package Hierarchy

\`\`\`mermaid
flowchart TD
    ROOT["Fork / Federated Workspace Root"]
    
    subgraph AppLayer ["apps/ (Applications)"]
        PORTAL["portal (Next.js 16 App Router · mining operations)"]
    end

    subgraph FeatureLayer ["libs/features/ (Domain Feature Libraries)"]
        AUTH_LIB["@repo/auth (ui · data-access · utils)"]
        DEPTS_LIB["@repo/departments (ui · data-access · utils)"]
        HUB_LIB["@repo/hub (ui · data-access · utils)"]
    end

    subgraph SharedLayer ["libs/shared/ (Shared Feature Primitives)"]
        SHARED_DA["@repo/shared/data-access"]
        SHARED_HOOKS["@repo/shared/hooks"]
        SHARED_UTILS["@repo/shared/utils"]
    end

    subgraph PackageLayer ["packages/ (Core Infrastructure)"]
        P_UI["@repo/ui (GlassCard · Radix primitives)"]
        P_THEME["@repo/theme (OKLCH tokens · Tailwind preset)"]
        P_CONTRACT["@repo/contract (Canonical Zod Schemas)"]
        P_SUPABASE["@repo/supabase (SSR client · Kysely factory)"]
        P_DATABASE["@repo/database (PostgreSQL 17 migrations)"]
        P_REDIS["@repo/redis (L1/L2 cache · session · streams)"]
        P_ERRORS["@repo/errors (AppError hierarchy)"]
        P_LOGGER["@repo/logger (Structured Pino/Winston)"]
        P_RATELIMIT["@repo/rate-limiter (Token bucket)"]
        P_AGENTS["@repo/agents (Specialist swarms · Langfuse)"]
    end

    ROOT --> PORTAL
    PORTAL --> FeatureLayer
    FeatureLayer --> SharedLayer
    FeatureLayer --> PackageLayer
\`\`\`

---

## 📂 Detailed Directory Responsibilities

- **\`apps/portal/\`**: Unified Next.js 16 App Router application. Contains route groups, \`proxy.ts\`, Server Actions, and \`lib/server-cache.ts\`.
- **\`packages/\`**: Reusable shared infrastructure libraries:
  - \`@repo/ui\`: Pure presentational React 19 components (GlassCard, Button, Tabs, Badge). Storybook-tested.
  - \`@repo/theme\`: Single Source of Truth for OKLCH color primitives and Tailwind configuration preset.
  - \`@repo/contract\`: Canonical Zod schemas defining all database tables, API mutations, and input validation.
  - \`@repo/supabase\`: SSR/Browser/Kysely Supabase client factories and auth helpers.
  - \`@repo/database\`: Numbered SQL migrations (\`migrations/*.sql\`), RLS policies, and generated DB types.
  - \`@repo/redis\`: Capability-only façade for L1/L2 caching, session management, locks, and streams.
  - \`@repo/errors\`: Canonical \`AppError\` domain error class hierarchy.
  - \`@repo/logger\`: Structured telemetry and log formatting.
  - \`@repo/rate-limiter\`: Token bucket and sliding window rate limiting.
  - \`@repo/agents\`: Multi-agent orchestration, LLM Critique Council, and Langfuse tracing.
- **\`libs/features/\`**: Domain-specific business logic divided into \`ui\`, \`data-access\`, and \`utils\`:
  - \`@repo/auth\`: Authentication forms, session guards, and credential handlers.
  - \`@repo/departments\`: Mining operational departments (drilling, production, control room, engineering, access control).
  - \`@repo/hub\`: Central Command Hub carousel, live department grid, and KPI strip.
- **\`libs/shared/\`**: Cross-feature shared utilities, custom hooks, and data-access adapters.
- **\`tools/\`**: Build-time verification scripts, policy compiler, anti-drift test suites, and codebase map generators.
- **\`codebase-maps/\`**: Automated architectural topology maps, versioned snapshots, and metadata manifest index.
`,
    },
    {
      key: 'multi-agent-architecture',
      filename: 'multi-agent-architecture.md',
      title: 'Multi-Agent Architecture & Pre-Flight Research Gate Map',
      category: 'Agent Orchestration',
      summary:
        'Role-assigned specialist agents, SubagentCoordinator, and the mandatory Architectural Pre-Flight Research Gate.',
      content: `# 🤖 Multi-Agent Architecture & Pre-Flight Research Gate Map

**Generated:** \${dateInfo.displayDate}  
**Package:** \`@repo/agents\`  
**Orchestration:** Multi-Agent Specialist Hierarchy + Langfuse Tracing + MCP Integration

---

## 🏛️ Autonomous Specialist Persona Roster

\`\`\`mermaid
flowchart TD
    USER["User Request / Goal"] --> MGR["Engineering Manager"]
    MGR --> COUNCIL["LLM Critique Council (5-Layer Gates)"]
    COUNCIL --> COORD["SubagentCoordinator (@repo/agents)"]

    subgraph PreFlight ["Mandatory Pre-Flight Research Gate"]
        RS["researchSpecialist (Frontier Systems & SOTA Benchmarks)"]
        BENCH["Evaluates SOTA: Netflix, Uber AST, Shopify, Airbnb, Meta"]
        RS --> BENCH
    end

    COORD -->|Non-Trivial Architectural Refactor| RS
    BENCH -->|Approved JSON Assessment| HOD["Head of Department (HoD)"]

    subgraph Specialists ["Domain Execution Specialists"]
        DBA["databaseArchitect (PostgreSQL & RLS)"]
        UIE["uiEngineer (React 19 & OKLCH Theme)"]
        SECG["securityAndQualityGate (Biome & Playwright)"]
        RTE["realtimeEngineer (Supabase CDC & WS)"]
        RESE["resilienceEngineer (Harsh Pit Network & HUD)"]
        SIMP["systemSimplifier (Debloat & Bundlesize)"]
        TELA["telemetryArchitect (Codebase Maps & Drift)"]
    end

    HOD --> DBA
    HOD --> UIE
    HOD --> SECG
    HOD --> RTE
    HOD --> RESE
    HOD --> SIMP
    HOD --> TELA
\`\`\`

---

## 🔬 Architectural Pre-Flight Research Gate Mandate

- **Rule Source**: \`AGENTS.md\` and Canonical Agent Rules.
- **Implementation**: \`SubagentCoordinator.evaluateArchitecturalPreFlight(proposal, scope)\`.
- **Benchmark Evaluation Surface**:
  - **Airbnb / PayPal**: Semantic Data Contracts (Zero database-to-contract drift).
  - **Netflix / ThoughtWorks**: Architecture-as-Code Fitness Functions (Drift Health Index $ge 90%$).
  - **Uber / Sourcegraph**: AST Codebase Maps & Topology Graphs.
  - **Meta / Google**: Perceptual visual diffing & synthetic navigation canaries.
- **Observability**: Langfuse traces trace every agent invocation, tracking token budget (enforcing $le 30%$ context window usage) and step-by-step tool latency.
`,
    },
  ];
}

/**
 * Main execution function.
 */
function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const isLatestOnly = args.includes('--latest-only');

  const dateInfo = getFormattedDate();
  const maps = buildCodebaseMaps(dateInfo);
  const latestDir = path.join(MAPS_ROOT, 'latest');

  if (isCheck) {
    if (!fs.existsSync(latestDir)) {
      console.error('❌ codebase-maps/latest/ directory does not exist.');
      process.exit(1);
    }
    for (const map of maps) {
      const p = path.join(latestDir, map.filename);
      if (!fs.existsSync(p)) {
        console.error(`❌ Missing map in codebase-maps/latest/: ${map.filename}`);
        process.exit(1);
      }
    }
    console.log('✅ [CODEBASE MAPS] codebase-maps/latest/ verified and complete.');
    process.exit(0);
  }

  console.log('==================================================');
  console.log('🗺️  Generating Codebase Maps & Metadata Index');
  console.log('==================================================\n');

  let folderName;
  let targetDir;
  let logNum;

  if (isLatestOnly) {
    folderName = 'latest';
    targetDir = latestDir;
    logNum = getNextLogNumber() - 1;
    console.log(`📁 Updating codebase-maps/latest/ directly (fast-refresh)\n`);
  } else {
    logNum = getNextLogNumber();
    folderName = `log-${logNum}(${dateInfo.folderDate})`;
    targetDir = path.join(MAPS_ROOT, folderName);
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`📁 Codebase Maps Directory: codebase-maps/${folderName}/\n`);
  }

  const mapsCatalog = [];

  for (const map of maps) {
    const filePath = path.join(targetDir, map.filename);
    fs.writeFileSync(filePath, map.content);

    mapsCatalog.push({
      key: map.key,
      filename: map.filename,
      title: map.title,
      category: map.category,
      summary: map.summary,
      relativePath: `codebase-maps/${folderName}/${map.filename}`,
      sizeBytes: Buffer.byteLength(map.content, 'utf-8'),
    });

    console.log(
      `   ├── ${map.filename} (${(Buffer.byteLength(map.content, 'utf-8') / 1024).toFixed(1)} KB)`
    );
  }

  // Update codebase-maps/latest/ and root directory
  fs.mkdirSync(latestDir, { recursive: true });

  for (const map of maps) {
    fs.writeFileSync(path.join(latestDir, map.filename), map.content);
    fs.writeFileSync(path.join(MAPS_ROOT, map.filename), map.content);
  }

  // Update manifest.json
  const manifestPath = path.join(MAPS_ROOT, 'manifest.json');
  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      manifest = [];
    }
  }

  if (!isLatestOnly) {
    manifest = manifest.filter(
      (entry) => entry.folderName !== folderName && entry.id !== folderName
    );

    manifest.unshift({
      id: folderName,
      logNumber: logNum,
      folderName,
      folderDate: dateInfo.folderDate,
      isoDate: dateInfo.isoDate,
      displayDate: dateInfo.displayDate,
      mapCount: maps.length,
      status: 'Verified & Active',
      maps: mapsCatalog,
    });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(latestDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\n==================================================');
  console.log(`✅ Codebase Maps Synchronized Successfully!`);
  console.log(`📋 Metadata Manifest Index: codebase-maps/manifest.json`);
  console.log(`⚡ Instant Active Access: codebase-maps/latest/`);
  console.log('==================================================\n');
}

main();
