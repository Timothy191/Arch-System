# Control Room Data Flows (`TASK-13.7`)

**Audience:** Platform Engineers, Backend Developers, Data Engineers  
**Department:** Control Room (`/control-room`)

---

## 1. Shift Completeness & Production Accounting Flow

`getShiftCompleteness` (`apps/portal/lib/shift-completeness.ts`) executes six parallel Supabase queries via `Promise.all` and caches the aggregated sheet under `CacheCategory.SHIFT`:

```mermaid
sequenceDiagram
  participant Client as Control Room UI
  participant API as GET /api/control-room/shift-completeness
  participant Cache as Redis L1/L2 + Next Cache
  participant DB as Supabase PostgreSQL

  Client->>API: Request completeness (deptId, date, shift)
  API->>Cache: Lookup CacheCategory.SHIFT [deptId, slug, date, shift]
  alt Cache Hit
    Cache-->>API: Return cached ShiftCompleteness
  else Cache Miss
    par Parallel Queries
      API->>DB: SELECT machines (active, report_exempt)
      API->>DB: SELECT machine_operations + delay_entries
      API->>DB: SELECT excavator_activity
      API->>DB: SELECT dozer_rolls
      API->>DB: SELECT hourly_loads
      API->>DB: SELECT breakdowns
    end
    DB-->>API: Rows or DatabaseError (never caches partial failure)
    API->>Cache: Store ShiftCompleteness with table & dept tags
  end
  API-->>Client: Return { complete, totalRequired, totalCovered, statuses }
```

---

## 2. Audited Shift Closeout & PIN Approval Flow

```mermaid
sequenceDiagram
  participant Op as Operator Browser
  participant Sup as Supervisor Browser
  participant CloseAPI as POST /api/control-room/shift-closeout
  participant Rate as RateLimiter + Redis Lockout
  participant DB as Supabase (atomic_shift_closeout RPC)

  Op->>CloseAPI: Submit closeout + Idempotency-Key
  CloseAPI->>Rate: Check rate limit (5 req/min per user)
  CloseAPI->>DB: Verify shift completeness + record idempotency key
  DB-->>Op: Shift status = pending_approval
  Sup->>CloseAPI: Approve with 6-digit Supervisor PIN (approverId != operatorId)
  CloseAPI->>Rate: Verify PIN attempts (<3 in 5m) & lockout state
  CloseAPI->>DB: Execute atomic_shift_closeout RPC
  DB-->>CloseAPI: Commit closed state + immutable audit log
  CloseAPI->>Rate: Invalidate dept:control-room & shift caches
  CloseAPI-->>Sup: Return { success: true }
```

---

## 3. Reverse-Flow FUXA SCADA Telemetry Flow

```mermaid
sequenceDiagram
  participant Edge as Field PLC / Supabase Webhook
  participant Push as POST /api/telemetry/push
  participant Redis as Redis Telemetry Store
  participant Tags as GET /api/scada/tags
  participant Fuxa as On-Prem FUXA Server
  participant UI as Operator ScadaPanel

  Edge->>Push: Push machine telemetry payload
  Push->>Redis: Write latest tag values (scada:machines:<deptId>)
  Fuxa->>Tags: Poll WebAPI device tags via Cloudflare tunnel
  Tags->>Redis: Read current telemetry tags
  Redis-->>Fuxa: Return JSON tag dictionary
  UI->>Fuxa: Render live gauges in FuxaFrame iframe
```
