---
name: next-routing-and-actions
description: 'Next.js 16 App Router, Layouts, Server Actions, Server/Client Boundaries, and Proxy runbook: nested routing, async params/searchParams, form mutations with useActionState, security enforcement, and proxy configuration.'
version: '1.0.0'
---

# Next.js 16 App Router, Server Actions & Boundary Runbook

**Governing Mandate:** Arch-System enforces Next.js 16 App Router architectural boundaries across `apps/portal`. Layouts and pages are Server Components by default to maximize server-side data proximity, zero-JS bundle weight, and secret isolation. Client interactivity is pushed down to leaf Client Components (`'use client'`). Server Actions (`'use server'`) serve as secure, typed mutation endpoints with caller authorization and tag-based cache revalidation. Pre-routing authentication and CSP nonces are centralized in `proxy.ts`.

---

## 1. Core Invariants & Architectural Rules

1. **Rule ROUTING-001 (App Router Layout & Page Hierarchy)**:
   - The Root Layout (`apps/portal/app/layout.tsx`) is mandatory and MUST contain `<html>` and `<body>` tags.
   - Layouts accept `children: React.ReactNode`, wrap nested segments, and preserve client state during route transitions.
   - **Hard Negative**: NEVER place `route.ts` and `page.tsx` in the same directory segment. Route Handlers take over all HTTP verbs and conflict with page rendering.

2. **Rule ROUTING-002 (Dynamic Route & SearchParams Asynchrony)**:
   - In Next.js 16 (React 19), route `params` and `searchParams` passed to pages and layouts are `Promise` types. They MUST be awaited before reading properties (`const { id } = await params;`).
   - Using `searchParams` opts pages into dynamic rendering. Wrap search-dependent components in `<Suspense fallback={<Skeleton />}>` to preserve static prerendering of surrounding page shells.

3. **Rule ROUTING-003 (Server Component Default & Leaf Client Boundary)**:
   - Layouts, pages, and data fetchers MUST remain Server Components by default.
   - Push `'use client'` strictly down to leaf interactive elements (buttons, modals, form inputs, interactive charts).
   - Never convert a whole layout or page to `'use client'` just to use a button or toggle.

4. **Rule ROUTING-004 (Interleaving & Context Provider Positioning)**:
   - Visually nest server-rendered UI within client layouts by passing Server Components as `children` or named slots to Client Components.
   - Context providers (theme, UI shell) must be Client Components rendering `{children}` and rendered as deeply in the React tree as possible to avoid de-optimizing the static App Shell.

5. **Rule ROUTING-005 (Server Function & Action Security)**:
   - Every Server Action (`'use server'`) is an exposed HTTP `POST` endpoint directly reachable across the network.
   - Every Server Action MUST verify caller authentication (e.g. `getUserSafely(supabase)`) and authorization (role/department access) before mutating data.
   - Validate incoming mutation payloads using canonical Zod schemas from `@repo/contract`.

6. **Rule ROUTING-006 (Mutation Invalidation & Redirection Flow)**:
   - When redirecting in a Server Action, `revalidatePath()` or `revalidateTag()` / `cacheInvalidateTags()` MUST be called BEFORE `redirect()`.
   - `redirect()` throws a framework control-flow exception; any revalidation code placed after `redirect()` will never execute.

7. **Rule ROUTING-007 (Proxy Execution & Boundary)**:
   - In Next.js 16, pre-routing logic is centralized in `apps/portal/proxy.ts` (replacing deprecated `middleware.ts`).
   - Proxy must remain lightweight (session presence, role redirection, CSP nonces). Never execute slow unmemoized database queries or large batch operations in `proxy.ts`.

8. **Rule ROUTING-008 (Environment Poisoning Prevention)**:
   - Modules containing server secrets, database connections, or private keys must import `server-only` to guarantee compile-time failure if accidentally imported into a Client Component.

---

## 2. Implementation Recipes & Code Patterns

### Recipe A: Server Component Page with Async Params & Data Fetching

```tsx
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { GlassCard } from '@repo/ui';
import { ShiftStatusToggle } from './ShiftStatusToggle';

interface PageProps {
  params: Promise<{ department: string; shiftId: string }>;
}

export default async function ShiftDetailPage({ params }: PageProps) {
  const { department, shiftId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: shift, error } = await supabase
    .from('shifts')
    .select('id, name, status, start_time, end_time')
    .eq('id', shiftId)
    .single();

  if (error || !shift) notFound();

  return (
    <GlassCard variant="window" className="p-6">
      <h1 className="text-xl font-bold">{shift.name}</h1>
      <p className="text-sm text-color-text-secondary">Department: {department}</p>

      {/* Interactive client component isolated at leaf node */}
      <ShiftStatusToggle shiftId={shift.id} initialStatus={shift.status} />
    </GlassCard>
  );
}
```

### Recipe B: Secure Server Action with Form State & Revalidation

```tsx
'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { cacheInvalidateTags } from '@repo/redis';

export async function closeShiftAction(prevState: unknown, formData: FormData) {
  const shiftId = formData.get('shiftId') as string;
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  // 1. Authenticate caller
  if (!user) {
    return { success: false, error: 'Unauthorized: active session required.' };
  }

  // 2. Execute mutation
  const { error } = await supabase
    .from('shifts')
    .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user.id })
    .eq('id', shiftId);

  if (error) {
    return { success: false, error: error.message };
  }

  // 3. Revalidate cache BEFORE redirect
  revalidateTag(`shift_${shiftId}`);
  revalidateTag('shifts_summary');
  await cacheInvalidateTags([`shift_${shiftId}`, 'shifts']);

  // 4. Redirect after cache invalidation
  redirect('/control-room');
}
```

### Recipe C: Client Component Invoking Action with `useActionState`

```tsx
'use client';

import { useActionState } from 'react';
import { closeShiftAction } from './actions';
import { Button } from '@repo/ui';

export function ShiftCloseoutForm({ shiftId }: { shiftId: string }) {
  const [state, formAction, isPending] = useActionState(closeShiftAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="shiftId" value={shiftId} />
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Closing Shift...' : 'Close Shift'}
      </Button>
    </form>
  );
}
```

### Recipe D: Interleaving Server Components in Client Modals (Slot Pattern)

```tsx
// ModalContainer.tsx ('use client')
'use client';

import { useState } from 'react';
import { GlassCard, Button } from '@repo/ui';

export function ModalContainer({
  triggerLabel,
  children,
}: {
  triggerLabel: string;
  children: React.ReactNode; // Server-rendered slot
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>{triggerLabel}</Button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <GlassCard variant="spotlight" className="p-6 max-w-lg w-full">
            <button onClick={() => setIsOpen(false)} className="float-right text-sm">
              ✕
            </button>
            {children}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// Page.tsx (Server Component)
import { ModalContainer } from './ModalContainer';
import { ServerAuditLogFeed } from './ServerAuditLogFeed';

export default function AuditPage() {
  return (
    <ModalContainer triggerLabel="View Live Logs">
      {/* Server Component rendered on server ahead of time, streamed into slot */}
      <ServerAuditLogFeed />
    </ModalContainer>
  );
}
```

### Recipe E: Next.js 16 Proxy Configuration (`apps/portal/proxy.ts`)

```ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Attach CSP nonce for inline scripts and styles
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
```

---

## 3. Verification & Quality Gates

Run the dedicated App Router and Server Actions auditor:

```bash
pnpm audit:routing
```

Or verify across the full compliance suite:

```bash
pnpm audit:compliance
```
