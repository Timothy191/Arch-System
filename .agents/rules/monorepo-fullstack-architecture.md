---
name: monorepo-fullstack-architecture
description: 'Turborepo monorepo, Next.js 16 App Router, Knip dead-code, and defense-in-depth security standards: machine-enforced layering (policy-compiler.cjs, dependency-cruiser, syncpack), server-only boundaries, JIT exports, no barrel files, server action endpoints, donut pattern, DAL React.cache, Knip hygiene, and CSP/AppError security guardrails.'
paths:
  - 'apps/**/*'
  - 'packages/**/*'
  - 'libs/**/*'
  - 'tools/**/*'
  - 'config/tools/**/*'
alwaysApply: true
---

# Monorepo & Full-Stack Architecture Standards

These 13 production-grade architecture rules enforce strict boundaries, zero circular or dead code, instant HMR, type-safe data access, and defense-in-depth security across the Turborepo monorepo.

---

## 1. Enforce `server-only` on Shared Database & Core Packages

Importing `@repo/database` or `@repo/supabase` server clients inside a `'use client'` component leaks server logic and credentials. Poison server modules so Next.js fails at compile time:

```typescript
// packages/database/src/index.ts
import 'server-only'; // Instant build error if imported in a Client Component
import { createClient } from '@supabase/supabase-js';
```

---

## 2. Use Just-in-Time (JIT) Exports Instead of tsconfig Path Hacks

Never use relative escape paths (`../../../packages/ui`) or root `tsconfig.json` path hacks across packages. Export `.ts`/`.tsx` entrypoints via `package.json` `exports` and list workspace libraries in `transpilePackages`:

```json
{
  "name": "@repo/ui",
  "exports": {
    "./button": "./src/components/button.tsx",
    "./GlassCard": "./src/components/GlassCard.tsx"
  }
}
```

```typescript
// apps/portal/next.config.mjs
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/contract', '@repo/theme'],
};
```

---

## 3. Ban Barrel Files (`index.ts`) in Shared UI Packages

Re-exporting dozens of UI components in a single barrel file forces bundlers to parse the entire module graph on every route load. Always import directly from granular package exports (`import { GlassCard } from '@repo/ui/GlassCard'`, never `from '@repo/ui'`).

---

## 4. Eliminate Dependency Drift with pnpm Catalogs & `syncpack` (`pnpm deps:lint`)

Define shared versions once in `pnpm-workspace.yaml` Catalogs (`"react": "catalog:"`) and enforce workspace-wide semver alignment with `syncpack` (`config/tools/.syncpackrc.js`, Step 12 of `pnpm agent:verify`), which pins `apps/*` and root devDependencies, enforces `^` on `packages/*` peerDependencies, locks Next.js packages in lockstep, and requires single versions (`highestSemver`) across the workspace.

---

## 5. Treat Server Actions Like Public HTTP Endpoints (Validate, Authorize & Sanitize)

A `'use server'` action compiles to a public POST endpoint. Enforce the canonical pipeline: **authenticate → authorize → validate (`@repo/contract` Zod) → rate-limit → mutate → invalidate cache (`updateTagInAction`) → `redirect()` / return**. Never call `redirect()` before cache invalidation, and map failures through `@repo/errors` (`AppError`, `ValidationError`, `AuthError`, `ForbiddenError`, `RateLimitError`).

```typescript
'use server';

export async function updateLoad(rawInput: unknown): Promise<ActionResult<Load>> {
  const session = await verifySession(); // 1. Auth & role check
  const parsed = UpdateLoadSchema.safeParse(rawInput); // 2. Runtime @repo/contract Zod validation
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid payload' };
  }
  const updated = await db.loads.update(parsed.data);
  await updateTagInAction('dept:loads'); // 3. Invalidate Next + Redis L1/L2 cache before redirect/return
  return { status: 'success', payload: updated };
}
```

---

## 6. Push `'use client'` to the Leaves (Use the Donut Pattern)

Never place `'use client'` at the root of a page or layout shell. Keep the outer container a Server Component and pass Server Components into leaf Client Components via `children`:

