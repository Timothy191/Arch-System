---
name: next-server-components
description: "React 19 Server Components, 'use client' boundaries, state management, taint APIs, and CSS runbook: async components, promise streaming with use(), serializable props, and secret isolation."
version: '1.0.0'
---

# React 19 Server Components & Client Boundary Runbook

**Governing Mandate:** In Arch-System, all components in `apps/portal` are React Server Components (RSC) by default. They run ahead of time on the server or during static build time, eliminating backend APIs for internal data reads and preventing heavy libraries (markdown parsers, query engines) from reaching the client bundle. Interactive functionality is isolated in Client Components using `'use client'`. Sensitive database entities and secret tokens are guarded across the RSC boundary using React 19 Taint APIs (`experimental_taintObjectReference` and `experimental_taintUniqueValue`).

---

## 1. Core Invariants & Architectural Rules

1. **Rule RSC-001 (Server Component Default & No Directive)**:
   - Components in Next.js App Router are Server Components by default without any directive.
   - **Hard Negative**: `"use server"` is **NOT** a directive for Server Components; it denotes Server Functions/Actions. NEVER place `"use server"` at the top of a component file or function returning JSX.

2. **Rule RSC-002 (Serializable Boundary Props)**:
   - Data passed from Server Components to Client Components across the RSC boundary MUST be strictly serializable: primitives, plain objects, dates, arrays, maps/sets, promises, JSX elements, and Server Functions (`'use server'`).
   - **Hard Negative**: NEVER pass event handlers (`onClick`), class instances, or functions not marked with `'use server'` across the server-client boundary.

3. **Rule RSC-003 (Context Provider & Hook Isolation)**:
   - `createContext()` and React Hooks (`useState`, `useEffect`, `useReducer`, `useRef`, `useLayoutEffect`) are strictly client-only.
   - Context providers MUST be defined in `'use client'` modules. Server Components can import and render them, wrapping `{children}`, and must position them as deeply in the React tree as possible to avoid de-optimizing the static App Shell.

4. **Rule RSC-004 (Promise Streaming with React 19 `use()`)**:
   - For secondary, below-the-fold, or slow data, initiate the database or fetch promise in the Server Component without awaiting it.
   - Pass the unresolved promise to a Client Component wrapped in `<Suspense fallback={<Skeleton />}>` and unwrap it using React 19 `use(promise)`.

5. **Rule RSC-005 (React 19 Taint Protection)**:
   - With `experimental: { taint: true }` in `next.config.mjs`, sensitive data objects or secrets (database records, API tokens, hashed credentials) must be guarded using `experimental_taintObjectReference` or `experimental_taintUniqueValue`.
   - React will immediately throw a build/runtime error if a tainted object or value crosses the RSC boundary into a Client Component.

6. **Rule RSC-006 (State Architecture & Key Reset)**:
   - Avoid redundant or duplicated state; compute derived values during render.
   - To reset component state when switching entities (e.g. active equipment or shift in a form), pass a unique `key={entityId}` to the component rather than clearing state inside a `useEffect`.

7. **Rule RSC-007 (CSS Predictability & Single Entry)**:
   - In Next.js and Turbopack, CSS chunk ordering follows JS import order. Global CSS (`globals.css`) and Tailwind base imports MUST only be imported in `app/layout.tsx`.
   - Component-specific styling should use Tailwind CSS with semantic OKLCH tokens (`@repo/theme`) or scoped `.module.css`.

---

## 2. Implementation Recipes & Code Patterns

### Recipe A: Async Server Component with Direct DB Query (Zero Client JS)

```tsx
import { createServerSupabaseClient } from '@repo/supabase/server';
import { GlassCard } from '@repo/ui';

// This component runs on the server; Supabase client & query logic NEVER ship to client
export async function PitOverviewCard({ pitId }: { pitId: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: pit } = await supabase
    .from('pits')
    .select('id, name, benches, extraction_rate')
    .eq('id', pitId)
    .single();

  if (!pit) return null;

  return (
    <GlassCard variant="spotlight" className="p-4">
      <h3 className="font-semibold">{pit.name}</h3>
      <p className="font-mono text-xl">{pit.extraction_rate} t/h</p>
    </GlassCard>
  );
}
```

