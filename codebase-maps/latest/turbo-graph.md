# ⚡ Turborepo Project Graph & Task Pipeline Map

**Generated:** ${dateInfo.displayDate}  
**Orchestration Engine:** Turborepo 2.x + pnpm Workspaces

---

## 🎨 Visual Turborepo Task Execution Pipeline

```mermaid
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
```

---

## 🏷️ Nx Scope Tagging Hierarchy

```mermaid
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
```

---

## ⚙️ Turborepo Configuration Overview (`turbo.json`)

- **Task Pipelines**: `build`, `lint`, `type-check`, `test`, `codegen`, `sync-assets`
- **Task Hashing**: Inputs hash includes `globalDependencies`, `globalEnv`, and `$TURBO_DEFAULT$`
- **Caching**: `build`, `lint`, `type-check`, `test`, `codegen` set to `cache: true`
- **Boundary Rules**: Enforces zero illegal imports from UI to Database internals via `eslint-plugin-boundaries`
