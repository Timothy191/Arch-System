---
name: other-best-practices
description: Cross-cutting operational best practices covering security, CI/CD, accessibility, observability, infrastructure, and build optimization
paths:
  - 'apps/**/*'
  - 'packages/**/*'
  - 'libs/**/*'
alwaysApply: true
---

# Operational & Quality Best Practices

1. **Security & DB**: Per-request CSP nonce in `proxy.ts`, RLS on all tables, Kysely/parameterized queries only, `@repo/contract` Zod validation, and `service_role` isolated to server modules.
2. **UI & Accessibility**: Strictly light mode (`#f3f4f6`, `@repo/theme` OKLCH tokens, no `dark:`), `@repo/ui/GlassCard` variants, `next/image` with explicit dimensions + `alt`, Storybook axe + Playwright a11y verified.
3. **Observability & Infra**: Structured Pino logging (`@repo/logger`), Supabase Realtime CDC (`useSupabaseRealtime`), offline queue (`useOfflineQueue`), Dual-Tier Next + Redis L1/L2 cache.
4. **Verification Gate**: All changes must pass `pnpm agent:verify` (type-check, lint, test, policy:check, audit:drift, mcp:verify, token:budget-check, cycles, audit:tailwind, knip).
