---
title: "Q: How should I fetch data?"
created: 2026-05-15
updated: 2026-05-15
type: query
tags: [how-to, data-fetching, rsc, quick-reference]
sources:
  [
    wiki/concepts/portal-app-architecture.md,
    wiki/concepts/state-management.md,
    wiki/concepts/ai-service.md,
  ]
confidence: high
---

# Q: How should I fetch data?

## Quick Answer

**Use Server Components by default** — direct Supabase queries in `page.tsx`. Only use client-side fetching for real-time updates or user interactions.

---

## Decision Tree

```
Do you need real-time updates?
├── YES → Client Component + Supabase subscription
│          OR Server Action + revalidate
│
└── NO → Is it user-specific data?
         ├── YES → Server Component + RLS policies
         │
         └── NO → Static/fetched at build?
                    ├── YES → Server Component + cache
                    └── NO → Server Component (default)
```

---

## Method 1: Server Component (Default)

**Use for**: Most data fetching, initial page loads, static data

```typescript
// apps/portal/app/(departments)/production/dashboard/page.tsx
import { createServerSupabaseClient } from '@repo/supabase/server'
import { getDepartmentContext } from '~/lib/dept-context'

export default async function ProductionDashboard({ params }: { params: { department: string } }) {
  // Get department context (validates slug, gets dept ID)
  const { dept, supabase } = await getDepartmentContext(params)

  // Fetch data directly in Server Component
  const { data: machines } = await supabase
    .from('machines')
    .select('*')
    .eq('department_id', dept.id)
    .order('name')

  const { data: todayLogs } = await supabase
    .from('daily_logs')
    .select('*, machine_hours(*)')
    .eq('department_id', dept.id)
    .eq('log_date', new Date().toISOString().split('T')[0])
    .single()

  return (
    <div>
      <KPIGrid>
        <KPICard title="Machines" value={machines?.length ?? 0} />
        <KPICard title="Hours Today" value={todayLogs?.total_hours ?? 0} />
      </KPIGrid>
      <MachineTable machines={machines} />
    </div>
  )
}
```

### Benefits

- Zero client JavaScript for data fetching
- RLS policies enforce security automatically
- No API routes needed
- Data included in initial HTML

---

## Method 2: Server Actions (Mutations)

**Use for**: Form submissions, data mutations, updates

```typescript
// Server Action — can be in separate file or inline
"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";

export async function addMachine(formData: FormData) {
  const supabase = createServerSupabaseClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Insert data
  const { error } = await supabase.from("machines").insert({
    name: formData.get("name"),
    machine_type: formData.get("type"),
    department_id: formData.get("department_id"),
  });

  if (error) throw new Error(error.message);

  // Revalidate the page to show new data
  revalidatePath("/[department]/machines");
}
```

Usage in Client Component:

```typescript
'use client'

export function AddMachineForm() {
  return (
    <form action={addMachine}>
      <input name="name" required />
      <select name="type">
        <option value="excavator">Excavator</option>
        <option value="dozer">Dozer</option>
      </select>
      <button type="submit">Add Machine</button>
    </form>
  )
}
```

---

## Method 3: Client Component + Real-time

**Use for**: Live dashboards, real-time alerts, collaborative features

```typescript
'use client'

import { createClient } from '@repo/supabase/client'
import { useEffect, useState } from 'react'

export function AlertPanel({ departmentId }: { departmentId: string }) {
  const [alerts, setAlerts] = useState([])
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('department_id', departmentId)
        .order('created_at', { ascending: false })
      setAlerts(data ?? [])
    }
    fetchAlerts()

    // Real-time subscription
    const channel = supabase
      .channel('alerts')
      .on(
        'postgres_changes',
        {
          event: '*',  // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'alerts',
          filter: `department_id=eq.${departmentId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAlerts((prev) => [payload.new, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [departmentId])

  return <AlertList alerts={alerts} />
}
```

---

## Method 4: AI Service (LLM Data)

**Use for**: Predictive maintenance, summaries, natural language queries

```typescript
// Client component calling AI endpoint
'use client'

import { useState } from 'react'

export function PredictiveAnalysis({ machineData }: { machineData: any }) {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)

  const getAnalysis = async () => {
    setLoading(true)

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Analyze predictive maintenance for: ${JSON.stringify(machineData)}`
        }],
        template: 'predictiveMaintenance'
      })
    })

    const reader = response.body?.getReader()
    // Handle streaming response...

    setLoading(false)
  }

  return (
    <div>
      <button onClick={getAnalysis} disabled={loading}>
        {loading ? 'Analyzing...' : 'Get AI Analysis'}
      </button>
      <div>{analysis}</div>
    </div>
  )
}
```

---

## Data Fetching Patterns

### Pattern: Parallel Queries

```typescript
// Fetch multiple datasets in parallel
const [{ data: machines }, { data: operators }, { data: sites }] =
  await Promise.all([
    supabase.from("machines").select("*").eq("department_id", dept.id),
    supabase.from("operators").select("*").eq("department_id", dept.id),
    supabase.from("sites").select("*").eq("department_id", dept.id),
  ]);
```

### Pattern: Nested Data

```typescript
// Include related data in single query
const { data: logs } = await supabase
  .from("daily_logs")
  .select(
    `
    *,
    machine_hours(*),
    fuel_logs(*),
    production_logs(*)
  `,
  )
  .eq("department_id", dept.id)
  .eq("log_date", today);
```

### Pattern: Caching

```typescript
// Cache data for 5 minutes (ISR)
export const revalidate = 300; // 5 minutes

// Or use Next.js cache with tags
import { unstable_cache } from "next/cache";

const getCachedMachines = unstable_cache(
  async (deptId) => {
    const supabase = createServerSupabaseClient();
    return supabase.from("machines").select("*").eq("department_id", deptId);
  },
  ["machines"],
  { revalidate: 300 },
);
```

---

## When NOT to Use Each Method

| Method             | Don't Use When                                   |
| ------------------ | ------------------------------------------------ |
| Server Component   | Real-time data needed; User interaction required |
| Server Actions     | Large data transfers; Long-running operations    |
| Client + Real-time | Static data that doesn't change                  |
| AI Service         | Simple CRUD; When latency is critical            |

---

## Error Handling

### Server Component

```typescript
const { data: machines, error } = await supabase
  .from('machines')
  .select('*')

if (error) {
  console.error('Failed to fetch machines:', error)
  return <ErrorMessage message="Failed to load machines" />
}

if (!machines || machines.length === 0) {
  return <EmptyState message="No machines found" />
}
```

### Client Component

```typescript
const [data, setData] = useState(null)
const [error, setError] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchData = async () => {
    try {
      const { data, error } = await supabase.from('...').select()
      if (error) throw error
      setData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  fetchData()
}, [])

if (loading) return <LoadingSpinner />
if (error) return <ErrorMessage message={error} />
```

---

## Related

- [[portal-app-architecture]] — RSC and Server Actions patterns
- [[state-management]] — Client state philosophy
- [[ai-service]] — AI data fetching
- [[supabase-local-dev]] — Database client setup
