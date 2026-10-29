# 🔒 Database Schema & Topology Map

**Generated:** ${dateInfo.displayDate}  
**Engine:** PostgreSQL 17 via Supabase  
**Migrations SSoT:** `packages/database/migrations/` (189 Applied Immutable Migrations)

---

## 📊 Core Mining Entity Relationship Diagram

```mermaid
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
```

---

## 🛡️ Security & Row Level Security (RLS) Mandates

1. **100% Table RLS Coverage**: Every table in `public` schema has Row Level Security enabled.
2. **InitPlan Subquery Optimization**: Policies wrap `auth.uid()` in scalar subqueries (e.g. `(SELECT auth.uid())`), enabling PostgreSQL query planner to evaluate authentication once per query rather than once per row.
3. **Multi-Tenant Department Isolation**: Employee access is strictly gated by department membership and verified against `accessible_departments` claims.
4. **Primary vs. Read Replica Routing**:
   - Transactional mutations & RPCs use `createServerSupabaseClient()` directed to primary PgBouncer.
   - Heavy analytical aggregations & overview reports use `createReadReplicaClient()` to protect OLTP throughput.
5. **Contract Parity**: Every database column has a matching runtime Zod validator in `packages/contract/src/schemas/`, validated on every commit by `pnpm audit:drift`.
