# 🕸️ Monorepo Dependencies & Topology Graph Map

**Generated:** 8/20/2026, 9:17:54 AM UTC  
**Architecture:** Nx 22 Monorepo Topology

---

## 📊 Visual Monorepo Architecture Graph

```mermaid
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
```

---

## 🚫 ESLint Module Boundary Enforcement Matrix

| Source Tag | Allowed Dependencies | Forbidden Dependencies |
| :--- | :--- | :--- |
| `scope:app` | `scope:package`, `scope:feature` | `scope:package:db-internal` |
| `scope:package:ui` | `scope:package:theme` | `scope:package:db`, `scope:package:db-internal`, `scope:package:supabase` |
| `scope:package:theme` | Primitive tokens | `scope:package:ui` |
| `scope:tool` | Local Node scripts | `scope:app`, `scope:package:supabase` |
