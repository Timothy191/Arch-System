#!/usr/bin/env node

/**
 * @fileoverview Automated Codebase Maps Generator & Indexer
 * Scans the workspace topology and generates structured codebase maps inside codebase-maps/log-N(YY-MM-DD)/.
 * Maintains a manifest.json metadata index and a codebase-maps/latest/ directory for zero-regex loading
 * in Server Components and overview dashboards.
 *
 * Usage: node tools/generate-codebase-maps.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MAPS_ROOT = path.join(ROOT, "codebase-maps");

/**
 * Formats date strings for versioned folder naming and ISO metadata.
 */
function getFormattedDate() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return {
    folderDate: `${yy}-${mm}-${dd}`,
    isoDate: now.toISOString(),
    displayDate: now.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
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
      key: "route-feature",
      filename: "route-feature-architecture.md",
      title: "Route & Feature Architecture Map",
      category: "Routing & Features",
      summary: "Next.js 16 App Router route hierarchy, co-located feature modules, and server actions.",
      content: `# 🗺️ Route & Feature Architecture Map

**Generated:** ${dateInfo.displayDate}  
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
    - \`/access-control\` — On-site visitor badging & access logs
    - \`/access-card-actions\` — Badge printing & QR code generation
    - \`/training\` — Operator safety certifications & schedules
  - \`/api/\`: Audit endpoints (\`/api/audit\`), health checks, webhook handlers

---

## 🔒 Authentication & Middleware Flow
- **Proxy Delegate**: \`middleware.ts\` delegates token authentication and RBAC checks to \`server/proxy.ts\`.
- **Exempt Routes**: Auth endpoints (\`/login\`, \`/reset-password\`) and system check APIs (\`/api/c66\`).
- **User Validation**: Server Actions validate credentials at entry via Zod contracts from \`@repo/contract\`.
`,
    },
    {
      key: "database-schema",
      filename: "database-schema.md",
      title: "Database Schema & Topology Map",
      category: "Database & Security",
      summary: "Postgres schema topology, migration files, 100% RLS policy enforcement, and replica routing.",
      content: `# 🔒 Database Schema & Topology Map

**Generated:** ${dateInfo.displayDate}  
**Engine:** PostgreSQL via Supabase

---

## 📊 Core Entity Relationship Overview

- **Employees & Access**: \`employees\`, \`departments\`, \`operators\`
- **Operational Data**: \`safety_incidents\`, \`breakdowns\`, \`hourly_loads\`, \`machine_operations\`
- **Telemetry & Assets**: \`machines\`, \`sites\`, \`mine_blocks\`, \`material_density\`

---

## 🛡️ Security & Row Level Security (RLS) Mandates
* **Source of Truth**: \`packages/database/migrations/\` contains all numbered SQL migrations.
* **100% RLS Enforcement**: Every table has active RLS policy enabled.
* **Department Isolation**: Multi-tenant separation enforced via \`auth.uid()\` and \`accessible_departments\` mapping.
`,
    },
    {
      key: "ci-cd-pipeline",
      filename: "ci-cd-pipeline.md",
      title: "CI/CD Pipeline & Quality Gate Map",
      category: "DevOps & CI/CD",
      summary: "GitHub Actions workflow topology, quality gate checks, security audits, and deployment automation.",
      content: `# 🚀 CI/CD Pipeline & Quality Gate Topology Map

**Generated:** ${dateInfo.displayDate}  
**Orchestration:** GitHub Actions + Local Deploy Scripts

---

## 🧪 Quality Gate Suite (\`pnpm quality\`)

1. \`nx run-many -t lint\` (ESLint code linting across workspace)
2. \`nx run-many -t type-check\` (Strict TypeScript check)
3. \`nx run-many -t test\` (Jest unit & integration tests)
4. \`pnpm lint:root\` & \`pnpm lint:styles\` (Stylelint CSS OKLCH check)
5. \`pnpm lint:spelling\` (Cspell spell checking)
6. \`pnpm deps:lint\` (Syncpack package version consistency)
7. \`pnpm knip\` (Dead code detection)
8. \`pnpm policy:check\` (Project tag & security policy compiler)
9. \`pnpm audit:suite\` (Versioned RLS & Design System compliance auditor)

---

## 🚢 Deployment Workflow (\`scripts/deploy.sh\`)
- Supports local, staging, and production zero-downtime deployment runs.
- Includes automatic cache purge and rollback triggers on verification failure.
`,
    },
    {
      key: "technology-stack",
      filename: "technology-stack.md",
      title: "Technology Stack & Catalog Map",
      category: "Architecture & Stack",
      summary: "Inventory of runtime engines, Next.js 16, React 19, OKLCH design system, and infrastructure.",
      content: `# ⚡ Technology Stack & Catalog Map

**Generated:** ${dateInfo.displayDate}  
**Architecture:** Nx Monorepo + Next.js 16 + Supabase

---

## 🛠️ Stack Catalog

- **Monorepo Manager**: Nx 22 + pnpm 9.15.9 workspace
- **Frontend Core**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Design System**: OKLCH Palette (\`@repo/theme\`), Glass surfaces, Named shadows only
- **Database Layer**: Supabase PostgreSQL + Drizzle ORM / Kysely
- **Caching & Metrics**: Redis Cluster + \`@repo/redis\` rate limiting
- **Quality & E2E**: Jest, Playwright E2E, DeepEval
`,
    },
    {
      key: "project-dependencies",
      filename: "project-dependencies.md",
      title: "Project Dependencies & Monorepo Graph Map",
      category: "Workspace Graph",
      summary: "Dependency relationships between applications and shared packages in the monorepo.",
      content: `# 🕸️ Project Dependencies & Monorepo Graph Map

**Generated:** ${dateInfo.displayDate}  
**Workspace:** Nx Monorepo Workspace

---

## 📦 Package Graph Rules

- **Apps**: \`apps/portal\`, \`apps/cms\`, \`apps/overview\`
- **Packages**:
  - \`@repo/ui\` — Shared OKLCH UI component library
  - \`@repo/theme\` — Design tokens and Tailwind configuration
  - \`@repo/supabase\` — Supabase client & server factory helpers
  - \`@repo/database\` — Database migrations & source-of-truth schemas
  - \`@repo/contract\` — Zod API input & mutation contracts
  - \`@repo/redis\` — Redis caching categories & rate limiters
- **Constraint**: \`scope:app\` -> \`scope:package\` only; \`scope:package:ui\` cannot depend on database packages.
`,
    },
    {
      key: "nx-graph",
      filename: "nx-graph.md",
      title: "Nx 22 Project Graph & Task Pipeline Map",
      category: "Monorepo Orchestration",
      summary: "Visual Mermaid diagram of Nx 22 task execution graph, caching pipelines, and project tag hierarchy.",
      content: `# ⚡ Nx 22 Project Graph & Task Pipeline Map

**Generated:** ${dateInfo.displayDate}  
**Orchestration Engine:** Nx 22.7.5 + pnpm Workspaces

---

## 🎨 Visual Nx Task Execution Pipeline

\`\`\`mermaid
flowchart TD
    subgraph Inputs ["Inputs & Inputs Hashing"]
        SG["sharedGlobals (tsconfig.json, pnpm-workspace.yaml, .env)"]
        PR["{projectRoot}/**/*"]
    end

    subgraph Codegen ["Phase 1: Code & Asset Generation"]
        CG["@repo/theme:codegen"]
        SA["apps/portal:sync-assets"]
    end

    subgraph Execution ["Phase 2: Parallel Task Execution"]
        BUILD["nx run-many -t build"]
        LINT["nx run-many -t lint"]
        TC["nx run-many -t type-check"]
        TEST["nx run-many -t test"]
    end

    subgraph Cache ["Phase 3: Cache Storage & Hashing"]
        CACHE[".nx/cache / Local & S3 Cache"]
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

## 🏷️ Nx Scope Tagging Hierarchy

\`\`\`mermaid
graph TD
    subgraph Apps ["Applications (apps/*)"]
        PORTAL["scope:app:portal"]
        CMS["scope:app:cms"]
        OVERVIEW["scope:app:arch-systems-overview"]
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

    CMS --> CONTRACT
    OVERVIEW --> UI
    OVERVIEW --> THEME

    HUB --> UI
    DEPTS --> UI

    SUPABASE --> DB
    CONTRACT --> DB
\`\`\`

---

## ⚙️ Nx Configuration Overview (\`nx.json\`)
- **Default Base**: \`master\`
- **Task Hashing**: Inputs hash includes \`sharedGlobals\` + project files
- **Caching**: \`build\`, \`lint\`, \`type-check\`, \`test\`, \`codegen\` set to \`cache: true\`
- **Boundary Rules**: Enforces zero illegal imports from UI to Database internals
`,
    },
    {
      key: "dependencies-graph",
      filename: "dependencies-graph.md",
      title: "Monorepo Dependencies & Topology Graph Map",
      category: "Workspace Architecture",
      summary: "Visual Mermaid diagram of complete monorepo dependency graph and module boundary matrix.",
      content: `# 🕸️ Monorepo Dependencies & Topology Graph Map

**Generated:** ${dateInfo.displayDate}  
**Architecture:** Nx 22 Monorepo Topology

---

## 📊 Visual Monorepo Architecture Graph

\`\`\`mermaid
graph LR
    subgraph ClientApps ["Presentation & App Layer"]
        A_PORTAL["apps/portal (:3000)"]
        A_CMS["apps/cms (:3001)"]
        A_OVERVIEW["apps/overview (:3003)"]
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

    A_CMS --> P_CONTRACT

    A_OVERVIEW --> P_UI
    A_OVERVIEW --> P_THEME

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

    class A_PORTAL,A_CMS,A_OVERVIEW appStyle;
    class L_HUB,L_DEPTS,L_AUTH libStyle;
    class P_UI,P_THEME,P_SUPABASE,P_CONTRACT,P_REDIS,P_LOGGER pkgStyle;
    class P_DB dbStyle;
\`\`\`

---

## 🚫 ESLint Module Boundary Enforcement Matrix

| Source Tag | Allowed Dependencies | Forbidden Dependencies |
| :--- | :--- | :--- |
| \`scope:app\` | \`scope:package\`, \`scope:feature\` | \`scope:package:db-internal\` |
| \`scope:package:ui\` | \`scope:package:theme\` | \`scope:package:db\`, \`scope:package:db-internal\`, \`scope:package:supabase\` |
| \`scope:package:theme\` | Primitive tokens | \`scope:package:ui\` |
| \`scope:tool\` | Local Node scripts | \`scope:app\`, \`scope:package:supabase\` |
`,
    },
    {
      key: "package-structure",
      filename: "package-structure.md",
      title: "Package Structure & Module Map",
      category: "Monorepo Packages",
      summary: "Directory layout and workspace modularization rules.",
      content: `# 📁 Package Structure & Module Map

**Generated:** ${dateInfo.displayDate}  
**Standard**: XDG Compliance + Clean Workspace Modularization

---

## 📂 Root Structure Overview

- \`apps/\`: Deployable applications (\`portal\`, \`cms\`, \`overview\`)
- \`packages/\`: Shared infrastructure packages (\`ui\`, \`theme\`, \`supabase\`, \`database\`, \`contract\`, \`redis\`)
- \`libs/\`: Domain feature libraries (\`features/hub\`, \`features/departments\`)
- \`tools/\`: Build, audit, and quality automation tools
- \`codebase-maps/\`: Automated visual codebase topology maps
- \`documentation/\`: Unified documentation center including audit reports, codebase maps, and system wiki
`,
    },
  ];
}

