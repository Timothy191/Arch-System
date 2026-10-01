# Complete Production Overhaul — Design

## 1. Data Flow: Before vs After

### Before (broken)

```
Request arrives at Vercel Edge
  -> proxy.ts: resolveDeptUuid(supabase, slug)
       -> cacheGet("dept:uuid:slug")  [Redis, 150ms timeout]
       -> on timeout: Promise.race rejects
       -> catch swallows, falls through
       -> supabase.from('departments').select('id').eq('name', slug).single()
            -> PostgREST evaluates RLS policy
            -> policy sub-plan: SELECT 1 FROM employees WHERE auth_id = auth.uid() ...
            -> no index on employees(auth_id) -> seq scan
            -> 19.4s
```

### After (fixed)

```
Request arrives at Vercel Edge
  -> proxy.ts: getDeptId(slug)  [module-level Map, 5-min TTL]
       -> cache hit: O(1) Map lookup, <0.1ms
       -> cache miss: ONE DB query for ALL departments, populates Map
       -> subsequent requests for 5 minutes: O(1) lookup
```

## 2. Component Hierarchy

```
Vercel Edge (proxy.ts)
  |-- auth: getUser() -> cacheGet("arch:auth:employee:{userId}") [500ms soft timeout]
  |     |-- hit: O(1) Map lookup
  |     |-- miss/timeout: return null, caller proceeds (NO DB fallback)
  |     |-- genuine miss: supabase.from('employees').select(...).eq('auth_id', ...)
  |           |-- index scan on idx_employees_auth_id (new)
  |           |-- RLS policy sub-plan: index scan, not seq scan
  |-- dept lookup: getDeptId(slug) [module-level Map, 5-min TTL]
  |     |-- hit: O(1) Map lookup
  |     |-- miss: ONE query for ALL departments, populates Map
  |-- route handler
       |-- getDepartmentContext({ department })
             |-- getDeptId(slug) [O(1) Map lookup]
             |-- supabase.from('machines').select(...).eq('department_id', deptId)
             |-- supabase.from('breakdowns').select(...).eq('department_id', deptId)
             |-- supabase.from('fleet').select(...).eq('department_id', deptId)
```

## 3. RLS Policy Evaluation (after fix)

For a query on `machines` WHERE `department_id = '<uuid>'`:

```
PostgREST receives: SELECT * FROM machines WHERE department_id = '<uuid>'
PostgREST rewrites: SELECT * FROM machines WHERE department_id = '<uuid>'
  AND (RLS policy for SELECT on machines)
RLS policy:
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.auth_id = auth.uid()  -- index scan on idx_employees_auth_id
      AND (
        e.role = 'admin'           -- index scan on idx_employees_department
        OR e.department_id = machines.department_id
        OR machines.department_id = ANY(e.accessible_departments)  -- GIN index
      )
  )
```

Before the fix: no index on `employees(auth_id)`, so the sub-plan does a seq
scan on `employees` for every `machines` row checked. After the fix: index
scan, sub-10ms.

## 4. Caching Layers (after fix)

| Layer | What | TTL | Failure mode |
|---|---|---|---|
| L0 (module Map) | department UUID registry | 5 min | Miss -> one DB query for all depts |
| L1 (memory) | employee auth cache | 30s cap | Miss -> Redis |
| L2 (Redis) | employee auth cache, dept UUID | 1h | Timeout (500ms soft) -> return null, no DB fallback |
| DB | departments, employees, machines, breakdowns, fleet | N/A | Index scan on all hot paths |

The key change: **L2 timeout no longer triggers a DB fallback**. It returns
null and lets the caller proceed. This prevents the thundering herd where
every request that times out Redis also hits the DB, compounding latency.

## 5. Inngest Job Registration

The three untracked jobs each call `inngest.createFunction(...)` at module
load. They must be imported only from the Inngest serve route:

```
apps/portal/lib/jobs/
  outbox-drain.ts          -> outboxDrainFn
  shift-closeout-report.ts -> shiftCloseoutReportFn
  autonomous-scada-simulation.ts -> autonomousScadaSimulationFn

apps/portal/app/api/inngest/route.ts
  import { inngest } from '@repo/utils/inngest';
  import { outboxDrainFn } from '@/lib/jobs/outbox-drain';
  import { shiftCloseoutReportFn } from '@/lib/jobs/shift-closeout-report';
  import { autonomousScadaSimulationFn } from '@/lib/jobs/autonomous-scada-simulation';
  export const { GET, POST } = inngest.serveHandlers({
    client: inngest,
    functions: [outboxDrainFn, shiftCloseoutReportFn, autonomousScadaSimulationFn],
  });
```

Do NOT import these from any client-bundled route — `inngest.createFunction`
pulls server-only modules and will break the client bundle.