### Recipe B: Promise Streaming from Server to Client with React 19 `use()`

```tsx
// Server Component (app/drilling/page.tsx)
import { Suspense } from 'react';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { KPISkeleton } from '@repo/ui';
import { TelemetryStreamView } from './TelemetryStreamView';

export default async function DrillingPage() {
  const supabase = await createServerSupabaseClient();

  // Initiate query promise WITHOUT awaiting it
  const telemetryPromise = supabase
    .from('drill_telemetry')
    .select('id, bit_depth, penetration_rate, timestamp')
    .order('timestamp', { ascending: false })
    .limit(50)
    .then((res) => res.data ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Drill Telemetry Stream</h1>

      {/* Streamed promise unwrapped inside Suspense */}
      <Suspense fallback={<KPISkeleton />}>
        <TelemetryStreamView telemetryPromise={telemetryPromise} />
      </Suspense>
    </div>
  );
}

// Client Component (app/drilling/TelemetryStreamView.tsx)
('use client');

import { use } from 'react';

interface TelemetryItem {
  id: string;
  bit_depth: number;
  penetration_rate: number;
}

export function TelemetryStreamView({
  telemetryPromise,
}: {
  telemetryPromise: Promise<TelemetryItem[]>;
}) {
  // React 19 use() unwraps the streamed promise without useEffect
  const telemetry = use(telemetryPromise);

  return (
    <div className="space-y-2 font-mono">
      {telemetry.map((t) => (
        <div key={t.id} className="flex justify-between p-2 bg-color-bg-elevated rounded">
          <span>Depth: {t.bit_depth}m</span>
          <span>ROP: {t.penetration_rate} m/h</span>
        </div>
      ))}
    </div>
  );
}
```

### Recipe C: React 19 Taint Enforcement for Sensitive Telemetry & Secrets

```ts
import { experimental_taintObjectReference, experimental_taintUniqueValue } from 'react';
import { createServerSupabaseClient } from '@repo/supabase/server';

export async function getSecureShiftCredentials(shiftId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: creds } = await supabase
    .from('shift_supervisors')
    .select('id, name, radio_pin, master_access_token')
    .eq('shift_id', shiftId)
    .single();

  if (!creds) throw new Error('Shift credentials not found');

  // Taint the entire object so it cannot be passed directly to a Client Component
  experimental_taintObjectReference(
    'Do not pass raw shift supervisor credentials to Client Components. Select only safe public fields.',
    creds
  );

  // Taint the master token unique string
  experimental_taintUniqueValue(
    'Do not expose master access tokens to the browser.',
    creds,
    creds.master_access_token
  );

  return creds;
}
```

### Recipe D: Clean State Management with Key Reset

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@repo/ui';

export function EquipmentBreakdownManager({
  equipmentList,
}: {
  equipmentList: { id: string; code: string }[];
}) {
  const [selectedId, setSelectedId] = useState(equipmentList[0]?.id);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {equipmentList.map((eq) => (
          <Button key={eq.id} onClick={() => setSelectedId(eq.id)}>
            {eq.code}
          </Button>
        ))}
      </div>

      {/* Passing key={selectedId} resets the form state automatically on equipment switch */}
      <BreakdownLogForm key={selectedId} equipmentId={selectedId} />
    </div>
  );
}

function BreakdownLogForm({ equipmentId }: { equipmentId: string }) {
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState(0);

  return (
    <form className="space-y-2">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Defect description"
      />
      <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
    </form>
  );
}
```

---

## 3. Verification & Quality Gates

Run the dedicated React Server Components auditor:

```bash
pnpm audit:rsc
```

Or verify across the full compliance suite:

```bash
pnpm audit:compliance
```
