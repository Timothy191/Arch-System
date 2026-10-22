export interface MapKpiMetric {
  label: string;
  value: string;
  detail: string;
}

export interface MapPipelineNode {
  id: string;
  step: string;
  title: string;
  role: string;
  detail: string;
  protocol: string;
  ssotPath: string;
  color: string;
}

export interface MapTopologyGroupItem {
  name: string;
  role: string;
  rule: string;
}

export interface MapTopologyGroup {
  title: string;
  badge: string;
  scopeTag: string;
  color: string;
  items: MapTopologyGroupItem[];
}

export interface MapBoundaryRule {
  source: string;
  allowed: string;
  forbidden: string;
  gate: string;
}

export interface CodebaseMapSpec {
  key: string;
  label: string;
  shortLabel: string;
  category: string;
  subtitle: string;
  accentColor: string;
  kpis: MapKpiMetric[];
  pipelineTitle: string;
  pipelineSubtitle: string;
  pipelineBadge: string;
  pipelineNodes: MapPipelineNode[];
  topologyTitle: string;
  topologySubtitle: string;
  topologyGroups: MapTopologyGroup[];
  boundaryRules: MapBoundaryRule[];
  markdownContent: string;
}

export const CODEBASE_MAP_SPECS: CodebaseMapSpec[] = [
  {
    key: 'turbo-graph.md',
    label: 'Turbo Project Graph & Pipeline',
    shortLabel: 'Turbo Graph & Pipeline',
    category: 'Build & Task DAG',
    subtitle:
      'Turborepo 2.x + pnpm 9.15.9 task execution graph, input hashing, codegen pre-flight, and content-addressable cache topology.',
    accentColor: '#2563eb',
    kpis: [
      {
        label: 'Task Pipelines',
        value: '6 Active DAGs',
        detail: 'build · lint · type-check · test · codegen · sync-assets',
      },
      {
        label: 'Execution Phases',
        value: '4 Topological',
        detail: 'Inputs Hashing → Codegen → Parallel Run → Remote Cache',
      },
      {
        label: 'Cache Strategy',
        value: 'Local + Remote',
        detail: '.turbo/cache + deterministic $TURBO_DEFAULT$ SHA inputs',
      },
      {
        label: 'Boundary Drift',
        value: '0 Violations',
        detail: 'Enforced via policy-compiler.cjs & eslint.boundaries.cjs',
      },
    ],
    pipelineTitle: 'Visual Turborepo Task Execution & Cache Pipeline',
    pipelineSubtitle:
      'Deterministic topological execution from workspace dependency hashing through theme codegen to parallel task runners and cache storage',
    pipelineBadge: 'turbo.json · Concurrency=2 Type-Check',
    pipelineNodes: [
      {
        id: 'turbo-inputs',
        step: 'PHASE 01',
        title: 'Inputs & Global Hashing',
        role: '$TURBO_DEFAULT$ + Global Env',
        detail:
          'Computes deterministic content hashes over tsconfig.json, pnpm-workspace.yaml, .env, and package source trees.',
        protocol: 'globalDependencies Hash',
        ssotPath: 'turbo.json',
        color: '#2563eb',
      },
      {
        id: 'turbo-codegen',
        step: 'PHASE 02',
        title: 'Code & Asset Generation',
        role: '@repo/theme + sync-assets',
        detail:
          'Compiles OKLCH tokens.json into CSS/TS artifacts and runs sync-assets-smart.cjs + patch-glass-css.mjs before build.',
        protocol: '^codegen -> sync-assets',
        ssotPath: 'packages/theme/tokens.json',
        color: '#7c3aed',
      },
      {
        id: 'turbo-parallel',
        step: 'PHASE 03',
        title: 'Parallel DAG Execution',
        role: 'build · lint · type-check · test',
        detail:
          'Executes package graphs in topological order (^build) across 14 @repo/* packages, 3 feature domains, and apps/portal.',
        protocol: 'turbo run build lint test',
        ssotPath: 'pnpm-workspace.yaml',
        color: '#059669',
      },
      {
        id: 'turbo-policy',
        step: 'PHASE 04',
        title: 'Policy & Contract Gate',
        role: 'policy:check + audit:drift',
        detail:
          'Validates scope tags (scope:app, scope:feature, scope:package, scope:package:db) and Zod schema parity.',
        protocol: 'tools/repo/policy-compiler.cjs',
        ssotPath: 'tools/repo/policy/project-tags.json',
        color: '#d97706',
      },
      {
        id: 'turbo-cache',
        step: 'PHASE 05',
        title: 'Cache Storage & Replay',
        role: '.turbo/cache + Vercel Remote',
        detail:
          'Persists build outputs (.next/**, dist/**) and test logs for sub-second FULL TURBO replay across CI and local runs.',
        protocol: 'cache: true · Remote Artifact',
        ssotPath: '.turbo/cache',
        color: '#0284c7',
      },
    ],
    topologyTitle: 'Turborepo Scope Tagging Hierarchy & Workspace DAG',
    topologySubtitle:
      'Machine-enforced directional dependency flow across Applications, Feature Libraries, Shared Packages, and Database Core',
    topologyGroups: [
      {
        title: 'Applications Layer (apps/*)',
        badge: 'Entry Point',
        scopeTag: 'scope:app:portal',
        color: '#2563eb',
        items: [
          {
            name: 'apps/portal (Next.js 16.3.8)',
            role: 'Unified Mining Operations & Overview Portal',
            rule: 'Consumes @repo/ui, @repo/supabase, @repo/contract, @repo/redis, and libs/features/*',
          },
          {
            name: 'apps/portal/proxy.ts',
            role: 'Edge CSP Nonce + Auth Refresh Proxy',
            rule: 'Delegates session & RBAC claims to server/proxy.ts via @repo/supabase/middleware',
          },
        ],
      },
      {
        title: 'Feature Libraries (libs/features/*)',
        badge: '3 Domains',
        scopeTag: 'scope:feature',
        color: '#059669',
        items: [
          {
            name: '@repo/hub (ui · data-access · utils)',
            role: 'Central Command Hub & Bento Grid',
            rule: 'Depends on @repo/ui and @repo/contract; isolated from raw database internals',
          },
          {
            name: '@repo/departments (ui · data-access · utils)',
            role: 'Drilling, Production, Control Room, Engineering, Access Control',
            rule: 'Depends on @repo/ui, @repo/supabase, and @repo/contract',
          },
          {
            name: '@repo/auth (ui · data-access · utils)',
            role: 'PKCE Auth Flows & RBAC Session Guards',
            rule: 'Validates credentials via @repo/contract Zod schemas',
          },
        ],
      },
      {
        title: 'Shared Infrastructure (packages/*)',
        badge: '12 Packages',
        scopeTag: 'scope:package:*',
        color: '#d97706',
        items: [
          {
            name: '@repo/ui & @repo/theme',
            role: 'Light-Mode OKLCH Tokens & Liquid Glass Components',
            rule: '@repo/ui -> @repo/theme only; zero database or supabase imports allowed',
          },
          {
            name: '@repo/supabase & @repo/contract',
            role: 'SSR Data Gateway & Canonical Zod Schemas',
            rule: 'Sole authorized bridge between apps/portal and @repo/database',
          },
          {
            name: '@repo/redis, @repo/rate-limiter, @repo/logger',
            role: 'Hybrid L1/L2 Cache, Token Bucket Limiter & Structured Telemetry',
            rule: 'Hermetic service factories with zero circular dependencies',
          },
        ],
      },
      {
        title: 'Database Core (packages/database)',
        badge: '189 Migrations',
        scopeTag: 'scope:package:db-internal',
        color: '#dc2626',
        items: [
          {
            name: '@repo/database',
            role: 'PostgreSQL 17 Migrations, RLS Policies & Generated Types',
            rule: 'Forbidden from direct import in apps/* or @repo/ui; accessed via @repo/supabase',
          },
          {
            name: 'supabase/migrations/*.sql',
            role: 'Immutable Zero-Padded SQL Ledger',
            rule: 'Verified by migration-rollback-safety.mjs and audit-contract-drift.cjs',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'apps/portal (scope:app:portal)',
        allowed: '@repo/ui, @repo/supabase, @repo/contract, @repo/redis, libs/features/*',
        forbidden: '@repo/database (scope:package:db-internal)',
        gate: 'pnpm policy:check',
      },
      {
        source: '@repo/ui (scope:package:ui)',
        allowed: '@repo/theme, lucide-react, radix-ui',
        forbidden: '@repo/database, @repo/supabase, apps/*',
        gate: 'pnpm policy:check',
      },
      {
        source: '@repo/theme (scope:package:theme)',
        allowed: 'tokens.json primitive & semantic OKLCH definitions',
        forbidden: '@repo/ui, @repo/supabase, apps/*',
        gate: 'pnpm policy:check',
      },
      {
        source: 'tools/* (scope:tool)',
        allowed: 'Node build/audit scripts & static AST analyzers',
        forbidden: 'apps/*, @repo/supabase runtime clients',
        gate: 'pnpm policy:check',
      },
    ],
    markdownContent: `# ⚡ Turborepo Project Graph & Task Pipeline Map

**Orchestration Engine:** Turborepo 2.x + pnpm 9.15.9 Workspaces

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

## ⚙️ Turborepo Configuration Overview (\`turbo.json\`)

- **Task Pipelines**: \`build\`, \`lint\`, \`type-check\`, \`test\`, \`codegen\`, \`sync-assets\`
- **Task Hashing**: Inputs hash includes \`globalDependencies\`, \`globalEnv\`, and \`$TURBO_DEFAULT$\`
- **Caching**: \`build\`, \`lint\`, \`type-check\`, \`test\`, \`codegen\` set to \`cache: true\`
- **Boundary Rules**: Enforces zero illegal imports from UI to Database internals via \`policy-compiler.cjs\``,
  },
  {
    key: 'dependencies-graph.md',
    label: 'Monorepo Dependencies Topology Graph',
    shortLabel: 'Dependencies Topology',
    category: 'Monorepo Graph',
    subtitle:
      'End-to-end package dependency DAG across Presentation Apps, Domain Feature Libraries, Shared Infrastructure, and Database Core.',
    accentColor: '#059669',
    kpis: [
      {
        label: 'Workspace Nodes',
        value: '21 Packages',
        detail: '1 App · 6 Feature/Shared Libs · 14 @repo/* Packages',
      },
      {
        label: 'Catalog SSoT',
        value: 'pnpm Catalogs',
        detail: 'Shared versions in pnpm-workspace.yaml + catalogs.react19',
      },
      {
        label: 'Circular Deps',
        value: '0 Cycles',
        detail: 'Acyclic directed graph verified by turbo & syncpack',
      },
      {
        label: 'Boundary Matrix',
        value: '4 Scope Tiers',
        detail: 'scope:app → scope:feature → scope:package → scope:db',
      },
    ],
    pipelineTitle: 'Visual Monorepo Dependency Resolution & Layering Flow',
    pipelineSubtitle:
      'Strict one-way dependency graph preventing circular imports and enforcing clean separation between presentation and persistence',
    pipelineBadge: 'policy-compiler.cjs · 0 Circular Dependencies',
    pipelineNodes: [
      {
        id: 'dep-app',
        step: 'TIER 01',
        title: 'Presentation & App Layer',
        role: 'apps/portal (:3000)',
        detail:
          'Next.js 16 App Router portal orchestrating route groups, RSC streaming, and leaf client interactivity.',
        protocol: 'scope:app:portal',
        ssotPath: 'apps/portal/package.json',
        color: '#0284c7',
      },
      {
        id: 'dep-features',
        step: 'TIER 02',
        title: 'Domain Feature Libraries',
        role: 'libs/features/{hub,departments,auth}',
        detail:
          'Encapsulates domain-specific UI views, server data-access hooks, and operational calculators.',
        protocol: 'scope:feature',
        ssotPath: 'libs/features/',
        color: '#059669',
      },
      {
        id: 'dep-packages',
        step: 'TIER 03',
        title: 'Shared Infrastructure',
        role: '@repo/{ui,supabase,contract,redis}',
        detail:
          'Provides reusable glass components, Zod validation schemas, SSR Supabase clients, and Redis L1/L2 caches.',
        protocol: 'scope:package',
        ssotPath: 'packages/',
        color: '#d97706',
      },
      {
        id: 'dep-theme',
        step: 'TIER 04',
        title: 'Design Token Primitives',
        role: '@repo/theme (OKLCH SSoT)',
        detail:
          'Zero-dependency token foundation consumed by @repo/ui and apps/portal without reverse coupling.',
        protocol: 'scope:package:theme',
        ssotPath: 'packages/theme/src/tokens/index.ts',
        color: '#7c3aed',
      },
      {
        id: 'dep-db',
        step: 'TIER 05',
        title: 'Database Core Schema',
        role: '@repo/database (PostgreSQL 17)',
        detail:
          'Houses 189 SQL migrations and generated Supabase types consumed strictly by @repo/supabase and @repo/contract.',
        protocol: 'scope:package:db-internal',
        ssotPath: 'packages/database/migrations/',
        color: '#dc2626',
      },
    ],
    topologyTitle: 'Monorepo Layering & Dependency Matrix',
    topologySubtitle:
      'Canonical upstream and downstream dependency edges across all workspace scopes',
    topologyGroups: [
      {
        title: 'App Consumer Edges',
        badge: 'apps/portal',
        scopeTag: 'scope:app -> *',
        color: '#0284c7',
        items: [
          {
            name: 'apps/portal → libs/features/*',
            role: 'Imports Hub, Departments, and Auth feature modules',
            rule: 'Allowed via workspace:* protocol',
          },
          {
            name: 'apps/portal → @repo/{ui,supabase,contract,redis}',
            role: 'Imports presentation, data gateway, schemas, and cache',
            rule: 'Direct import of @repo/database is strictly blocked',
          },
        ],
      },
      {
        title: 'Feature Library Edges',
        badge: 'libs/features/*',
        scopeTag: 'scope:feature -> scope:package',
        color: '#059669',
        items: [
          {
            name: 'libs/features/*/ui → @repo/ui',
            role: 'Composes GlassCard, Badge, Tabs, and OKLCH primitives',
            rule: 'UI libraries never import server-only database drivers',
          },
          {
            name: 'libs/features/*/data-access → @repo/contract',
            role: 'Validates shift closeouts, telemetry, and access logs',
            rule: '100% Zod schema alignment enforced by audit:drift',
          },
        ],
      },
      {
        title: 'UI & Theme Isolation',
        badge: '@repo/ui + @repo/theme',
        scopeTag: 'Pure Presentation',
        color: '#7c3aed',
        items: [
          {
            name: '@repo/ui → @repo/theme',
            role: 'Consumes semantic OKLCH CSS variables and token maps',
            rule: '@repo/theme cannot import @repo/ui (no inversion)',
          },
          {
            name: '@repo/ui Isolation Guard',
            role: 'Storybook-verified presentational component library',
            rule: 'Forbidden from importing @repo/supabase or @repo/database',
          },
        ],
      },
      {
        title: 'Data Gateway & Contract Bridge',
        badge: '@repo/supabase + @repo/contract',
        scopeTag: 'Persistence Boundary',
        color: '#dc2626',
        items: [
          {
            name: '@repo/supabase → @repo/database',
            role: 'Wraps Database types in SSR/Browser/Kysely factories',
            rule: 'Enforces RLS InitPlan session claims on every query',
          },
          {
            name: '@repo/contract → @repo/database',
            role: 'Mirrors SQL table columns in runtime Zod schemas',
            rule: 'Verified on every commit by pnpm audit:drift',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'scope:app',
        allowed: 'scope:package, scope:feature',
        forbidden: 'scope:package:db-internal',
        gate: 'config/tools/eslint.boundaries.cjs',
      },
      {
        source: 'scope:package:ui',
        allowed: 'scope:package:theme',
        forbidden: 'scope:package:db, scope:package:db-internal, scope:package:supabase',
        gate: 'config/tools/eslint.boundaries.cjs',
      },
      {
        source: 'scope:package:theme',
        allowed: 'Primitive & semantic tokens',
        forbidden: 'scope:package:ui, scope:app',
        gate: 'config/tools/eslint.boundaries.cjs',
      },
      {
        source: 'scope:tool',
        allowed: 'Local Node scripts & AST parsers',
        forbidden: 'scope:app, scope:package:supabase',
        gate: 'config/tools/eslint.boundaries.cjs',
      },
    ],
    markdownContent: `# 🕸️ Monorepo Dependencies & Topology Graph Map

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
\`\`\`

---

## 🚫 ESLint Module Boundary Enforcement Matrix

| Source Tag            | Allowed Dependencies             | Forbidden Dependencies                                                    |
| :-------------------- | :------------------------------- | :------------------------------------------------------------------------ |
| \`scope:app\`           | \`scope:package\`, \`scope:feature\` | \`scope:package:db-internal\`                                               |
| \`scope:package:ui\`    | \`scope:package:theme\`            | \`scope:package:db\`, \`scope:package:db-internal\`, \`scope:package:supabase\` |
| \`scope:package:theme\` | Primitive tokens                 | \`scope:package:ui\`                                                        |
| \`scope:tool\`          | Local Node scripts               | \`scope:app\`, \`scope:package:supabase\`                                     |`,
  },
  {
    key: 'route-feature-architecture.md',
    label: 'Route & Feature Architecture',
    shortLabel: 'Route & Feature Map',
    category: 'Next.js 16 Routing',
    subtitle:
      'Next.js 16.3.8 App Router hierarchy, CSP request proxy, Redis-cached employee RBAC claims, and 8 core operational modules.',
    accentColor: '#7c3aed',
    kpis: [
      {
        label: 'Operational Modules',
        value: '8 Core Depts',
        detail: 'Admin · Drilling · Production · Control Room · Engineering · Access · DB · Hub',
      },
      {
        label: 'Request Proxy',
        value: 'Next 16 proxy.ts',
        detail: 'Per-request x-nonce CSP + Redis L1/L2 employee RBAC lookup',
      },
      {
        label: 'Caching SSoT',
        value: 'server-cache.ts',
        detail: 'Named cacheLife() profiles + dual-tier Next/Redis tag invalidation',
      },
      {
        label: 'Action Security',
        value: '7-Step Gate',
        detail: 'Auth → Authorize → Zod Validate → Rate-Limit → Mutate → Invalidate → Redirect',
      },
    ],
    pipelineTitle: 'Next.js 16 Request Proxy, RBAC & Route Resolution Pipeline',
    pipelineSubtitle:
      'End-to-end browser request lifecycle from CSP nonce generation in proxy.ts through Redis employee claim lookup to RSC streaming',
    pipelineBadge: 'apps/portal/proxy.ts → server/proxy.ts',
    pipelineNodes: [
      {
        id: 'route-edge',
        step: 'STAGE 01',
        title: 'Next.js 16 Request Proxy',
        role: 'apps/portal/proxy.ts',
        detail:
          'Generates cryptographic per-request x-nonce and injects strict Content-Security-Policy headers.',
        protocol: 'HTTP Edge Proxy',
        ssotPath: 'apps/portal/proxy.ts',
        color: '#2563eb',
      },
      {
        id: 'route-rbac',
        step: 'STAGE 02',
        title: 'Auth Claims & Redis RBAC',
        role: 'apps/portal/server/proxy.ts',
        detail:
          'Verifies JWT via auth.getClaims() and resolves employee role/department cached at arch:auth:employee:<userId> (TTL 3600s).',
        protocol: 'Supabase SSR + Redis',
        ssotPath: 'apps/portal/server/proxy.ts',
        color: '#7c3aed',
      },
      {
        id: 'route-gating',
        step: 'STAGE 03',
        title: 'Route Gating & Layouts',
        role: 'DEPARTMENT_ROUTES + RESTRICTED_ROUTES',
        detail:
          'Enforces slug validation in app/(departments)/[department]/layout.tsx and independent admin checks in app/admin/layout.tsx.',
        protocol: 'RBAC Guard + notFound()',
        ssotPath: 'apps/portal/app/(departments)/[department]/layout.tsx',
        color: '#d97706',
      },
      {
        id: 'route-rsc',
        step: 'STAGE 04',
        title: 'Server Component Streaming',
        role: 'cachedRSC + Suspense',
        detail:
          'Parallelizes queries via Promise.allSettled() with named cacheLife profiles (telemetry, departments, reports).',
        protocol: 'React 19 RSC + use()',
        ssotPath: 'apps/portal/lib/server-cache.ts',
        color: '#059669',
      },
      {
        id: 'route-actions',
        step: 'STAGE 05',
        title: 'Server Actions & Realtime',
        role: 'updateTagInAction + CDC',
        detail:
          'Validates mutations via @repo/contract Zod schemas, purges Next + Redis L1/L2 tags, and streams Supabase Realtime CDC.',
        protocol: 'Server Action + WebSocket',
        ssotPath: 'apps/portal/actions/',
        color: '#0284c7',
      },
    ],
    topologyTitle: 'App Router Route Groups & Department Hierarchy',
    topologySubtitle:
      'Complete directory mapping across Central Command, Department Modules, Admin Governance, and API Endpoints',
    topologyGroups: [
      {
        title: 'Central Command & Overview',
        badge: 'Core Entry',
        scopeTag: '/hub · /overview · /docs',
        color: '#2563eb',
        items: [
          {
            name: '/ → /hub (Central Operations Hub)',
            role: 'Hero Carousel, Bento Department Grid & Live KPI Strip',
            rule: 'Default authenticated landing route for all mining personnel',
          },
          {
            name: '/overview (System Overview Dashboard)',
            role: '8 Interactive Architecture, Topology, DB, Codemap & Audit Tabs',
            rule: 'Lazy-loaded section visualizers with zero-latency static + live telemetry',
          },
        ],
      },
      {
        title: 'Operational Department Modules',
        badge: 'app/(departments)/',
        scopeTag: 'RBAC Scoped',
        color: '#059669',
        items: [
          {
            name: '/control-room · /drilling · /production',
            role: 'SCADA Telemetry, Drill Rig Depth Logs, Haulage & Tonnage Tracking',
            rule: 'Gated by accessible_departments claim and department slug validation',
          },
          {
            name: '/engineering · /access-control',
            role: 'Breakdown Ledger, Preventive Maintenance, C66 Gate Badging & QR Logs',
            rule: 'Real-time updates via useSupabaseRealtime without client polling loops',
          },
        ],
      },
      {
        title: 'Governance & Data Explorer',
        badge: '/admin · /database',
        scopeTag: 'Restricted RBAC',
        color: '#7c3aed',
        items: [
          {
            name: '/admin (Enterprise Administration)',
            role: 'Sites, Fleet Registry, Employee RBAC, Redis Cache & AI Cost Metrics',
            rule: 'Re-verifies admin/super_admin/executive role independently in layout.tsx',
          },
          {
            name: '/database (PostgreSQL 17 Explorer)',
            role: 'Schema Inspector, Index Health, Query Latencies & Backup Snapshots',
            rule: 'Routes analytical reads through createReadReplicaClient()',
          },
        ],
      },
      {
        title: 'Authentication & API Boundary',
        badge: 'app/(auth)/ · app/api/',
        scopeTag: 'Edge & Route Handlers',
        color: '#d97706',
        items: [
          {
            name: '/login · /reset-password · /update-password',
            role: 'PKCE Cookie Authentication & Recovery Flows',
            rule: 'Exempt from protected route redirects in server/proxy.ts',
          },
          {
            name: '/api/codebase-maps · /api/audit · /api/c66',
            role: 'Authenticated Route Handlers & Hardware Webhook Receivers',
            rule: 'Every handler authenticates explicitly via getAuthenticatedEmployee()',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'apps/portal/proxy.ts',
        allowed: 'CSP header injection + delegation to server/proxy.ts',
        forbidden: 'Direct database queries bypassing Redis employee claim cache',
        gate: 'pnpm audit:routing',
      },
      {
        source: 'Server Components (app/**/page.tsx)',
        allowed: 'Parallel Promise.allSettled() + named cacheLife() profiles',
        forbidden: 'cookies()/headers() inside "use cache" scopes',
        gate: 'pnpm audit:caching',
      },
      {
        source: 'Client Components ("use client")',
        allowed: 'Leaf UI interactivity, TanStack Query, Zustand stores',
        forbidden: '@repo/supabase/server, @repo/database, or SWR imports',
        gate: 'pnpm audit:data-fetching',
      },
      {
        source: 'Server Actions ("use server")',
        allowed: 'Auth → Authorize → Zod Validate → Rate-Limit → Mutate → updateTagInAction',
        forbidden: 'Calling redirect() before cache tag invalidation',
        gate: 'pnpm audit:routing',
      },
    ],
    markdownContent: `# 🗺️ Route & Feature Architecture Map

**System:** Arch-Systems Mining Operations Portal (Next.js 16 App Router)

---

## 🏛️ Route Groups & Directory Hierarchy

- \`apps/portal/app/\`
  - \`/\` -> Redirects to \`/hub\`
  - \`/hub\` — Central Operations Hub & Live Department Grid
  - \`/overview\` — System Overview Dashboard & Audit Reports
  - \`/(auth)/\`: Login (\`/login\`), Password Reset (\`/reset-password\`), Update Password (\`/update-password\`)
  - \`/(departments)/\`:
    - \`/control-room\` — Live SCADA diagnostics & telemetry monitors
    - \`/drilling\` — Drill rig operations & bit depth telemetry
    - \`/production\` — Yield, tonnage & extraction tracking
    - \`/engineering\` — Maintenance logs, breakdowns & predictive alerts
    - \`/access-control\` — On-site visitor badging, card actions, QR codes & access logs
  - \`/database\` — Supabase PostgreSQL 17 schema explorer, live query metrics & backups
  - \`/admin\` — User provisioning, RBAC governance, Redis cache & workflow administration
  - \`/api/\`: Audit endpoints (\`/api/audit\`), codebase maps (\`/api/codebase-maps\`), webhook handlers

---

## 🔒 Authentication & Middleware Flow

- **Proxy Delegate**: \`proxy.ts\` delegates token authentication and RBAC checks to \`server/proxy.ts\`.
- **Exempt Routes**: Auth endpoints (\`/login\`, \`/reset-password\`) and system check APIs (\`/api/c66\`).
- **User Validation**: Server Actions validate credentials at entry via Zod contracts from \`@repo/contract\`.`,
  },
  {
    key: 'database-schema.md',
    label: 'Database Schema & Topology',
    shortLabel: 'Database Schema',
    category: 'PostgreSQL 17 RLS',
    subtitle:
      'Supabase PostgreSQL 17 relational topology, 189 immutable SQL migrations, 100% InitPlan Row Level Security, and Zod contract parity.',
    accentColor: '#0284c7',
    kpis: [
      {
        label: 'SQL Migrations',
        value: '189 Applied',
        detail: 'Zero-padded immutable ledger in packages/database/migrations/',
      },
      {
        label: 'RLS Coverage',
        value: '100% InitPlan',
        detail: 'Cached (SELECT auth.uid()) policies across all operational tables',
      },
      {
        label: 'Contract Parity',
        value: '100% Zod Synced',
        detail: 'Every table/column verified by pnpm audit:drift against @repo/contract',
      },
      {
        label: 'Replica Routing',
        value: 'Primary + Read',
        detail: 'Transactional writes to primary; analytical dashboards to replica',
      },
    ],
    pipelineTitle: 'Zero-Trust Database Mutation, RLS InitPlan & CDC Pipeline',
    pipelineSubtitle:
      'How operational mutations flow from Zod contract validation through PostgreSQL 17 InitPlan RLS policies to Realtime CDC subscribers',
    pipelineBadge: 'PostgreSQL 17 · 100% RLS Enforcement',
    pipelineNodes: [
      {
        id: 'db-contract',
        step: 'STAGE 01',
        title: 'Zod Contract Validation',
        role: '@repo/contract/src/schemas/*',
        detail:
          'Validates shift closeouts, drill logs, and access control payloads against strict schema definitions.',
        protocol: 'safeParse() Gate',
        ssotPath: 'packages/contract/src/index.ts',
        color: '#2563eb',
      },
      {
        id: 'db-gateway',
        step: 'STAGE 02',
        title: 'Supabase SSR Client Factory',
        role: '@repo/supabase (Primary / Replica)',
        detail:
          'Routes mutations to createServerSupabaseClient() and analytical queries to createReadReplicaClient().',
        protocol: 'PgBouncer Transaction Pool',
        ssotPath: 'packages/supabase/src/',
        color: '#0284c7',
      },
      {
        id: 'db-rls',
        step: 'STAGE 03',
        title: 'PostgreSQL 17 RLS InitPlan',
        role: '(SELECT auth.uid()) Policy Gate',
        detail:
          'Enforces multi-tenant and department isolation via cached InitPlan subqueries and security-definer helpers.',
        protocol: 'Row Level Security',
        ssotPath: 'packages/database/migrations/',
        color: '#059669',
      },
      {
        id: 'db-rpc',
        step: 'STAGE 04',
        title: 'Atomic PL/pgSQL RPCs & WAL',
        role: 'Shift Closeout & Ledger RPCs',
        detail:
          'Executes transactional RPCs with optimistic concurrency locking and appends immutable audit log rows.',
        protocol: 'ACID Transaction + WAL',
        ssotPath: 'packages/database/migrations/163_shift_closeout_rpc.sql',
        color: '#7c3aed',
      },
      {
        id: 'db-cdc',
        step: 'STAGE 05',
        title: 'Realtime CDC & Cache Purge',
        role: 'useSupabaseRealtime + updateTags()',
        detail:
          'Broadcasts WAL changes to subscribed pit terminals and invalidates Next.js + Redis L1/L2 cache tags.',
        protocol: 'Supabase Realtime CDC',
        ssotPath: 'apps/portal/lib/server-cache.ts',
        color: '#d97706',
      },
    ],
    topologyTitle: 'Core PostgreSQL 17 Entity Relationship Domains',
    topologySubtitle:
      'Relational table domains governed by 189 migrations and verified by pnpm --filter @repo/database test',
    topologyGroups: [
      {
        title: 'Identity, RBAC & Access Control',
        badge: 'Tenant Core',
        scopeTag: 'employees · departments · operators',
        color: '#2563eb',
        items: [
          {
            name: 'employees & departments',
            role: 'Employee profiles, role hierarchy, and accessible_departments array',
            rule: 'Cached in Redis at arch:auth:employee:<userId> with 3600s TTL',
          },
          {
            name: 'access_logs, visitor_badges & c66_events',
            role: 'On-site gate turnstile scans, QR badges, and biometric hardware logs',
            rule: 'Strict site-scoped RLS policy enforcement',
          },
        ],
      },
      {
        title: 'Mining Operations & Production',
        badge: 'Shift Ledger',
        scopeTag: 'daily_logs · hourly_loads · shift_closeouts',
        color: '#059669',
        items: [
          {
            name: 'daily_logs & shift_closeouts',
            role: 'Department shift production summaries, supervisor sign-offs & Redlock mutexes',
            rule: 'Mutated via atomic PL/pgSQL RPCs (163_shift_closeout_rpc.sql)',
          },
          {
            name: 'hourly_loads & machine_operations',
            role: 'Excavator bucket counts, haul truck cycles, and BCM/tonnage calculations',
            rule: 'Validated against bin_factors and material_density tables',
          },
        ],
      },
      {
        title: 'Fleet, Telemetry & SCADA Assets',
        badge: 'Heavy Machinery',
        scopeTag: 'machines · sites · mine_blocks',
        color: '#d97706',
        items: [
          {
            name: 'machines, breakdowns & maintenance_logs',
            role: 'Drill rigs, excavators, dozers, MTBF/MTTR metrics, and work orders',
            rule: 'Indexed on (site_id, department_id, status) for sub-5ms dashboard queries',
          },
          {
            name: 'sites, mine_blocks & material_density',
            role: 'Geological block models, specific gravity constants, and pit coordinates',
            rule: 'Read-heavy reference tables cached with cacheLife("max")',
          },
        ],
      },
      {
        title: 'Migration & Rollback Safety Guards',
        badge: '189 SQL Files',
        scopeTag: 'packages/database/migrations/',
        color: '#7c3aed',
        items: [
          {
            name: 'migration-rollback-safety.mjs',
            role: 'Verifies idempotent IF EXISTS / IF NOT EXISTS guards and safe DDL changes',
            rule: 'Executed automatically in pnpm --filter @repo/database test',
          },
          {
            name: 'offline-mutations-security.mjs',
            role: 'Ensures offline queue replay enforces full server-side RBAC and RLS',
            rule: 'Blocks unauthenticated or cross-department replay payloads',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'packages/database/migrations/*.sql',
        allowed: 'Additive zero-padded NNN_snake_case.sql migrations with RLS enabled',
        forbidden: 'Renaming or renumbering already-applied migration prefixes',
        gate: 'pnpm --filter @repo/database test',
      },
      {
        source: 'Every PostgreSQL Table',
        allowed: 'ALTER TABLE ... ENABLE ROW LEVEL SECURITY + InitPlan policy',
        forbidden: 'Unprotected public tables or uncached auth.uid() calls per row',
        gate: 'pnpm audit:rls-matrix',
      },
      {
        source: 'Schema Columns & Views',
        allowed: 'Matching Zod schema in packages/contract/src/schemas/*.schema.ts',
        forbidden: 'Unmapped database columns or untyped JSONB payloads',
        gate: 'pnpm audit:drift',
      },
      {
        source: 'Application Queries',
        allowed: '@repo/supabase server/client/kysely factories',
        forbidden: 'Direct pg/postgres driver connections from apps/portal',
        gate: 'pnpm policy:check',
      },
    ],
    markdownContent: `# 🔒 Database Schema & Topology Map

**Engine:** PostgreSQL 17 via Supabase (189 Versioned SQL Migrations)

---

## 📊 Core Entity Relationship Overview

- **Employees & Access**: \`employees\`, \`departments\`, \`operators\`
- **Operational Data**: \`daily_logs\`, \`breakdowns\`, \`hourly_loads\`, \`machine_operations\`
- **Telemetry & Assets**: \`machines\`, \`sites\`, \`mine_blocks\`, \`material_density\`

---

## 🛡️ Security & Row Level Security (RLS) Mandates

- **Source of Truth**: \`packages/database/migrations/\` contains all 189 numbered SQL migrations.
- **100% RLS Enforcement**: Every table has active RLS policy enabled with InitPlan optimization.
- **Department Isolation**: Multi-tenant separation enforced via \`(SELECT auth.uid())\` and \`accessible_departments\` mapping.`,
  },
  {
    key: 'multi-agent-architecture.md',
    label: 'Multi-Agent Specialist Architecture',
    shortLabel: 'Multi-Agent Swarm',
    category: 'Autonomous Swarm',
    subtitle:
      '@repo/agents specialist hierarchy, 5-layer LLM Critique Council, Mandatory Pre-Flight SOTA Research Gate, and Langfuse observability.',
    accentColor: '#d97706',
    kpis: [
      {
        label: 'Specialist Roster',
        value: '7 Domain Agents',
        detail: 'DB · UI · Security · Realtime · Resilience · Simplifier · Telemetry',
      },
      {
        label: 'Critique Council',
        value: '5-Layer Gate',
        detail: 'Pre-flight SOTA benchmark evaluation before code execution',
      },
      {
        label: 'MCP Servers',
        value: '10 Registered',
        detail: 'skills-mcp · memory-gateway-mcp · slim-tooling-mcp · langgraph-mcp',
      },
      {
        label: 'Observability',
        value: 'Langfuse Traces',
        detail: 'Token budget enforcement (<=30% context window) + ZAR cost telemetry',
      },
    ],
    pipelineTitle: 'Autonomous Multi-Agent Pre-Flight & Specialist Execution Pipeline',
    pipelineSubtitle:
      'Hierarchical orchestration from User Goal through the 5-Layer Critique Council and SOTA Research Gate to 7 Domain Execution Specialists',
    pipelineBadge: '@repo/agents · Langfuse Traced',
    pipelineNodes: [
      {
        id: 'agent-mgr',
        step: 'STAGE 01',
        title: 'Engineering Manager & Goal',
        role: 'Task Decomposition',
        detail:
          'Parses user objective, checks context window budget (<30%), and routes architectural scope to the Critique Council.',
        protocol: 'Goal Intake',
        ssotPath: 'packages/agents/src/',
        color: '#2563eb',
      },
      {
        id: 'agent-council',
        step: 'STAGE 02',
        title: '5-Layer LLM Critique Council',
        role: 'SubagentCoordinator',
        detail:
          'Evaluates security, boundary compliance, RLS impact, bundle size, and operational resilience before approval.',
        protocol: '5-Layer Consensus',
        ssotPath: 'packages/agents/src/coordinator/',
        color: '#7c3aed',
      },
      {
        id: 'agent-preflight',
        step: 'STAGE 03',
        title: 'Pre-Flight SOTA Research Gate',
        role: 'researchSpecialist',
        detail:
          'Benchmarks non-trivial refactors against Netflix, Uber AST, Airbnb Data Contracts, Shopify, and Meta standards.',
        protocol: 'evaluateArchitecturalPreFlight()',
        ssotPath: 'packages/agents/src/',
        color: '#d97706',
      },
      {
        id: 'agent-hod',
        step: 'STAGE 04',
        title: 'Department Heads (HoD)',
        role: 'Platform · Runtime · QA/Infra',
        detail:
          'Dispatches work packages to isolated branch/share subagents with leased skills from skills-mcp.',
        protocol: 'MCP Lease + Dispatch',
        ssotPath: '.agents/agents/',
        color: '#059669',
      },
      {
        id: 'agent-specialists',
        step: 'STAGE 05',
        title: '7 Domain Specialists & Verify',
        role: 'Execution + pnpm agent:verify',
        detail:
          'Executes code edits, appends ISO-8601 traces to AGENT_TRACER.md, and passes the 12-step verification gate.',
        protocol: '12-Step Gate + Langfuse',
        ssotPath: 'tools/scripts/agent-verify.sh',
        color: '#0284c7',
      },
    ],
    topologyTitle: 'Specialist Persona Roster & Frontier SOTA Benchmarks',
    topologySubtitle:
      'Canonical domain responsibilities and industry fitness functions enforced by @repo/agents',
    topologyGroups: [
      {
        title: 'Data, Realtime & Resilience Specialists',
        badge: 'Backend & Edge',
        scopeTag: 'databaseArchitect · realtimeEngineer · resilienceEngineer',
        color: '#059669',
        items: [
          {
            name: 'databaseArchitect & realtimeEngineer',
            role: 'PostgreSQL 17 migrations, InitPlan RLS policies, and Supabase Realtime CDC channels',
            rule: 'Zero manual polling loops; 100% Zod contract parity',
          },
          {
            name: 'resilienceEngineer',
            role: 'Harsh opencast pit connectivity, offline mutation queues & circuit breakers',
            rule: 'SSR-safe hooks with automatic reconnection and Redlock idempotency',
          },
        ],
      },
      {
        title: 'UI, Simplification & Telemetry Specialists',
        badge: 'Frontend & Maps',
        scopeTag: 'uiEngineer · systemSimplifier · telemetryArchitect',
        color: '#2563eb',
        items: [
          {
            name: 'uiEngineer & systemSimplifier',
            role: 'React 19 RSC, Light-Mode OKLCH GlassCard surfaces, and bundle debloating',
            rule: 'Strict light-mode only; zero dark-theme classes or unapproved shadows',
          },
          {
            name: 'telemetryArchitect & securityAndQualityGate',
            role: 'Codebase maps, drift watchdogs, Playwright E2E, and Biome/TypeScript gates',
            rule: 'Enforces Drift Health Index >= 90% and zero boundary violations',
          },
        ],
      },
      {
        title: 'Standalone MCP Server Federation',
        badge: '4 Custom MCPs',
        scopeTag: '.mcp.json · 10 Servers Total',
        color: '#7c3aed',
        items: [
          {
            name: 'skills-mcp & memory-gateway-mcp',
            role: 'Skill lease lifecycle management and unified episodic/swarm memory search',
            rule: 'Standalone TypeScript MCP servers with independent test suites',
          },
          {
            name: 'slim-tooling-mcp & langgraph-mcp',
            role: 'Payload compaction proxy and Python LangGraph supervisor + Langfuse tracing',
            rule: 'Verified by pnpm mcp:verify during agent:verify',
          },
        ],
      },
      {
        title: 'Frontier SOTA Benchmark Matrix',
        badge: 'Research Gate',
        scopeTag: 'Mandatory Pre-Flight',
        color: '#d97706',
        items: [
          {
            name: 'Airbnb / PayPal & Netflix / ThoughtWorks',
            role: 'Semantic Data Contracts & Architecture-as-Code Fitness Functions',
            rule: 'Enforces zero DB-to-contract drift and automated policy compilation',
          },
          {
            name: 'Uber / Sourcegraph & Meta / Google',
            role: 'AST Codebase Maps & Perceptual Visual Regression Canaries',
            rule: 'Synchronized via pnpm maps:sync and Playwright visual snapshots',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'SubagentCoordinator (@repo/agents)',
        allowed: 'Pre-flight research gate before non-trivial architectural refactors',
        forbidden: 'Unverified multi-package mutations without SOTA benchmark sign-off',
        gate: 'pnpm audit:agents',
      },
      {
        source: '.agents/rules/* & Arch-System/.agents/rules/*',
        allowed: '23 canonical symlinked governance rules',
        forbidden: 'Rule drift between federated root and Arch-System workspace',
        gate: 'pnpm audit:rule-drift',
      },
      {
        source: 'Context Window Budget',
        allowed: 'Offloading large tool outputs & compacting context <= 30% capacity',
        forbidden: 'Unbounded raw log dumps inside agent context windows',
        gate: 'pnpm token:budget-check',
      },
      {
        source: 'Package Modifications',
        allowed: 'Appending ISO-8601 entry to modified package AGENT_TRACER.md',
        forbidden: 'Untraced architectural mutations',
        gate: 'pnpm agent:verify',
      },
    ],
    markdownContent: `# 🤖 Multi-Agent Architecture & Pre-Flight Research Gate Map

**Package:** \`@repo/agents\`  
**Orchestration:** Multi-Agent Specialist Hierarchy + Langfuse Tracing

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
\`\`\``,
  },
  {
    key: 'ci-cd-pipeline.md',
    label: 'CI/CD Pipeline & Quality Gate',
    shortLabel: 'CI/CD & Quality Gate',
    category: '12-Step Gate',
    subtitle:
      '12-step fail-fast agent-verify.sh completion gate, release-grade pnpm quality suite, and zero-downtime federated Vercel deployment pipeline.',
    accentColor: '#059669',
    kpis: [
      {
        label: 'Completion Gate',
        value: '12 Sequential Steps',
        detail: 'tools/scripts/agent-verify.sh fail-fast pre-push verification',
      },
      {
        label: 'Static Audits',
        value: '15 Compliance Checks',
        detail: 'RLS, tokens, caching, RSC, routing, hooks, images, drift, vercel',
      },
      {
        label: 'Test Runners',
        value: 'Jest 30 + Playwright',
        detail: 'Unit/integration coverage thresholds + multi-viewport E2E & axe a11y',
      },
      {
        label: 'Deploy Target',
        value: 'Vercel Production',
        detail: 'Preflight → Smoke → Alias promotion with automatic rollback guard',
      },
    ],
    pipelineTitle: '12-Step Fail-Fast Verification & Zero-Downtime Deployment Pipeline',
    pipelineSubtitle:
      'Automated quality gate executed before every production promotion across GitHub Actions, Husks pre-push hooks, and Federated Pipeline',
    pipelineBadge: 'pnpm agent:verify · 12/12 Passing',
    pipelineNodes: [
      {
        id: 'ci-compile',
        step: 'GATE 01–03',
        title: 'Type-Check, Biome Lint & Jest',
        role: 'turbo type-check · lint · test',
        detail:
          'Runs strict TypeScript 5.8 checks (--concurrency=2), Biome formatting/linting, and Jest 30 + DB rollback safety suites.',
        protocol: 'Steps 1–3 · Core Code',
        ssotPath: 'tools/scripts/agent-verify.sh',
        color: '#2563eb',
      },
      {
        id: 'ci-policy',
        step: 'GATE 04–05',
        title: 'Policy Compiler & Contract Drift',
        role: 'policy:check + audit:drift',
        detail:
          'Verifies zero illegal cross-scope imports and 100% parity between SQL migrations and @repo/contract Zod schemas.',
        protocol: 'Steps 4–5 · Boundaries',
        ssotPath: 'tools/repo/policy-compiler.cjs',
        color: '#7c3aed',
      },
      {
        id: 'ci-mcp',
        step: 'GATE 06–09',
        title: 'Skills, MCP, Token & Rule Drift',
        role: 'skill-spector · mcp:verify · budget',
        detail:
          'Validates SKILL.md frontmatter, 10 MCP server registrations, context token budgets, and .agents/rules symlink parity.',
        protocol: 'Steps 6–9 · Agentic Integrity',
        ssotPath: '.mcp.json',
        color: '#d97706',
      },
      {
        id: 'ci-maps',
        step: 'GATE 10–12',
        title: 'Codemaps, Hooks & Syncpack',
        role: 'maps:check · audit:hooks · deps:lint',
        detail:
          'Verifies codebase-maps/latest parity, SSR hook hydration safety, zero SWR imports, and workspace dependency alignment.',
        protocol: 'Steps 10–12 · Repo Hygiene',
        ssotPath: 'codebase-maps/manifest.json',
        color: '#059669',
      },
      {
        id: 'ci-deploy',
        step: 'STAGE 05',
        title: 'Federated Vercel Promotion',
        role: 'vercel-preflight + deploy.sh',
        detail:
          'Executes asset sync, Glass CSS patching, Next.js 16 production build, smoke verification, and zero-downtime alias swap.',
        protocol: 'HTTPS Production Alias',
        ssotPath: 'tools/scripts/vercel-preflight.cjs',
        color: '#0284c7',
      },
    ],
    topologyTitle: 'Quality Gate & Compliance Suite Breakdown',
    topologySubtitle:
      'Complete inventory of automated verification checks in pnpm agent:verify and pnpm quality',
    topologyGroups: [
      {
        title: 'Compiler, Linter & Unit Test Gates',
        badge: 'Steps 1–3',
        scopeTag: 'TypeScript 5.8 · Biome · Jest 30',
        color: '#2563eb',
        items: [
          {
            name: 'pnpm type-check & pnpm lint',
            role: 'Strict NodeNext TypeScript compilation and Biome AST lint/format check',
            rule: 'Zero any, zero @ts-ignore, 2-space indent, single quotes',
          },
          {
            name: 'pnpm test & @repo/database test',
            role: 'Jest 30 unit tests + SQL migration rollback & offline mutation security scripts',
            rule: 'Enforces portal coverage thresholds (lines 40%, branches 27%, functions 28%)',
          },
        ],
      },
      {
        title: 'Architecture & Security Compliance',
        badge: 'Steps 4–5 + Audits',
        scopeTag: 'policy:check · audit:compliance',
        color: '#059669',
        items: [
          {
            name: 'pnpm policy:check & pnpm audit:drift',
            role: 'Module boundary compiler check and Zod-to-SQL schema drift auditor',
            rule: 'Fails fast on any unmapped table column or illegal package import',
          },
          {
            name: 'audit:rls-matrix, audit:tokens & audit:caching',
            role: 'Verifies 100% RLS InitPlan coverage, light-mode OKLCH tokens, and cacheLife()',
            rule: 'Zero dark-theme classes, zero raw box-shadows, zero unguarded cache scopes',
          },
        ],
      },
      {
        title: 'Agentic & Federation Verification',
        badge: 'Steps 6–10',
        scopeTag: 'MCP · Skills · Maps · Rules',
        color: '#7c3aed',
        items: [
          {
            name: 'skill-spector, mcp:verify & token:budget-check',
            role: 'Validates all 7 workspace skills, 10 MCP servers, and context budget ceilings',
            rule: 'Remediate token bloat via pnpm context:debloat',
          },
          {
            name: 'audit:rule-drift & Codebase-Map Parity',
            role: 'Ensures .agents/rules/ symlinks and codemap.md files match source AST',
            rule: 'Remediate map parity via pnpm maps:sync',
          },
        ],
      },
      {
        title: 'Dependency Hygiene & Release Pipeline',
        badge: 'Steps 11–12 + Deploy',
        scopeTag: 'Syncpack · Knip · Vercel',
        color: '#d97706',
        items: [
          {
            name: 'pnpm audit:hooks, pnpm deps:lint & pnpm knip',
            role: 'SSR hook safety, Syncpack version alignment, and dead-code detection',
            rule: 'Zero duplicate package versions across pnpm-workspace.yaml catalogs',
          },
          {
            name: 'Federated Pipeline & Vercel Preflight',
            role: 'Orchestrated preflight → build → smoke test → Vercel production deployment',
            rule: 'Automatic rollback trigger on health check failure',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'Pre-Push Git Hook (.husky/pre-push)',
        allowed: 'Pushing commits that pass all 12 steps of pnpm agent:verify',
        forbidden: 'Bypassing verification gates or pushing broken builds to main',
        gate: 'pnpm agent:verify',
      },
      {
        source: 'Stylelint & Token Gate',
        allowed: 'Semantic OKLCH variables and approved shadow tokens',
        forbidden: 'Animating layout properties (width/height/margin) or raw hex colors',
        gate: 'pnpm audit:tokens',
      },
      {
        source: 'Dependabot & Security Gate',
        allowed: 'Patched catalog dependencies in pnpm-workspace.yaml',
        forbidden: 'Open high/critical CVE alerts in production lockfiles',
        gate: 'pnpm deps:lint',
      },
      {
        source: 'Codebase Map Synchronizer',
        allowed: 'Up-to-date codemap.md and codebase-maps/latest/*.md snapshots',
        forbidden: 'Stale module exports or missing route documentation',
        gate: 'pnpm maps:sync',
      },
    ],
    markdownContent: `# 🚀 CI/CD Pipeline & Quality Gate Topology Map

**Orchestration:** GitHub Actions + \`pnpm agent:verify\` (12-Step Gate) + Federated Deploy Pipeline

---

## 🧪 12-Step Agent Verification Gate (\`pnpm agent:verify\`)

1. \`pnpm type-check\` (Strict TypeScript compilation across workspace)
2. \`pnpm lint\` (Biome AST code linting & formatting check)
3. \`pnpm test\` (Jest 30 unit/integration + \`@repo/database\` rollback safety)
4. \`pnpm policy:check\` (Project tag & boundary policy compiler)
5. \`pnpm audit:drift\` (\`@repo/contract\` Zod schemas vs DB/API surface)
6. \`skill-spector\` (Workspace skill schema & frontmatter validator)
7. \`pnpm mcp:verify\` (10-server stdio MCP configuration & build check)
8. \`pnpm token:budget-check\` (Context window budget enforcement)
9. \`pnpm audit:rule-drift\` (Federated \`.agents/rules\` parity check)
10. \`Codebase-map parity\` (\`pnpm maps:sync\` AST verification)
11. \`pnpm audit:hooks\` (SSR hydration safety & prohibited library check)
12. \`pnpm deps:lint\` (Syncpack workspace dependency version alignment)

---

## 🚢 Deployment Workflow (\`scripts/deploy.sh\` & Vercel Production)

- Runs \`sync-assets-smart.cjs\` → \`patch-glass-css.mjs\` → \`turbo run build\`.
- Includes automatic cache purge and rollback triggers on verification failure.`,
  },
  {
    key: 'technology-stack.md',
    label: 'Technology Stack Catalog',
    shortLabel: 'Technology Stack',
    category: 'Runtime Stack',
    subtitle:
      'Complete production stack specification across Next.js 16.3.8, React 19.2, TypeScript 5.8, OKLCH Theme, Supabase PostgreSQL 17, and Hybrid Redis 7.4.',
    accentColor: '#2563eb',
    kpis: [
      {
        label: 'Frontend Core',
        value: 'Next 16 + React 19',
        detail: 'App Router RSC, cacheComponents: true, React 19 use() + Actions',
      },
      {
        label: 'Design System',
        value: 'OKLCH Liquid Glass',
        detail: '@repo/theme tokens.json + @repo/ui GlassCard light-mode surfaces',
      },
      {
        label: 'Data & Cache',
        value: 'PG 17 + Redis 7.4',
        detail: 'Supabase SSR + Kysely + L1 LRU / L2 Upstash Redis + Redlock',
      },
      {
        label: 'Industrial Mesh',
        value: '20 Connectors',
        detail: 'FUXA SCADA, C66 Gate, Inngest, n8n, Flowise, OTel, Langfuse',
      },
    ],
    pipelineTitle: 'End-to-End Runtime Technology Stack Execution Flow',
    pipelineSubtitle:
      'How each technology tier collaborates from pit operator browser rendering through edge caching to industrial SCADA hardware',
    pipelineBadge: '14 Core Technologies · Node >= 24',
    pipelineNodes: [
      {
        id: 'stack-ui',
        step: 'LAYER 01',
        title: 'Next.js 16.3.8 & React 19.2',
        role: 'App Router + RSC + TanStack Query',
        detail:
          'Renders server-first operational dashboards with Zustand 5 ephemeral state, XState 5 workflows, and React Hook Form.',
        protocol: 'HTTP/3 + RSC Payload',
        ssotPath: 'apps/portal/next.config.mjs',
        color: '#2563eb',
      },
      {
        id: 'stack-theme',
        step: 'LAYER 02',
        title: 'OKLCH Theme & Glass UI',
        role: '@repo/theme + @repo/ui + Tailwind',
        detail:
          'Delivers perceptually uniform light-mode OKLCH tokens, GlassCard variants, and hardware-accelerated CSS animations.',
        protocol: 'CSS Custom Properties',
        ssotPath: 'packages/theme/tokens.json',
        color: '#7c3aed',
      },
      {
        id: 'stack-contract',
        step: 'LAYER 03',
        title: 'TypeScript 5.8 & Zod Contracts',
        role: '@repo/contract + @repo/errors',
        detail:
          'Enforces strict NodeNext typing, noUncheckedIndexedAccess, runtime Zod validation, and typed AppError hierarchies.',
        protocol: 'Zod safeParse() + AppError',
        ssotPath: 'packages/typescript-config/base.json',
        color: '#059669',
      },
      {
        id: 'stack-data',
        step: 'LAYER 04',
        title: 'Supabase PG 17 & Hybrid Redis',
        role: '@repo/supabase + @repo/redis',
        detail:
          'Pairs 189 PostgreSQL 17 migrations and Kysely type-safe builders with L1 LRU + L2 Upstash Redis and Redlock mutexes.',
        protocol: 'PostgreSQL 17 + Redis REST',
        ssotPath: 'packages/redis/src/',
        color: '#d97706',
      },
      {
        id: 'stack-mesh',
        step: 'LAYER 05',
        title: 'SCADA, AI & QA Telemetry',
        role: 'FUXA · Inngest · Langfuse · Playwright',
        detail:
          'Integrates Modbus/OPC-UA pit telemetry, durable background jobs, LLM trace observability, and Jest 30 / Playwright E2E.',
        protocol: 'OPC-UA · OTel · WebSocket',
        ssotPath: 'e2e/playwright.config.ts',
        color: '#0284c7',
      },
    ],
    topologyTitle: 'Technology Stack Catalog by Engineering Domain',
    topologySubtitle:
      'Standardized versions, runtime engines, and architectural roles across the monorepo',
    topologyGroups: [
      {
        title: 'Frontend, State & Design System',
        badge: 'Presentation',
        scopeTag: 'Next.js 16 · React 19 · OKLCH',
        color: '#2563eb',
        items: [
          {
            name: 'Next.js 16.3.8, React 19.2 & TypeScript 5.8',
            role: 'Server Components, Server Actions, proxy.ts CSP, and strict static typing',
            rule: 'Pinned in pnpm-workspace.yaml catalogs.react19',
          },
          {
            name: 'TanStack Query v5, Zustand 5 & XState 5',
            role: 'Client cache persistence, navigation/offline stores, and orchestrator machines',
            rule: 'SWR is strictly prohibited by pnpm audit:hooks',
          },
        ],
      },
      {
        title: 'Database, Caching & Rate Limiting',
        badge: 'Persistence',
        scopeTag: 'PostgreSQL 17 · Redis 7.4 · Zod',
        color: '#059669',
        items: [
          {
            name: 'Supabase PostgreSQL 17 + Kysely + @repo/contract',
            role: '189 SQL migrations, 100% RLS InitPlan policies, and canonical Zod schemas',
            rule: 'Primary + Read-Replica client factories in @repo/supabase',
          },
          {
            name: '@repo/redis & @repo/rate-limiter',
            role: 'Two-tier L1 LRU + L2 Upstash Redis cache and Fixed/Sliding/TokenBucket limiters',
            rule: 'Synchronized with Next.js cache tags via updateTags()',
          },
        ],
      },
      {
        title: 'Monorepo Tooling & Quality Automation',
        badge: 'Build & QA',
        scopeTag: 'Turborepo 2.x · pnpm 9.15.9 · Biome',
        color: '#7c3aed',
        items: [
          {
            name: 'Turborepo 2.x, pnpm 9.15.9 & Node.js >= 24',
            role: 'Workspace task orchestration, content-addressable caching, and catalog management',
            rule: 'Root pnpm install blocked via preinstall guard',
          },
          {
            name: 'Biome, Stylelint, Jest 30 & Playwright',
            role: 'AST linting, OKLCH CSS verification, unit testing, and multi-device E2E + axe a11y',
            rule: 'Enforced by 12-step pnpm agent:verify gate',
          },
        ],
      },
      {
        title: 'Industrial IoT & Agentic Observability',
        badge: 'Telemetry & AI',
        scopeTag: 'SCADA · Langfuse · DeepEval',
        color: '#d97706',
        items: [
          {
            name: 'FUXA SCADA, C66 Gate & 20 Connectors',
            role: 'Real-time drill rig, crusher, weighbridge, and biometric turnstile integration',
            rule: 'Light-mode themed embeds and HMAC-verified webhook endpoints',
          },
          {
            name: '@repo/agents, LangGraph MCP, Langfuse & @repo/eval',
            role: 'Multi-agent specialist swarm, trace scoring, and Python DeepEval/pytest suites',
            rule: 'Zero-drift telemetry across AI and pit operations',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'Node.js & Package Manager',
        allowed: 'Node >= 24 (Volta 24.x / mise) + pnpm@9.15.9 only',
        forbidden: 'npm, yarn, bun, or running pnpm install at federated root',
        gate: 'package.json engines & preinstall',
      },
      {
        source: 'Client Data Caching',
        allowed: '@tanstack/react-query with localStorage persistence + Supabase Realtime CDC',
        forbidden: 'swr, swr/mutation, or manual setInterval polling loops',
        gate: 'pnpm audit:hooks',
      },
      {
        source: 'Unit & E2E Testing',
        allowed: 'Jest 30 (@swc/jest) co-located *.test.ts(x) + Playwright e2e/*.spec.ts',
        forbidden: 'ava, mocha, tape, or unmocked network calls in unit tests',
        gate: 'pnpm test',
      },
      {
        source: 'Styling & Design Tokens',
        allowed: 'Tailwind CSS + @repo/theme OKLCH tokens + @repo/ui GlassCard',
        forbidden: 'dark-theme variants, raw CSS box-shadow, or layout-property keyframes',
        gate: 'pnpm audit:tokens',
      },
    ],
    markdownContent: `# ⚡ Technology Stack & Catalog Map

**Architecture:** Turborepo Monorepo + Next.js 16.3.8 + React 19.2 + Supabase PostgreSQL 17

---

## 🛠️ Stack Catalog

- **Monorepo Manager**: Turborepo 2.x + pnpm 9.15.9 workspace (Node.js >= 24)
- **Frontend Core**: Next.js 16.3.8 (App Router), React 19.2, TypeScript 5.8, Tailwind CSS
- **Design System**: OKLCH Palette (\`@repo/theme\`), Liquid Glass surfaces (\`@repo/ui/GlassCard\`), Named shadows only
- **Database Layer**: Supabase PostgreSQL 17 (189 migrations, 100% RLS InitPlan) + Kysely + \`@repo/contract\` Zod
- **Caching & Metrics**: Hybrid L1 LRU + L2 Upstash Redis 7.4 + \`@repo/rate-limiter\` + Redlock mutexes
- **Quality & E2E**: Biome, Stylelint, Syncpack, Knip, Jest 30, Playwright E2E, Storybook axe a11y, DeepEval`,
  },
  {
    key: 'project-dependencies.md',
    label: 'Project Dependencies Graph',
    shortLabel: 'Project Dependencies',
    category: 'Workspace Graph',
    subtitle:
      'Direct package-to-package dependency contracts, pnpm workspace catalog pins, and service factory injection rules.',
    accentColor: '#7c3aed',
    kpis: [
      {
        label: 'Core @repo/* Pkgs',
        value: '14 Packages',
        detail: 'ui · theme · contract · supabase · database · redis · errors · logger...',
      },
      {
        label: 'Feature Modules',
        value: '9 Sub-Packages',
        detail: '{auth,departments,hub}/{ui,data-access,utils} + shared/*',
      },
      {
        label: 'Version Alignment',
        value: '100% Syncpack',
        detail: 'Zero mismatched dependency versions across all package.json files',
      },
      {
        label: 'Dead Code Gate',
        value: 'Knip Verified',
        detail: 'Zero unused exports or orphaned dependencies across workspace',
      },
    ],
    pipelineTitle: 'Package Dependency Injection & Factory Resolution Pipeline',
    pipelineSubtitle:
      'How workspace packages expose hermetic factory functions and canonical barrel exports up the dependency chain',
    pipelineBadge: 'pnpm deps:lint · 100% Aligned',
    pipelineNodes: [
      {
        id: 'pdep-catalog',
        step: 'STEP 01',
        title: 'pnpm Workspace Catalogs',
        role: 'pnpm-workspace.yaml',
        detail:
          'Centralizes third-party versions (React 19.2, Next 16.3.8, Zod, Kysely, Lucide) via catalog: and catalogs.react19.',
        protocol: 'catalog:* Protocol',
        ssotPath: 'pnpm-workspace.yaml',
        color: '#2563eb',
      },
      {
        id: 'pdep-primitives',
        step: 'STEP 02',
        title: 'Foundational Primitives',
        role: '@repo/{theme,errors,utils,logger}',
        detail:
          'Provides leaf-level OKLCH tokens, AppError classes, retry/circuit-breaker utilities, and structured Pino/Winston loggers.',
        protocol: 'Zero Internal Deps',
        ssotPath: 'packages/errors/src/index.ts',
        color: '#7c3aed',
      },
      {
        id: 'pdep-services',
        step: 'STEP 03',
        title: 'Hermetic Service Factories',
        role: '@repo/{database,contract,redis,rate-limiter}',
        detail:
          'Exposes getRedisClient(), cacheGetOrSet(), RateLimiter(IStore, IStrategy), and canonical Zod schemas.',
        protocol: 'Dependency Injection',
        ssotPath: 'packages/rate-limiter/src/',
        color: '#059669',
      },
      {
        id: 'pdep-gateway',
        step: 'STEP 04',
        title: 'Data & UI Component Libraries',
        role: '@repo/supabase + @repo/ui',
        detail:
          'Supplies createServerSupabaseClient(), createBrowserSupabaseClient(), createKyselyClient(), and GlassCard UI.',
        protocol: 'Canonical Barrel Exports',
        ssotPath: 'packages/ui/src/components/GlassCard.tsx',
        color: '#d97706',
      },
      {
        id: 'pdep-app',
        step: 'STEP 05',
        title: 'Feature Libs & Portal App',
        role: 'libs/features/* → apps/portal',
        detail:
          'Assembles domain features and mounts them into the Next.js 16 portal with zero deep @repo/*/src/... imports.',
        protocol: 'workspace:* Resolution',
        ssotPath: 'apps/portal/package.json',
        color: '#0284c7',
      },
    ],
    topologyTitle: 'Workspace Package Inventory & Dependency Contracts',
    topologySubtitle:
      'Every @repo/* package, its factory exports, and its upstream/downstream dependency rules',
    topologyGroups: [
      {
        title: 'UI, Theme & Error Foundations',
        badge: 'Presentation & Core',
        scopeTag: '@repo/ui · @repo/theme · @repo/errors',
        color: '#2563eb',
        items: [
          {
            name: '@repo/ui & @repo/theme',
            role: 'GlassCard (default/window/spotlight/glowborder/liquid), Book, MacTitleBar & OKLCH tokens',
            rule: 'Import via canonical exports (@repo/ui/GlassCard), never @repo/ui/src/...',
          },
          {
            name: '@repo/errors & @repo/logger',
            role: 'AppError hierarchy (ValidationError 400, AuthError 401, ForbiddenError 403...) & structured logs',
            rule: 'Use isAppError(err) at API and Server Action boundaries',
          },
        ],
      },
      {
        title: 'Database, Contract & Supabase Factories',
        badge: 'Data Layer',
        scopeTag: '@repo/database · @repo/contract · @repo/supabase',
        color: '#059669',
        items: [
          {
            name: '@repo/database & @repo/contract',
            role: '189 SQL migrations, generated DB types, and 100% mirrored Zod validation schemas',
            rule: 'Every new SQL column requires a matching schema in @repo/contract',
          },
          {
            name: '@repo/supabase',
            role: 'createServerSupabaseClient(), createBrowserSupabaseClient(), createKyselyClient()',
            rule: 'Prevents env leaks and keeps unit tests hermetic',
          },
        ],
      },
      {
        title: 'Caching, Rate-Limiting & Shared Hooks',
        badge: 'Resilience Layer',
        scopeTag: '@repo/redis · @repo/rate-limiter · @repo/shared/*',
        color: '#d97706',
        items: [
          {
            name: '@repo/redis & @repo/rate-limiter',
            role: 'L1/L2 cacheGetOrSet() + RateLimiter with RedisStore/MemoryStore & TokenBucket/SlidingWindow',
            rule: 'Protects Server Actions and high-frequency pit telemetry endpoints',
          },
          {
            name: '@repo/shared/{data-access,hooks,utils}',
            role: 'useSupabaseRealtime, usePitConnectivity, client telemetry & circuit breakers',
            rule: 'All hooks guard window/document access for SSR hydration safety',
          },
        ],
      },
      {
        title: 'Agentic & Evaluation Packages',
        badge: 'AI & Eval',
        scopeTag: '@repo/agents · @repo/eval · @repo/typescript-config',
        color: '#7c3aed',
        items: [
          {
            name: '@repo/agents & @repo/eval',
            role: 'SubagentCoordinator, 7 domain specialists, and Python pytest/DeepEval suites',
            rule: 'Traced via Langfuse and audited by pnpm audit:agents',
          },
          {
            name: '@repo/typescript-config',
            role: 'Shared base.json, nextjs.json, and react-library.json strict TS configs',
            rule: 'Enforces strict: true and noUncheckedIndexedAccess across all packages',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'Package Imports across Monorepo',
        allowed: 'Canonical package exports (e.g., @repo/ui/GlassCard, @repo/supabase/server)',
        forbidden: 'Deep relative or internal src/ imports (@repo/ui/src/...)',
        gate: 'pnpm policy:check',
      },
      {
        source: 'package.json Dependency Versions',
        allowed: 'workspace:* for internal packages and catalog: for shared externals',
        forbidden: 'Divergent semver ranges across workspace packages',
        gate: 'pnpm deps:lint',
      },
      {
        source: 'Runtime Service Instantiation',
        allowed: 'Factory helpers (createServerSupabaseClient, getRedisClient, RateLimiter)',
        forbidden: 'Top-level singleton side effects that leak env vars at import time',
        gate: 'pnpm test',
      },
      {
        source: 'Unused Exports & Dependencies',
        allowed: 'Actively consumed exports documented in codemap.md',
        forbidden: 'Dead files, unused dependencies, or orphaned barrel exports',
        gate: 'pnpm knip',
      },
    ],
    markdownContent: `# 🕸️ Project Dependencies & Monorepo Graph Map

**Workspace:** Turborepo Monorepo Workspace (\`pnpm-workspace.yaml\`)

---

## 📦 Package Graph Rules

- **Apps**: \`apps/portal\` (Unified Portal, Hub & Overview — package name \`portal\`)
- **Packages**:
  - \`@repo/ui\` — Shared OKLCH UI component library (\`GlassCard\`, \`Book\`, \`MacTitleBar\`)
  - \`@repo/theme\` — Design tokens (\`tokens.json\`) and Tailwind configuration
  - \`@repo/supabase\` — Supabase client, server, middleware & Kysely factory helpers
  - \`@repo/database\` — 189 Database migrations & source-of-truth schemas
  - \`@repo/contract\` — Zod API input & mutation contracts
  - \`@repo/redis\` & \`@repo/rate-limiter\` — Hybrid L1/L2 Redis caching & rate limiters
  - \`@repo/errors\`, \`@repo/logger\`, \`@repo/utils\`, \`@repo/agents\`, \`@repo/eval\`
- **Constraint**: \`scope:app\` -> \`scope:package\` & \`scope:feature\` only; \`scope:package:ui\` cannot depend on database packages.`,
  },
  {
    key: 'package-structure.md',
    label: 'Package Structure & Modules',
    shortLabel: 'Package Structure',
    category: 'Module Hierarchy',
    subtitle:
      'Federated workspace root (/home/tim/Fork) and Arch-System monorepo directory structure, standalone MCP servers, and XDG-compliant module layout.',
    accentColor: '#0284c7',
    kpis: [
      {
        label: 'Federated Root',
        value: 'Zero-Dep Runner',
        detail: 'Delegates to Arch-System + 4 standalone MCP servers',
      },
      {
        label: 'Monorepo Roots',
        value: '5 Core Trees',
        detail: 'apps/ · packages/ · libs/ · tools/ · scripts/ + e2e/',
      },
      {
        label: 'Standalone MCPs',
        value: '4 Independent',
        detail: 'skills-mcp · memory-gateway-mcp · slim-tooling-mcp · langgraph-mcp',
      },
      {
        label: 'Codemap Parity',
        value: '100% Indexed',
        detail: 'Automated directory codemap.md + codebase-maps/latest/*.md',
      },
    ],
    pipelineTitle: 'Federated Workspace & Monorepo Directory Resolution Flow',
    pipelineSubtitle:
      'Structural organization from the zero-dependency federated root into the Arch-System Turborepo workspace and standalone MCP servers',
    pipelineBadge: 'Federated Root + Arch-System Monorepo',
    pipelineNodes: [
      {
        id: 'struct-root',
        step: 'ROOT 01',
        title: 'Federated Workspace Root',
        role: '/home/tim/Fork (Makefile + .mcp.json)',
        detail:
          'Zero-dependency delegation runner hosting root automation (tools/federated-pipeline, federation-watchdog) and 4 standalone MCPs.',
        protocol: 'Delegation Runner',
        ssotPath: 'package.json',
        color: '#2563eb',
      },
      {
        id: 'struct-apps',
        step: 'TREE 02',
        title: 'Portal Application Tree',
        role: 'Arch-System/apps/portal',
        detail:
          'Houses Next.js 16 app/ routes, server/proxy.ts, lib/server-cache.ts, actions/, components/, and setupTests.ts.',
        protocol: 'Next.js 16 App Router',
        ssotPath: 'apps/portal/',
        color: '#059669',
      },
      {
        id: 'struct-libs',
        step: 'TREE 03',
        title: 'Domain & Shared Libraries',
        role: 'Arch-System/libs/{features,shared}',
        detail:
          'Splits domain logic into features/{auth,departments,hub}/{ui,data-access,utils} and shared/{data-access,hooks,utils}.',
        protocol: 'Domain Modularization',
        ssotPath: 'libs/',
        color: '#7c3aed',
      },
      {
        id: 'struct-pkgs',
        step: 'TREE 04',
        title: 'Shared @repo/* Packages',
        role: 'Arch-System/packages/*',
        detail:
          'Contains 14 strictly typed packages including database/migrations (symlinked to supabase/migrations) and contract/src/schemas.',
        protocol: 'Isolated Workspace Packages',
        ssotPath: 'packages/',
        color: '#d97706',
      },
      {
        id: 'struct-tools',
        step: 'TREE 05',
        title: 'Build Tools, Audits & Maps',
        role: 'Arch-System/{tools,codebase-maps,e2e}',
        detail:
          'Houses policy-compiler.cjs, 15 compliance auditors, zero-drift-watchdog, Playwright E2E specs, and codebase-maps/latest.',
        protocol: 'Build-Time Automation',
        ssotPath: 'tools/',
        color: '#0284c7',
      },
    ],
    topologyTitle: 'Directory Ownership & Structural Conventions',
    topologySubtitle:
      'File naming standards, symlink topology, and standalone server boundaries across the repository',
    topologyGroups: [
      {
        title: 'Application & Feature Directories',
        badge: 'apps/ + libs/',
        scopeTag: 'Runtime Code',
        color: '#2563eb',
        items: [
          {
            name: 'Arch-System/apps/portal/',
            role: 'app/ (routes), server/ (proxy.ts), lib/ (server-cache.ts), hooks/, actions/, features/',
            rule: 'Components use PascalCase (CommandBar.tsx); hooks use useXxx.ts',
          },
          {
            name: 'Arch-System/libs/features/* & libs/shared/*',
            role: 'features/{auth,departments,hub}/{ui,data-access,utils} + shared/{data-access,hooks,utils}',
            rule: 'Co-located *.test.ts(x) unit tests alongside source modules',
          },
        ],
      },
      {
        title: 'Core Packages & Migration Symlinks',
        badge: 'packages/',
        scopeTag: '14 @repo/* Libraries',
        color: '#059669',
        items: [
          {
            name: 'packages/database/migrations/ ↔ packages/supabase/migrations',
            role: '189 canonical SQL migrations (NNN_description.sql) + root supabase/ CLI symlink',
            rule: 'Single source of truth in packages/database/migrations/',
          },
          {
            name: 'packages/contract/src/schemas/*.schema.ts',
            role: 'Kebab-case Zod schema files (access-control.schema.ts, drill.schema.ts)',
            rule: 'Exported via packages/contract/src/index.ts barrel',
          },
        ],
      },
      {
        title: 'Standalone MCP Servers (Root Level)',
        badge: '4 Servers',
        scopeTag: 'Independent Lockfiles',
        color: '#7c3aed',
        items: [
          {
            name: 'skills-mcp/, memory-gateway-mcp/, slim-tooling-mcp/',
            role: 'Standalone TypeScript MCP servers built & tested in their own directories',
            rule: 'Run pnpm run build && pnpm test inside each server directory',
          },
          {
            name: 'langgraph-mcp/',
            role: 'Python (hatchling) MCP server exposing supervisor_* and langfuse_* tools',
            rule: 'Registered in root .mcp.json alongside 9 other stdio servers',
          },
        ],
      },
      {
        title: 'Automation, Audits & Governance',
        badge: 'tools/ + .agents/',
        scopeTag: 'Build & Verification',
        color: '#d97706',
        items: [
          {
            name: 'Arch-System/tools/{repo,audits,scripts,zero-drift-watchdog}',
            role: 'policy-compiler.cjs, codebase map generator, 15 static auditors, agent-verify.sh',
            rule: 'Build-time only; never imported by runtime application code',
          },
          {
            name: 'Arch-System/.agents/ ↔ Root .agents/',
            role: '23 canonical rules, 7 skills, specialist agent personas, and 6 hooks',
            rule: 'CLAUDE.md and root .agents/rules/ symlink to canonical Arch-System sources',
          },
        ],
      },
    ],
    boundaryRules: [
      {
        source: 'File Naming Conventions',
        allowed: 'PascalCase.tsx components, useXxx.ts hooks, *.schema.ts schemas, NNN_snake.sql',
        forbidden: 'Ad-hoc casing or unprefixed SQL migration files',
        gate: 'pnpm audit:compliance',
      },
      {
        source: 'Symlink Topology',
        allowed: 'CLAUDE.md -> AGENTS.md, .agents/rules -> Arch-System/.agents/rules',
        forbidden: 'Divergent copies of rules or migration directories',
        gate: 'pnpm audit:rule-drift',
      },
      {
        source: 'Directory Codemaps',
        allowed: 'Synchronized codemap.md in every module directory + codebase-maps/latest/',
        forbidden: 'Adding/removing exports without running pnpm maps:sync',
        gate: 'pnpm agent:verify (Step 10)',
      },
      {
        source: 'Standalone MCP Directories',
        allowed: 'Independent package.json & lockfile per MCP server at root',
        forbidden: 'Mixing standalone MCP build artifacts into apps/portal bundle',
        gate: 'pnpm mcp:verify',
      },
    ],
    markdownContent: `# 📁 Package Structure & Module Map

**Standard:** XDG Compliance + Clean Workspace Modularization

---

## 📂 Root & Monorepo Structure Overview

- \`/home/tim/Fork\` (Federated Root): Zero-dependency delegation runner, \`Makefile\`, \`.mcp.json\`, standalone MCP servers (\`skills-mcp\`, \`memory-gateway-mcp\`, \`slim-tooling-mcp\`, \`langgraph-mcp\`), and \`tools/{federated-pipeline,federation-watchdog,mcp-harness}\`.
- \`Arch-System/apps/\`: Unified portal application (\`apps/portal\`)
- \`Arch-System/packages/\`: Shared infrastructure packages (\`ui\`, \`theme\`, \`supabase\`, \`database\`, \`contract\`, \`redis\`, \`rate-limiter\`, \`errors\`, \`logger\`, \`utils\`, \`agents\`, \`eval\`, \`typescript-config\`)
- \`Arch-System/libs/\`: Domain feature libraries (\`features/hub\`, \`features/departments\`, \`features/auth\`) + \`shared/{data-access,hooks,utils}\`
- \`Arch-System/tools/\`: Build, policy compiler, audit, and quality automation tools
- \`Arch-System/codebase-maps/\`: Automated visual codebase topology maps (\`codebase-maps/latest/*.md\`)`,
  },
];

export const CODEBASE_MAP_BY_KEY: Record<string, CodebaseMapSpec> = Object.fromEntries(
  CODEBASE_MAP_SPECS.map((spec) => [spec.key, spec])
);