```typescript
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

Centralize server lookups in `libs/features/*/data-access` wrapped in `React.cache()` so `layout.tsx`, `generateMetadata`, and `page.tsx` share a single round-trip per request pass:

```typescript
// libs/features/auth/data-access/src/operator.ts
import 'server-only';
import { cache } from 'react';

export const getCurrentOperator = cache(async () => {
  const session = await getAuthSession();
  return session ? db.operators.findUnique({ where: { id: session.userId } }) : null;
});
```

---

## 8. Validate Environment Variables & Turborepo Task Inputs (`turbo.json`)

- Ban unvalidated `process.env` references; validate environment variables via `@t3-oss/env-nextjs` or Zod.
- Declare build-affecting env vars in `turbo.json` (`globalEnv`, task `env`, `globalPassThroughEnv`), and exclude test/story files (`!**/*.test.*`, `!**/*.spec.*`, `!**/*.stories.*`) from `build` `inputs` so test edits never bust production build caches.

---

## 9. Pass Only Minimal Primitives Across the RSC Serialization Boundary

Never serialize full database rows into `'use client'` props. Pass only minimal primitives (`<AuthorizeGateButton isAuthorized={operator.isAuthorized} operatorId={operator.id} />`).

---

## 10. Share Design Tokens via `@repo/theme` Presets

Never duplicate color palettes or glass utilities across apps. Export OKLCH design tokens from `@repo/theme` (`packages/theme/src/tokens/`) and consume `@import '@repo/theme/styles.css'` in application stylesheets.

---

## 11. Machine-Enforced Layering & Zero Circular Dependencies (`policy-compiler.cjs` & `pnpm cycles`)

`tools/repo/policy-compiler.cjs` is the SSoT for architectural boundaries (`pnpm policy:gen` to compile, `pnpm policy:check` in Step 4 of `pnpm agent:verify`), generating `tools/repo/policy/{dependency.rules,architecture.rules,security.checks,intent-map}.json` and `tools/repo/policy/eslint-boundaries.generated.cjs`:

- `apps/*` (`scope:app`) never imports `packages/database` (`scope:package:db-internal`) directly; always use `@repo/supabase`.
- `packages/ui` (`scope:package:ui`) is pure presentation; never imports `packages/database` or `packages/supabase` (data access lives in `libs/features/*/data-access`).
- `packages/theme` (`scope:package:theme`) never imports `packages/ui` (theme is consumed by UI, never the reverse).
- `packages/*` (`scope:package`) and `tools/*` (`scope:tool`) never import `apps/*` (`scope:app`), and `tools/*` never imports runtime `packages/supabase`.
- **Zero Circular Dependencies (`pnpm cycles`)**: File- and package-level import cycles across `apps/`, `packages/`, and `libs/` are blocked by `dependency-cruiser` (`.dependency-cruiser.cjs`, Step 13 of `pnpm agent:verify`).

---

## 12. Zero Dead-Code & Unresolved Imports (`pnpm knip`)

Enforced as Step 15 of `pnpm agent:verify` and in `pnpm quality` via `knip --config config/tools/knip.json --no-config-hints`. Every workspace (`apps/portal`, `packages/*`) maintains explicit `entry` and `project` globs in `config/tools/knip.json`; remove orphaned files, unused exports, and unresolved imports rather than expanding `ignore` lists.

---

## 13. Defense-in-Depth Security Guardrails (`proxy.ts`, `enforce-security-checks.cjs`, `audit:hooks`)

- **Edge Proxy & CSP (`apps/portal/proxy.ts` → `server/proxy.ts`)**: Generates a per-request cryptographic `x-nonce` and `Content-Security-Policy` (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`), while `server/proxy.ts` verifies Supabase auth claims and Redis-cached RBAC/department gating (`arch:auth:employee:${userId}`).
- **Static Security Policy Enforcer (`tools/audits/enforce-security-checks.cjs`)**: Run via `pnpm policy:check` (`--ci`), blocking `eval()` / `new Function()` (`no-eval`), string-concatenated SQL (`no-sql-concat`), `DISABLE ROW LEVEL SECURITY` in migrations (`no-raw-rls-disable`), hardcoded secrets (`sk-*`, `ghp_*`, `AKIA*` via `no-hardcoded-secrets`), mutable PL/pgSQL `search_path` (`no-mutable-search-path`), and un-schemed extensions (`require-extension-schema`).
- **Client Hook & Query Guard (`tools/audits/audit-hooks-and-clients.cjs`)**: Run via `pnpm audit:hooks` (Step 11 of `pnpm agent:verify`), blocking `swr` and non-Jest runners (`ava`, `mocha`, `tape`), enforcing SSR hydration guards (`typeof window !== 'undefined'` or `useEffect`) in `libs/shared/hooks`, and verifying `tools/scripts/vercel-preflight.cjs`.
- **Strict `AppError` Sanitization**: All domain/runtime errors extend `AppError` (`@repo/errors`, `isAppError`); never leak raw DB errors, service-role keys, or server-only modules to client components.
