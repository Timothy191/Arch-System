# 🕸️ Project Dependencies & Monorepo Graph Map

**Generated:** ${dateInfo.displayDate}  
**Workspace:** Turborepo Monorepo Workspace (pnpm 9.15.9)

---

## 📦 Package Dependency & Boundary Rules

```mermaid
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
```

---

## 🚫 Module Boundary Enforcement Matrix

| Source Scope          | Allowed Targets                                | Strictly Forbidden Targets                                      | Enforcement Gate    |
| :-------------------- | :--------------------------------------------- | :-------------------------------------------------------------- | :------------------ |
| `scope:app`           | `scope:package`, `scope:feature`               | `scope:package:db-internal`                                     | `pnpm policy:check` |
| `scope:package:ui`    | `scope:package:theme`                          | `scope:package:db-internal`, `scope:package:supabase`, `apps/*` | `pnpm policy:check` |
| `scope:package:theme` | Tokens source (`tokens.json`)                  | `scope:package:ui`, `apps/*`                                    | `pnpm policy:check` |
| `scope:feature`       | `@repo/ui`, `@repo/contract`, `@repo/supabase` | `@repo/database` direct access                                  | `pnpm policy:check` |
| `scope:tool`          | Local Node utilities, static AST tools         | `apps/*`, runtime database clients                              | `pnpm policy:check` |
