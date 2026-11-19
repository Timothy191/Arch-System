# Cline System Prompt — Arch-System

> **Governing SSoT:** [`AGENTS.md`](../AGENTS.md)  
> **Agent Guide:** [`GUIDE.md`](../.agents/GUIDE.md)  
> **Repository:** Arch-System (Plantcor / Arch OS) — Next.js 16 App Router + React 19 monorepo, pnpm 9.15.9, Turborepo 2.x, Node.js ≥ 24, cloud Supabase + local Redis.

## Core Directives

1. **Always branch first** — create a `git checkout -b <type>/<scope>` branch before any change.
2. **Never duplicate canonical guidance** — this `.cline/` folder points to `AGENTS.md` and `.agents/`; do not inline their content here.
3. **Run verification before completion** — `pnpm agent:verify` (28-gate suite), `pnpm type-check`, `pnpm lint`, `pnpm test`.
4. **Trace every task** — append ISO-8601 entries to root `AGENT_TRACER.md` via `.cline/hooks/post-task-tracer.sh`.
5. **Respect protected paths** — never edit `.env*`, generated files, migrations symlink, or non-canonical tracer paths (enforced by `.qoder/hooks/protect-paths.sh`).

## Non-Negotiable Invariants (from AGENTS.md)

- **Light mode only:** Canvas `#f3f4f6`; semantic OKLCH tokens from `@repo/theme/src/tokens/`. No `dark:` classes or raw hex colors.
- **Layering rules:** `apps/*` routes through `@repo/supabase` (never direct `packages/database`). `packages/ui` is pure presentation (no DB/Supabase imports). `packages/theme` consumed by UI, never reverse. `tools/*` never import runtime `@repo/supabase`.
- **Canonical 8-Step Server Action Sequence:** Authenticate → Authorize → Validate (`@repo/contract` Zod) → Rate-limit → Execute → Audit log → Invalidate caches → Return typed result (before any `redirect()`).
- **Strict TypeScript & zero mock data:** Zero `any`, zero `@ts-ignore`, real Supabase/Redis data schemas.
- **On-demand context:** Do not eager-read full documentation files. Query specific line ranges or symbols via `read_file` or `codemap`.

## Key Commands (run inside `Arch-System/`)

```bash
export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH:/home/tim/.cargo/bin"
pnpm agent:verify       # Mandatory 28-gate verification suite (fails fast)
pnpm type-check         # turbo type-check --concurrency=2
pnpm lint               # turbo run lint (Biome per package)
pnpm test               # turbo run test
pnpm audit:compliance   # static invariant sweep
pnpm token:budget-check # 40KB root instruction file ceiling
```

## SWE Agent Invocation

For end-to-end software engineering tasks, route through `swe-agent`:

1. **Plan & decompose**: Use `swe-plan-and-decompose` skill from skills-mcp
2. **Implement & verify**: Use `swe-implement-and-verify` skill from skills-mcp
3. **Maker-Checker**: SWE agent diff → `security-quality-gatekeeper` → `A2AReviewVerdict`
4. **Traceability**: Every code mutation correlates with a task ID on `.agents/a2a/bus/event-log.jsonl`
5. **Pre-flight**: `.cline/hooks/swe-pre-flight-check.sh` runs automatically on relevant edits

**Agent directive**: `.agents/agents/swe-agent/agent.md`  
**Registry card**: `.agents/a2a/registry/swe-agent.json`
