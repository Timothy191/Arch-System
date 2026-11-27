# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

Arch-System (Plantcor / Arch OS) is a production industrial mining portal: multi-department dashboards, live SCADA telemetry, shift closeout, and audit-logged RBAC. Next.js 16 App Router + React 19 monorepo, Turborepo, cloud Supabase (Postgres 17), Redis (local TCP in dev, Upstash REST in production), deployed to the Vercel project `arch-system`.

## Toolchain

- Node 24 and pnpm 9.15.9 only (`mise.toml`, `.node-version`, `packageManager`, `engine-strict=true`). Run every command from this repo root.
- If `pnpm` is missing from `PATH`: `export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:$HOME/.cargo/bin:$PATH"`.
- `pnpm dev:quick` starts the portal headless against cloud Supabase without Docker; `pnpm dev` also brings up local Redis and RedisInsight.

## Commands

`type-check`, `lint`, `test`, and `build` work as expected. These do not:

| Command                                          | Purpose                                                                                                                                              |
| :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm agent:start` / `pnpm agent:finish`         | Branch off `main` and open the `[ ]` checklist, then verify + commit + `--ff-only` merge. See `.agents/rules/universal-agent-workflow.md`.           |
| `pnpm agent:verify` (`:fast`)                    | Fail-fast gate suite (27 in the last recorded run; the count is dynamic). Writes `.ci-local/agent-verify-evidence.json`; `--fast` skips gates 16–23. |
| `pnpm policy:check`                              | Machine-enforced dependency boundaries plus the security registry. Run `pnpm policy:gen` after editing `tools/repo/policy/`.                         |
| `pnpm audit:drift`                               | Zod contract ↔ database parity.                                                                                                                      |
| `pnpm audit:compliance`                          | Static invariant sweep (tokens, RSC, caching, RLS, hooks, agents).                                                                                   |
| `pnpm ci:reindex && pnpm ci:snapshot`            | Rebuild the CodeGraph index, then snapshot it. This order, before `pnpm audit:code-intelligence`.                                                    |
| `pnpm test:coverage:changed`                     | ≥70% lines and statements on changed portal runtime files versus `origin/main`.                                                                      |
| `pnpm lint:migrations` / `pnpm db:migrate:check` | Squawk + RLS lint; migration drift and rollback checks.                                                                                              |
| `pnpm test:redis:integration`                    | Live TCP suites; run `pnpm redis:up` first.                                                                                                          |
| `pnpm token:budget-check`                        | Instruction-file byte ceiling (40 KB across AGENTS/GEMINI/CLAUDE and peers).                                                                         |
| `pnpm mcp:verify`                                | Validates `.mcp.json`.                                                                                                                               |
| `pnpm env:check`                                 | Validates `apps/portal/.env` against `libs/shared/utils/src/env.ts`.                                                                                 |

Single portal test: `pnpm --filter portal test -- --testPathPatterns="name"`. Jest 30 takes the plural `--testPathPatterns`; the singular form silently matches nothing.

Environment gates: `RUN_LIVE_E2E=1` enables live E2E inside `agent:verify`; `CODEGRAPH_STRICT=1` makes a missing CodeGraph index fail hard; `FORCE_AGENT_VERIFY=1` bypasses the pre-push evidence cache.

## Invariants enforced by gates

- **Light mode only.** Semantic OKLCH tokens from `@repo/theme`; no `dark:` utilities and no raw hex or rgb values (`pnpm audit:tokens`).
- **Glass surfaces.** Panels, forms, and floating bars use `@repo/ui/GlassCard` with the branding classes from `packages/theme/src/tokens/glass.ts`: `liquid-glass-light gold-steel-border gold-steel-border-slim border border-white/25 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md`.
- **Tailwind budget.** At most 20 utilities per element (`pnpm audit:tailwind`); extract repeated chains into CVA variants or `cn()` constants.
- **CSS budget.** Raw CSS under `packages/{theme,ui}/src` stays ≤115 KB (`pnpm lint:css-perf`; gate 19). Re-run it after your final CSS edit.
- **RLS.** Every `public` table enables RLS against `(SELECT auth.uid())` and `public.employees`.
- **Boundaries.** `apps/*` never import `packages/database`; `packages/ui` never imports database or Supabase; `packages/theme` never imports `packages/ui`; `tools/*` never import apps or `@repo/supabase`; packages and libs never import apps.
- **Generated files.** `protect-paths.sh` blocks hand-edits of `*.generated.*`, theme `variables-generated.css` / `tokens/generated.ts` / `generated-sd.ts`, `packages/supabase/src/database.types.ts`, `packages/supabase/migrations/*` (edit `packages/database/migrations/`), `codebase-maps/latest/*`, `config/tools/eslint.boundaries.cjs`, `tools/scripts/ci-{reindex,snapshot}.cjs`, and `.agents/memory_base/index-snapshot.json`. Change the source and regenerate.

## Resources

Use the full surface: CodeGraph (`codemap`) for structure, skills via the Skill tool, `memory-gateway-mcp` for recall, subagents for parallel exploration, and a real browser for UI verification. `.agents/rules/universal-agent-workflow.md` defines the per-change verification floor.

## Gotchas

- **Next 16 differs from training data.** Read `node_modules/next/dist/docs/` (`cacheTag`, `revalidateTag`, `updateTag`, `cacheLife`) before writing cache or Server Action code.
- **Jest `moduleNameMapper` is insertion-ordered.** A new `@repo/*` subpath without an explicit entry in `apps/portal/jest.config.cjs` (and `tsconfig.base.json`) resolves to the wrong path instead of erroring.
- **`apps/portal/AGENTS.md` is generated by `next dev`.** Leave its `nextjs-agent-rules` block alone.
- **Commits.** Conventional Commits, enforced by commitlint. `--no-verify` and `--no-gpg-sign` are blocked by `.qoder/hooks/commit-guard.sh`.
- **Pre-push** runs `agent:verify` unless `.ci-local/agent-verify-evidence.json` matches the current tree, has every gate passed, and is under 15 minutes old.
- **Biome** uses 2-space indent, 100 columns, single quotes in TS and double in JSX; `noExplicitAny` and `useSortedClasses` (`cn`/`clsx`/`cva`/`twMerge`) are errors. Several a11y rules are off in Biome because Playwright and Storybook axe enforce them.
- **Portal coverage floor:** lines 40, branches 27, functions 28, statements 40 (`apps/portal/jest.config.cjs`).
- **CodeGraph DB** resolves `CODEGRAPH_DB` → `~/local.db` → `.ci-local/local.db`. Never hand-edit it.
- **Release gate.** Once `pnpm agent:verify` passes, autonomously merge to `main` (`--ff-only`), push to `origin/main`, and deploy via `pnpm deploy:vercel:prod`.

## Where the detail lives

This file stays short on purpose. Before working in a domain, read the matching file in `.agents/rules/` (53 rules: `execution-guardrails.md`, `mandatory-ai-engineering-governance.md`, `api-guidelines.md`, `database-migrations.md`, `redis-capabilities.md`, `nextjs-16-caching.md`, `tailwind-utility-composition.md`, `testing-rules.md`, `universal-agent-workflow.md`). The canonical Server Action order (authenticate → authorize → validate → rate-limit → execute → audit → invalidate → return) is in `api-guidelines.md`. Scoped Cursor rules live in `.cursor/rules/`; repeatable workflows in `.qoder/skills/`.
