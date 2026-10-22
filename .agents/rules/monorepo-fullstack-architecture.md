---
name: monorepo-fullstack-architecture
description: 'Monorepo, Next.js App Router, and full-stack architecture standards: server-only boundaries, JIT exports, no barrel files, pnpm catalogs, server action endpoints, donut pattern, DAL React.cache, build-time env validation, minimal RSC serialization, and shared design tokens.'
paths:
  - 'apps/**/*'
  - 'packages/**/*'
  - 'libs/**/*'
alwaysApply: true
---

# Monorepo & Full-Stack Architecture Standards

These 10 production-grade architecture rules enforce strict boundaries, instant HMR, type-safe data access, and high-performance server/client boundaries across the monorepo.

---

## 1. Enforce `server-only` on Shared Database & Core Packages

In a monorepo, an accidental import of `@repo/database` or `@repo/supabase` inside a `'use client'` component leaks server logic, keys, or blows up the client bundle. Poison server modules so Next.js fails at compile time if a client component touches them.

### Anti-Pattern (Bad)

Exporting database clients, secret keys, or server utilities directly without compile-time client poisoning:

```typescript
// packages/database/src/index.ts
import { createClient } from '@supabase/supabase-js';
```

### Pattern (Good)

```typescript
// packages/database/src/index.ts
import 'server-only'; // Instant build error if imported in a Client Component
import { createClient } from '@supabase/supabase-js';
```

---

## 2. Use Just-in-Time (JIT) Exports Instead of tsconfig Path Hacks

Never use relative escape paths (`../../../packages/ui`) or root `tsconfig.json` path hacks to reach across packages—they bypass package boundaries, confuse tooling, and break bundler resolution. Export raw `.ts`/`.tsx` files via `package.json` `exports` and let Next.js / Turbopack compile them directly.

### Pattern (Good)

In `packages/ui/package.json`:

```json
{
  "name": "@repo/ui",
  "exports": {
    "./button": "./src/components/button.tsx",
    "./GlassCard": "./src/components/GlassCard.tsx"
  }
}
```

In `apps/portal/next.config.mjs`:

```typescript
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/contract', '@repo/theme'],
};
```

---

## 3. Ban Barrel Files (`index.ts`) in Shared UI Packages

Re-exporting dozens of heavy UI components in a single `packages/ui/src/index.ts` forces Next.js and dev bundlers to parse and evaluate the entire module graph on every route load, severely degrading dev server startup and HMR speeds.

### Anti-Pattern (Bad)

```typescript
import { Button, GlassCard, Modal } from '@repo/ui';
```

### Pattern (Good)

Import directly from the granular package export:

```typescript
import { Button } from '@repo/ui/Button';
import { GlassCard } from '@repo/ui/GlassCard';
```

---

## 4. Eliminate Dependency Drift with pnpm Catalogs

Discrepant versions of core packages (such as React `19.0.0` in `apps/portal` vs `19.1.0` in `packages/ui`) cause duplicate React instances, context disconnects, and cryptic hydration crashes. Define versions once in `pnpm-workspace.yaml` using Catalogs.

### Pattern (Good)

In `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
catalog:
  react: ^19.0.0
  typescript: ^5.8.0
  zod: ^3.24.0
```

In package manifests (`packages/ui/package.json`):

```json
"dependencies": {
  "react": "catalog:",
  "zod": "catalog:"
}
```

---

## 5. Treat Server Actions Like Public HTTP Endpoints (Validate & Return Tuples)

A `'use server'` action compiles down to a publicly exposed POST endpoint that anyone can trigger with `curl` or automated payloads. Never trust inputs just because TypeScript typed them, and never throw for expected validation or business errors (throwing triggers the global `error.tsx` boundary and wipes user form state).

### Anti-Pattern (Bad)

```typescript
'use server';
export async function updateLoad(loadId: string, weightTons: number) {
  if (weightTons <= 0) throw new Error('Invalid weight'); // Destroys form state
  await db.loads.update(loadId, { weightTons });
}
```

