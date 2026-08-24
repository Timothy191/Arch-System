# ⚡ Nx 22 Project Graph & Task Pipeline Map

**Generated:** 8/24/2026, 8:12:37 AM UTC  
**Orchestration Engine:** Nx 22.7.5 + pnpm Workspaces

---

## 🎨 Visual Nx Task Execution Pipeline

```mermaid
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
```

---

## 🏷️ Nx Scope Tagging Hierarchy

```mermaid
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
```

---

## ⚙️ Nx Configuration Overview (`nx.json`)

- **Default Base**: `master`
- **Task Hashing**: Inputs hash includes `sharedGlobals` + project files
- **Caching**: `build`, `lint`, `type-check`, `test`, `codegen` set to `cache: true`
- **Boundary Rules**: Enforces zero illegal imports from UI to Database internals
