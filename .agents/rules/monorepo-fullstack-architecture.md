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

1. **Enforce `server-only` on Shared Database & Core Packages**: Add `import 'server-only';` to server modules (`packages/database/src/index.ts`, `@repo/supabase/server`) so importing them in `'use client'` fails at build time.
2. **Use Just-in-Time (JIT) Exports**: Export `.ts`/`.tsx` entrypoints via `package.json` `exports` (`"./GlassCard": "./src/components/GlassCard.tsx"`) and list workspace libraries in `transpilePackages` in `apps/portal/next.config.mjs`. Never use `../../../packages/ui` escape paths.
3. **Ban Barrel Files (`index.ts`) in Shared UI Packages**: Always import directly from granular package exports (`import { GlassCard } from '@repo/ui/GlassCard'`, never `from '@repo/ui'`).
4. **Eliminate Dependency Drift (`pnpm deps:lint`)**: Define shared versions in `pnpm-workspace.yaml` Catalogs (`"react": "catalog:"`) and enforce workspace-wide semver alignment with `syncpack` (`config/tools/.syncpackrc.js`).
5. **Treat Server Actions Like Public HTTP Endpoints**: Enforce **authenticate → authorize → validate (`@repo/contract` Zod) → rate-limit → mutate → invalidate cache (`updateTagInAction`) → `redirect()` / return**. Never call `redirect()` before cache invalidation, and map failures through `@repo/errors`.
6. **Push `'use client'` to the Leaves (Donut Pattern)**: Keep outer route/layout containers as Server Components and pass Server Components into leaf Client Components via `children`.
7. **Deduplicate Server Queries with `React.cache()`**: Centralize server lookups in `libs/features/*/data-access` wrapped in `React.cache()` so `layout.tsx`, `generateMetadata`, and `page.tsx` share a single round-trip per request.
8. **Validate Environment Variables & Turborepo Task Inputs**: Validate env vars via Zod/`@t3-oss/env-nextjs`; declare build-affecting env vars in `turbo.json` and exclude `!**/*.test.*`, `!**/*.spec.*`, `!**/*.stories.*`, `!**/*AGENT_TRACER.md` from `build` `inputs`.
9. **Pass Only Minimal Primitives Across the RSC Boundary**: Never serialize full DB rows into `'use client'` props.
10. **Share Design Tokens via `@repo/theme` Presets**: Export OKLCH design tokens from `packages/theme/src/tokens/` and consume `@import '@repo/theme/styles.css'`.
11. **Machine-Enforced Layering & Zero Circular Dependencies (`policy-compiler.cjs` & `pnpm cycles`)**:
    - `apps/*` never imports `packages/database` directly (use `@repo/supabase`).
    - `packages/ui` never imports `packages/database` or `packages/supabase`.
    - `packages/theme` never imports `packages/ui`.
    - `packages/*` and `tools/*` never import `apps/*`; `tools/*` never imports `packages/supabase`.
    - Zero circular dependencies across `apps/`, `packages/`, and `libs/` enforced by `.dependency-cruiser.cjs` (`pnpm cycles`).
12. **Zero Dead-Code & Unresolved Imports (`pnpm knip`)**: Enforced via `knip --config config/tools/knip.json --no-config-hints`. Remove orphaned files and unused exports rather than expanding `ignore` lists.
13. **Defense-in-Depth Security Guardrails**:
    - `apps/portal/proxy.ts` → `server/proxy.ts`: Per-request `x-nonce`, CSP headers, Supabase auth claims, and Redis-cached RBAC (`arch:auth:employee:${userId}`).
    - `tools/audits/enforce-security-checks.cjs` (`pnpm policy:check`): Blocks `eval()`, string-concatenated SQL, `DISABLE ROW LEVEL SECURITY`, hardcoded secrets, mutable `search_path`, and un-schemed extensions.
    - `tools/audits/audit-hooks-and-clients.cjs` (`pnpm audit:hooks`): Blocks `swr`, enforces SSR hydration guards in `libs/shared/hooks`, and verifies `vercel-preflight.cjs`.
    - Strict `AppError` sanitization (`@repo/errors`, `isAppError`): Never leak raw DB errors or service-role keys to clients.