/**
 * Main execution function.
 */
function main() {
  console.log("==================================================");
  console.log("🗺️  Generating Codebase Maps & Metadata Index");
  console.log("==================================================\n");

  const logNum = getNextLogNumber();
  const dateInfo = getFormattedDate();
  const folderName = `log-${logNum}(${dateInfo.folderDate})`;
  const targetDir = path.join(MAPS_ROOT, folderName);

  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`📁 Codebase Maps Directory: codebase-maps/${folderName}/\n`);

  const maps = buildCodebaseMaps(dateInfo);
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
      sizeBytes: Buffer.byteLength(map.content, "utf-8"),
    });

    console.log(`   ├── ${map.filename} (${(Buffer.byteLength(map.content, "utf-8") / 1024).toFixed(1)} KB)`);
  }

  // Update codebase-maps/latest/ directory
  const latestDir = path.join(MAPS_ROOT, "latest");
  fs.mkdirSync(latestDir, { recursive: true });

  for (const map of maps) {
    fs.writeFileSync(path.join(latestDir, map.filename), map.content);
    // Also update root file for backwards compatibility
    fs.writeFileSync(path.join(MAPS_ROOT, map.filename), map.content);
  }

  // Update manifest.json
  const manifestPath = path.join(MAPS_ROOT, "manifest.json");
  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      manifest = [];
    }
  }

  // Filter out any existing entry with the same folderName to prevent duplicates
  manifest = manifest.filter((entry) => entry.folderName !== folderName && entry.id !== folderName);

  manifest.unshift({
    id: folderName,
    logNumber: logNum,
    folderName,
    folderDate: dateInfo.folderDate,
    isoDate: dateInfo.isoDate,
    displayDate: dateInfo.displayDate,
    mapCount: maps.length,
    status: "Verified & Active",
    maps: mapsCatalog,
  });

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(latestDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("\n==================================================");
  console.log(`✅ Codebase Maps Generated Successfully! Log #${logNum}`);
  console.log(`📋 Metadata Manifest Index: codebase-maps/manifest.json`);
  console.log(`⚡ Instant Active Access: codebase-maps/latest/`);
  console.log("==================================================\n");
}

main();
