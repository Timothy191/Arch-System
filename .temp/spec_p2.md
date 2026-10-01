# Complete Production Overhaul — Technical Specification (cont.)

## 2. Code Changes (Phase 1)

### 2a. `apps/portal/lib/dept-registry.ts` — replace per-request lookups

Four call sites currently do `.from('departments').select('id').eq('name', slug).single()`:
- `apps/portal/server/proxy.ts:138` (resolveDeptUuid, per request, on the Edge)
- `apps/portal/lib/dept-context.ts:30` (getDepartmentContext, per page render)
- `apps/portal/lib/prewarm-cache.ts:24` (prewarmDepartmentCache, per layout)
- `apps/portal/lib/hub-departments.ts:33`, plus 6 more in jobs/

Create a module-level registry that loads ALL departments once into a
Map keyed by name, with a 5-min TTL:

```typescript
// apps/portal/lib/dept-registry.ts
import { createServerSupabaseClient } from '@repo/supabase/server';

const TTL_MS = 5 * 60 * 1000;
let cache: Map<string, string> | null = null;
let cacheAt = 0;

export async function getDeptId(name: string): Promise<string | null> {
  const now = Date.now();
  if (!cache || now - cacheAt > TTL_MS) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from('departments').select('id, name');
    cache = new Map((data ?? []).map((d) => [d.name, d.id]));
    cacheAt = now;
  }
  return cache.get(name) ?? null;
}

export function getDeptIdSync(name: string): string | null {
  return cache?.get(name) ?? null;
}
```

Then update the four call sites to use `getDeptId` instead of the raw
`.from('departments')...single()` query. The DB query happens once per
5-minute TTL window, not once per request.

### 2b. `packages/supabase/src/auth.ts` — fix the Redis timeout race

Current (lines 60-64):
```typescript
const cachePromise = cacheGet<EmployeeSummary>(EMPLOYEE_CACHE_KEY(user.id));
const timeoutPromise = new Promise<null>((_, reject) =>
  setTimeout(() => reject(new Error('Redis cache timeout')), CACHE_TIMEOUT_MS)
);
employee = await Promise.race([cachePromise, timeoutPromise]);
```

The 150 ms timeout is too short for Vercel Redis round-trips. When it fires,
the catch swallows it and the code falls through to a direct DB query —
which is what produces the 19s latency. Fix: raise to 500 ms and make the
timeout a soft deadline that returns null but does NOT trigger a DB
fallback. Let the caller proceed with the cached value or a safe default.

```typescript
const CACHE_TIMEOUT_MS = 500; // was 150

// On timeout, return null from the cache path but do NOT fall through to DB.
// Falling through on every timeout amplifies load on the departments/
// employees tables and produces the 19s query latency.
employee = await Promise.race([
  cacheGet<EmployeeSummary>(EMPLOYEE_CACHE_KEY(user.id)),
  new Promise<null>((resolve) => setTimeout(() => resolve(null), CACHE_TIMEOUT_MS)),
]);
```

### 2c. `apps/portal/server/proxy.ts` — same fix

Lines 301-316 use the same 150 ms `Promise.race` pattern. Apply the same
change: raise to 500 ms, resolve null on timeout instead of rejecting.

### 2d. `apps/portal/app/api/departments/[departmentId]/fleet/route.ts`

Add a `department_id` filter so the RLS policy has a concrete value to
match against, and use the new `getDeptId` registry:

```typescript
import { getDeptId } from '@/lib/dept-registry';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  try {
    const { departmentId } = await params;
    const supabase = await createServerSupabaseClient();
    const deptUuid = await getDeptId(departmentId);
    const { data, error } = await supabase
      .from('fleet')
      .select('id, code, category, status, hour_meter')
      .eq('department_id', deptUuid)
      .order('code');
    if (error && error.code !== '42P01') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch fleet' }, { status: 500 });
  }
}
```

### 2e. `apps/portal/app/(departments)/[department]/machines/page.tsx`

Add a `department_id` filter so the RLS policy has a concrete value:

```typescript
const { deptId } = await getDepartmentContext({ department: deptSlug });
const { data: machines } = await supabase
  .from('machines')
  .select('id, name, machine_type, serial_number, active, created_at, site:sites(name, site_code)')
  .eq('department_id', deptId)  // ADD THIS — was missing, relied entirely on RLS
  .order('name');
```