### Pattern (Good)

```typescript
'use server';

export async function updateLoad(rawInput: unknown): Promise<ActionResult<Load>> {
  const session = await verifySession(); // 1. Auth & role check inside the action
  const parsed = UpdateLoadSchema.safeParse(rawInput); // 2. Runtime Zod validation
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid payload' };
  }

  const updated = await db.loads.update(parsed.data);
  await updateTagInAction('dept:loads'); // 3. Invalidate cache tags
  return { status: 'success', payload: updated }; // 4. Return typed result union
}
```

---

## 6. Push `'use client'` to the Leaves (Use the Donut Pattern)

Never place `'use client'` at the root of a page or large layout shell simply to support an interactive widget or toggle. Keep the outer container a Server Component and inject Server Components into Client Components via `children`.

### Anti-Pattern (Bad)

Making `<DashboardShell>` a Client Component and importing heavy server data-tables inside it—this converts the entire subtree into client JavaScript.

### Pattern (Good)

```typescript
// Server Component (Page)
export default function DashboardPage() {
  return (
    <InteractiveSidebarWrapper> {/* "use client" leaf wrapper */}
      <HeavyServerTelemetryTable /> {/* Remains 100% Server Component */}
    </InteractiveSidebarWrapper>
  );
}
```

---

## 7. Deduplicate Server Queries with `React.cache()` in a Data Access Layer (DAL)

Never write raw database queries or direct fetches ad-hoc inside `page.tsx` or `layout.tsx`. Centralize lookups in a dedicated Data Access Layer (`libs/features/*/data-access`) wrapped in `React.cache()`. When `layout.tsx`, `generateMetadata`, and `page.tsx` all request the current operator or tenant, the query executes exactly once per request pass.

### Pattern (Good)

```typescript
// libs/features/auth/data-access/src/operator.ts
import 'server-only';
import { cache } from 'react';

export const getCurrentOperator = cache(async () => {
  const session = await getAuthSession();
  if (!session) return null;
  return db.operators.findUnique({ where: { id: session.userId } });
});
```

---

## 8. Validate Environment Variables at Build Time per Package (`t3-env`)

Ad-hoc references to raw `process.env.*` scattered across apps and packages cause runtime crashes in production when variables are omitted, and prevent Turborepo from properly caching builds.

- Ban unvalidated `process.env` references.
- Create a validated `env.ts` in each package/app using `@t3-oss/env-nextjs` (or Zod).
- Explicitly declare all environment variables in `turbo.json` under `globalEnv` or pipeline `env`.

---

## 9. Pass Only Minimal Primitives Across the RSC Serialization Boundary

Every prop passed from a Server Component to a `'use client'` component must be serialized across the network into the HTML stream and hydration payload. Passing large database rows bloats HTML size, delays time-to-interactive, and risks leaking sensitive internal columns.

### Anti-Pattern (Bad)

```tsx
<AuthorizeGateButton operatorRecord={fullDatabaseOperatorRow} />
```

### Pattern (Good)

```tsx
<AuthorizeGateButton isAuthorized={operator.isAuthorized} operatorId={operator.id} />
```

---

## 10. Share Design Tokens via Tailwind CSS Presets, Not Copy-Pasted Configs

In a multi-app monorepo, never duplicate color palettes, glassmorphism utilities, or typography scales across applications. Export design tokens and themes as a canonical shared entrypoint from `@repo/theme` or `@repo/tailwind-config`.

### Pattern (Good)

In `packages/theme/src/tokens/` or shared stylesheet:

```css
@import 'tailwindcss';
@theme {
  --color-brand-primary: oklch(0.65 0.18 250);
  --blur-glass: 16px;
}
```

In application `globals.css`:

```css
@import '@repo/theme/styles.css';
@source "../../../../packages/ui/src/**/*.{ts,tsx}";
```
