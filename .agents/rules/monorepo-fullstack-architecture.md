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

1. **`server-only`**: `import 'server-only';` in server modules (`packages/database/src/index.ts`, `@repo/supabase/server`) so `'use client'` imports fail at build.
2. **JIT exports**: `.ts`/`.tsx` entrypoints via `package.json` `exports` (`"./GlassCard": "./src/components/GlassCard.tsx"`); list libs in `transpilePackages` (`apps/portal/next.config.mjs`). Never `../../../packages/ui` paths.
3. **No barrel files in shared UI**: `import { GlassCard } from '@repo/ui/GlassCard'`, never `from '@repo/ui'`.
4. **No dependency drift (`pnpm deps:lint`)**: `pnpm-workspace.yaml` Catalogs (`"react": "catalog:"`) + `syncpack` (`config/tools/.syncpackrc.js`).
5. **Server Actions = public HTTP endpoints**: authenticate → authorize → validate (`@repo/contract` Zod) → rate-limit → mutate → invalidate (`updateTagInAction`) → `redirect()`/return. Never `redirect()` before invalidation; map failures via `@repo/errors`.
6. **Donut pattern**: outer route/layout = Server Components; pass Server Components into leaf Client Components via `children`.
7. **`React.cache()` DAL**: server lookups in `libs/features/*/data-access` so `layout.tsx`, `generateMetadata`, `page.tsx` share one round-trip.
8. **Env & Turbo inputs**: validate env via Zod/`@t3-oss/env-nextjs`; declare build-affecting env in `turbo.json`; exclude `!**/*.test.*`, `!**/*.spec.*`, `!**/*.stories.*`, `!**/*AGENT_TRACER.md` from `build` `inputs`.
9. **Minimal RSC props**: never serialize full DB rows into `'use client'` props.
10. **Tokens**: OKLCH tokens from `packages/theme/src/tokens/`; consume `@import '@repo/theme/styles.css'`.
11. **Layering (`policy-compiler.cjs`) & zero cycles (`pnpm cycles`, `.dependency-cruiser.cjs`)**:
    - `apps/*` ↛ `packages/database` (use `@repo/supabase`); `packages/ui` ↛ `packages/database`/`packages/supabase`; `packages/theme` ↛ `packages/ui`.
    - `packages/*`, `tools/*` ↛ `apps/*`; `tools/*` ↛ `packages/supabase`.
    - Zero circular deps across `apps/`, `packages/`, `libs/`.
12. **Zero dead code (`pnpm knip`)**: `knip --config config/tools/knip.json --no-config-hints`. Remove orphans/unused exports rather than expanding `ignore`.
13. **Security guardrails**:
    - `apps/portal/proxy.ts` → `server/proxy.ts`: per-request `x-nonce`, CSP, Supabase auth claims, Redis-cached RBAC (`arch:auth:employee:${userId}`).
    - `tools/audits/enforce-security-checks.cjs` (`pnpm policy:check`): blocks `eval()`, string-concatenated SQL, `DISABLE ROW LEVEL SECURITY`, hardcoded secrets, mutable `search_path`, un-schemed extensions.
    - `tools/audits/audit-hooks-and-clients.cjs` (`pnpm audit:hooks`): blocks `swr`, enforces SSR hydration guards in `libs/shared/hooks`, verifies `vercel-preflight.cjs`.
    - `AppError` sanitization (`@repo/errors`, `isAppError`): never leak raw DB errors or service-role keys to clients.
