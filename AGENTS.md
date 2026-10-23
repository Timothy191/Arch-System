# AGENTS.md — Arch-System

Scope: this repository only. `CLAUDE.md` here is a symlink to this file, so edits here are the edits.
`../AGENTS.md` holds workspace-wide notes plus a longer synthesis of Arch-System guidance; this file wins for anything under `Arch-System/`.

## 0. Bootstrap (run before anything else)

`node` resolves to `/usr/bin/node` (**v26.8.1**) and `pnpm` through `~/.local/share/mise/shims/pnpm` (**9.15.9**, pinned by `packageManager`). Do not reinstall the toolchain. If a non-login shell lacks `pnpm`, prepend the intact mise installs:

```bash
export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH"
pnpm -v   # 9.15.9
```

The 24.15.0 tree supplies `node`/`npm`/`npx`; the 26.8.1 tree supplies `pnpm` (plus `tsc`, `lighthouse`, `vercel`, `repomix`). Other pnpm majors can hang Turborepo, so rely on the pinned 9.15.9.

## 1. Layout

Turborepo + pnpm workspaces (`apps/*`, `packages/*`, `libs/features/*/*`, `libs/shared/*`, `tools/*`, `scripts`).

- `apps/portal` — the only app. Next.js 16 App Router, React 19, port 3000 (`0.0.0.0`), package name is **`portal`** (not `@repo/portal`).
- `libs/features/{auth,departments,hub}/{ui,data-access,utils}` and `libs/shared/{data-access,hooks,utils}` — published as `@repo/<feature>/<layer>`.
- `packages/{ui,theme,contract,supabase,database,redis,errors,logger,rate-limiter,agents,eval,utils,typescript-config}`; `tools/{repo,audits,scripts}` are build-time only; `e2e/` Playwright.
- `apps/portal/proxy.ts` → `server/proxy.ts` gates routes (`DEPARTMENT_ROUTES`, `RESTRICTED_ROUTES`) and refreshes Supabase JWT + Redis-cached RBAC.
- Migrations: `packages/database/migrations/NNN_description.sql` (`packages/supabase/migrations` is a symlink — never write there). **Never rename or renumber an applied migration** (`supabase_migrations.schema_migrations` keys on prefix; `0145_`/`0146_` are deliberate 4-digit outliers).
- DB/contract parity is a gate: new tables/columns need a Zod schema in `packages/contract/src/schemas/` or `pnpm audit:drift` fails.

## 2. Commands that are easy to get wrong

```bash
pnpm --filter portal test -- components/CommandBar.test.tsx   # single file (jest path substring)
pnpm --filter portal type-check                                # one workspace
pnpm test                                                      # turbo: every package that defines "test"
pnpm --filter @repo/database test                              # migration rollback/RLS checks only
pnpm --filter @repo/database db:types                          # regenerate Supabase types
pnpm --filter @repo/theme codegen                              # after editing tokens.json (output is committed)
pnpm --filter @repo/ui storybook                               # port 6006, needed by test:a11y
```

- `pnpm test` is `turbo run test`; packages with no `test`/`lint` script are silently skipped, and `@repo/database`'s `test` runs Node scripts (migration drift, rollback safety, RLS), not Jest.
- `pnpm test:e2e` auto-starts `pnpm --filter portal dev` on :3000 unless `BASE_URL` is set (`TEST_EMAIL`/`TEST_PASSWORD` override `e2e/helpers/credentials.ts`) and caches `e2e/.auth/user.json` for 30 min.
- `pnpm dev` → `scripts/dev-system-reimagined.sh`; `pnpm dev:quick` is headless; `pnpm dev:turbo` is portal-only. `make verify`/`make pipeline` live in `../Makefile`.

## 3. Verification

`pnpm agent:verify` (`tools/scripts/agent-verify.sh`) is the 15-step completion gate:
type-check → lint → test → policy:check → audit:drift → skill-spector → mcp:verify → token:budget-check → rule-drift → maps parity → audit:hooks → deps:lint → cycles → audit:tailwind → knip.

Gates: `pnpm lint:migrations` (Squawk + RLS on changed files; `--all` audits all) and `pnpm cycles` (dependency-cruiser `no-circular`) run in `lint-staged`, CI, and `agent:verify`. RLS exemptions need `-- rls-exempt-table <t>: <why>`.

Non-obvious fixes: rule-drift ⇒ sync `../.agents/rules/`; maps parity ⇒ `pnpm maps:sync`; token:budget-check ⇒ `pnpm context:debloat`; policy:check ⇒ `pnpm policy:gen` (`config/tools/eslint.boundaries.cjs` is generated); audit:tailwind ⇒ extract repeated/over-budget chain into a component/CVA/`cn()` constant.

