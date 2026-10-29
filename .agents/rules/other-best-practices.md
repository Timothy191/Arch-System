---
name: other-best-practices
description: Cross-cutting operational best practices covering security, CI/CD, accessibility, observability, infrastructure, and build optimization standards for Arch-System
paths:
  - 'apps/**/*'
  - 'packages/**/*'
  - 'libs/**/*'
alwaysApply: true
---

# Other Best Practices

These cross-cutting operational and quality standards apply across the entire Arch-System monorepo. They complement the domain-specific and technical rule files in this directory.

---

## 1. Security Best Practices

### Request Proxy & CSP

- **Proxy pipeline**: `proxy.ts` (Next 16) handles CSP + nonce, then server proxy handles auth claims, RBAC, Redis-cached authorization.
- **Nonce**: Generate per-request nonce for CSP headers.

### Secrets Management

- **Never** store secrets (tokens, keys, passwords) as literals in `mcp.json` or source code.
- **HTTP MCP servers**: Use `bearerTokenEnvVar: "ENV_NAME"` to reference environment variables.
- **`.env*` files**: Never commit; use `.env.example` templates.

### Database Security

- **RLS**: Row Level Security enabled on all tables; migrations must include RLS policies (zero-padded migration prefix, e.g., `NNN_description.sql`).
- **Service role**: Never expose `service_role` keys to client components; route through `@repo/supabase` typed clients.

### Input Validation

- **Zod schemas**: All input validation via canonical `@repo/contract` schemas (`*.schema.ts`).
- **SQL injection**: Kysely queries only; never raw SQL string concatenation.

---

## 2. CI/CD & Verification Gates

### Completion Gate

- **`pnpm agent:verify`**: 15 sequential steps (type-check → lint → test → policy:check → audit:drift → skill-spector → mcp:verify → token:budget-check → agent-rule-drift → codebase-map parity → audit:hooks → deps:lint → cycles → audit:tailwind → knip).

### PR Requirements

- **Pre-push hook**: Runs full 15-step `agent:verify` gate before push.
- **`pnpm quality`**: Release-grade suite (lint → type-check → test → … → verify:gates).

### CI Pipelines

- **E2E**: Playwright (`e2e/`) — chromium, mobile-chrome, tablet-chrome projects; auto-starts dev server unless `BASE_URL` set.
- **Migration**: `pnpm lint:migrations` (Squawk + new-table RLS check).

---

## 3. Accessibility Standards

### UI Components

- **Light mode only**: Canvas `#f3f4f6`; semantic OKLCH tokens from `@repo/theme`; no `dark:` variants or raw hex/rgb.
- **Glass surfaces**: Use `@repo/ui/GlassCard` with allowed variants (`default | window | spotlight | glowborder | liquid`).

### Testing

- **Storybook + axe**: `packages/ui/.storybook/`; `pnpm --filter @repo/ui test-storybook:a11y`.
- **Playwright**: `e2e/accessibility.spec.ts`, `e2e/visual/accessibility.spec.ts`.
- **Visual regression**: Allow `maxDiffPixelRatio: 0.02`.

### Component Requirements

- Images: `next/image` with explicit `width`/`height` or `fill` + sized parent; descriptive `alt`.

---

## 4. Observability & Monitoring

### Logging

- **Structured logging**: `@repo/logger` (Pino) for server/browser/next — structured JSON output.

### Telemetry & Live Updates

- **Supabase Realtime CDC**: Via `useSupabaseRealtime` — no manual polling.
- **Offline**: `useOfflineQueue` for intermittent network tolerance.

### Metrics

- **Performance budgets**: Bundle size ≤ 1.0 MB; monitor via Lighthouse, Web Vitals.
- **Cost monitoring**: `config/cost-monitoring.json`, anomaly detection configs.

---

## 5. Infrastructure & Deployment

### Local Infrastructure

- **Supabase**: Local instances via CLI; migrations in `packages/database/migrations/`.
- **Redis**: Multi-tier caching (L1/L2) with scoped tags.

### Deployment

- **Vercel**: Deploy via `pnpm --filter portal deploy` or `vercel deploy` through the deployment flow.
- **Docker**: Local dev containers via `infra/docker/`.
- **Kubernetes**: Production K8s manifests via `infra/k8s/` (ArgoCD).

### Environments

- **Env files**: `Arch-System/.env`, `Arch-System/apps/portal/.env`, `Arch-System/.env.tools`.
- **Env validation**: Zod/t3-env for server-side configuration.

---

## 6. Build & Performance Optimization

### Build Pipeline

- **Turborepo**: Task runner with build caching; `turbo.json` orchestrates.
- **Asset sync**: `sync-assets-smart.cjs` before builds; patch-glass-css.mjs after.
- **Codegen**: `pnpm --filter @repo/theme codegen` after token edits.

### Caching

- **Dual-tier cache**: Next.js Data Cache (`cachedRSC`) + Redis L1/L2 with scoped tags.
- **Invalidation**: `updateTagInAction` before redirect in Server Actions.

### Performance

- **Parallelize**: Independent queries via `Promise.allSettled` / `Promise.all`.
- **Cache**: Wrap shared per-request lookups in `React.cache()`.
- **Stream**: Stream unresolved promises into Suspense boundaries.

---

## 7. Cross-Cutting Quality Checks

### Formatting & Linting

- **Biome**: 2-space indent, 100 columns, single quotes in TS/JS, double quotes in JSX, semicolons required, ES5 trailing commas.
- **Prettier**: owns `*.md`, `*.css`, `*.scss`, `*.yaml`, `*.yml`.
- **Stylelint**: owns CSS/SCSS.

### Architecture Boundaries

- **Layering rules** (machine-enforced via `tools/repo/policy-compiler.cjs`):

| Source                  | Forbidden target                         | Why                                 |
| ----------------------- | ---------------------------------------- | ----------------------------------- |
| `apps/*`                | `packages/database`                      | Route through `@repo/supabase`      |
| `packages/ui`           | `packages/database`, `packages/supabase` | UI is pure presentation             |
| `packages/theme`        | `packages/ui`                            | Theme consumed by UI, never reverse |
| `packages/*`, `tools/*` | `apps/*`                                 | No dependency inversion             |
| `tools/*`               | `packages/supabase`                      | Build-time only                     |

### Hard Invariants

- **Light mode only**: canvas `#f3f4f6`; semantic OKLCH tokens; no dark mode.
- **Zero circular deps**: `pnpm cycles` over apps/packages/libs.
- **Zero dead code**: `pnpm knip`.
- **Strict TypeScript**: no `any`, no `@ts-ignore`.

---

## 8. Enforcement & Compliance

### Reporting

- **Violation**: Code violating these rules must be fixed before merge.
- **Audit**: `pnpm audit:compliance` runs full static invariant sweep.

### Verification Checklist

Before completing any task:

1. `pnpm type-check` — strict TS compliance
2. `pnpm lint` — Biome formatting/lint
3. `pnpm policy:check` — architecture boundaries
4. `pnpm audit:drift` — contract/DB/API parity
5. `pnpm agent:verify` — full completion gate

---

## 9. Summary

These best practices ensure consistency across all agents and developers working on Arch-System:

- **Consistent naming** → predictable codebases
- **Robust error handling** → operational safety
- **Clear state management** → maintainable UI
- **Clean architecture** → testable layers
- **Security-first** → protected data
- **Verified quality** → reliable releases
- **Performance budgets** → sustainable velocity