## 4. Hard invariants

- **Light mode only.** Canvas `#f3f4f6`; use semantic OKLCH tokens from `@repo/theme`. No `dark:` variants (`pnpm audit:tokens`).
- Glass surfaces use `@repo/ui/GlassCard` (`default` | `window` | `spotlight` | `glowborder` | `liquid`).
- Tailwind utility chains: ≤16 utilities per element (`pnpm audit:tailwind`); **canonical class order** enforced via Biome `nursery/useSortedClasses` (`"level": "error"`, `"fix": "safe"`) across `className`, `classList`, `cn()`, `clsx()`, `cva()`, and `twMerge()`; **minimal CSS build purge** enforced in `packages/theme/src/tailwind/preset.ts` (`.tsx`-only UI source globs, explicit negative exclusions, `future.hoverOnlyWhenSupported: true`, verified by `pnpm audit:tailwind`).
- Boundaries: `apps/*` → no `packages/database` (use `@repo/supabase`); `packages/ui` → no db/supabase; `packages/theme` → no `packages/ui`; `packages/*` & `tools/*` → no `apps/*`. Import via canonical exports (`@repo/ui/GlassCard`).
- Server Components by default; `'use client'` at leaves; no client fetching; `@tanstack/react-query` only (no SWR). Strict TS (no `any`/`@ts-ignore`). Conventional commits; never print/commit `.env*`.

## 5. Next.js 16 specifics

- **Do not trust training data for Next APIs.** Read `node_modules/next/dist/docs/` before writing route/cache/proxy code.
- `apps/portal/proxy.ts` replaces `middleware.ts` (Next 16) and also injects the CSP/nonce headers; route gating + auth delegation stays in `server/proxy.ts`.
- `apps/portal/AGENTS.md` holds a `nextjs-agent-rules` block that `next dev` regenerates — deleting it just recreates it uncommitted; keep it.
- `cacheComponents: true`; dev runs **webpack** (`next dev --webpack`) while `next build` uses Turbopack. `output: 'standalone'` unless `VERCEL`. `images.unoptimized: true`. `/` redirects to `/hub`.
- Server-side caching SSoT is `apps/portal/lib/server-cache.ts`: `cacheProfiles` (telemetry/departments/reports/minutes/…), `scopedTag`/`tagTenant`/`tagDepartment`, and `updateTag()` which clears Next's data cache **and** Redis L1/L2. Mutations in `actions.ts` pair `cacheInvalidateTags([...])` with `revalidatePath()`.
- **Redis has one door.** Every Redis touch goes through a named capability in `@repo/redis` — caching (`cache.ts`/`invalidation.ts`), authorization sessions (`session.ts`; revocation is `bumpPrivilegeVersion`), streams + consumer groups (`streams.ts`), locks + idempotency (`locks.ts`), analytics (`analytics.ts`), vector search with a pgvector fallback (`search.ts`) — all on the transport façade `raw.ts` (`send`/`sendSafe` + `detectCapabilities`). No inline `SET NX` or `GET`→`SET` in apps, and never assume a socket: serverless REST cannot block, subscribe, or run modules. Contract: `.agents/rules/redis-capabilities.md`; real-server behaviour: `REDIS_INTEGRATION=1 pnpm --filter @repo/redis test:integration` (CI job `redis-integration`, alongside the portal suite).
- `SKIP_TYPE_CHECK=true` only works locally (blocked when `CI=true`) — never use it to make a build pass.

## 6. Tests

Jest 30 + `@swc/jest`; co-located `*.test.ts(x)`; run with `--runInBand`. `apps/portal/setupTests.ts` globally mocks `next/cache` and `@repo/redis`; `jest.config.cjs` maps `@repo/*` straight to `src/`, so no package build is required. Portal coverage thresholds are 40 statements / 27 branches / 28 functions / 40 lines — adding untested code can fail `test:coverage`.

## 7. Reference map

- `.agents/GUIDE.md` — provider-neutral operations guide (note: it still claims Node ≥22; `engines` says ≥24).
- `docs/agents/{architecture,commands,invariants,patterns,testing,jest-diagnostics}.md` — deep reference; some entries predate current scripts, verify against `package.json`.
- `.agents/rules/` (canonical, mirrored to `../.agents/rules/`), `.cursor/rules/*.mdc`, `apps/portal/AGENTS.md`.
- `codemap` MCP tools index this repo (fresh as of `HEAD`) — prefer symbol/graph queries over grepping large trees. The `code-index` server has a stale, empty index for this repo; don't trust it.
