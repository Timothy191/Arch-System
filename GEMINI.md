# Repository Guidelines & Operational Directive

> **Governing SSoT:** [`AGENTS.md`](file:///home/tim/Fork/Arch-System/AGENTS.md)  
> **Target Audience:** All AI Coding Agents (Antigravity, Cursor, Claude Code, OpenCode, Codex, Subagents)  
> **Workspace:** `/home/tim/Fork/Arch-System` (Plantcor / Arch OS)

---

## 1. Project Overview & Invariants

Arch-System is a production industrial mining portal (SCADA telemetry, multi-department dashboards, shift closeout, access control) on **Next.js 16 App Router + React 19**, pnpm 9.15.9, Turborepo 2.x, Node.js ≥ 24, backed by cloud Supabase and local Redis.

### Non-Negotiable Invariants

1. **Light Mode Only:** Canvas `#f3f4f6`; semantic OKLCH tokens from `@repo/theme/src/tokens/`. No `dark:` classes or raw hex colors.
2. **Layering Rules:** `apps/*` routes through `@repo/supabase` (never direct `packages/database`). `packages/ui` is pure presentation (no DB/Supabase imports). `packages/theme` is consumed by UI, never the reverse. `tools/*` never import runtime `@repo/supabase`.
3. **Canonical 8-Step Server Action Sequence:** 1. Authenticate (`getAuthenticatedEmployee`) → 2. Authorize → 3. Validate (`@repo/contract` Zod) → 4. Rate-limit → 5. Execute → 6. Audit log → 7. Invalidate caches (`updateTagInAction`) → 8. Return typed result (before any `redirect()`).
4. **Strict TypeScript & Zero Mock Data:** Zero `any`, zero `@ts-ignore`, real Supabase/Redis data schemas.
5. **On-Demand Context:** DO NOT eager-read full documentation files. Query specific line ranges or symbols on demand via `read_file` or `codemap`.

---

## 2. Core Toolchain & Verification

Always run scoped inside `Arch-System/`:
```bash
export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH:/home/tim/.cargo/bin"
pnpm agent:verify       # Mandatory 28-gate verification suite (fails fast)
pnpm type-check         # turbo type-check --concurrency=2
pnpm lint               # turbo run lint (Biome per package)
pnpm test               # turbo run test
pnpm audit:compliance   # static invariant sweep
```

---

## 3. Autonomous Execution & Guardrails

1. **Always Branch:** Start every task by creating a branch (`git checkout -b <type>/<scope>`).
2. **Zero-Interruption Self-Healing:** Autonomously inspect errors, fix files, and re-verify until all 28 gates pass (`pnpm agent:verify`). Never stop to ask the user to fix test failures.
3. **Zero Speculation (3-Option Prompt):** Never invent requirements. When genuinely uncertain, prompt the user with 3 concrete options (Option 1 `(Recommended)`).
4. **Autonomous Deployment:** On verified completion, merge to `main`, push to GitHub (`git push origin main`), and deploy to Vercel (`pnpm deploy:vercel:prod`).
5. **Traceability:** Append ISO-8601 entries to root `AGENT_TRACER.md`.

For full specifications, architecture catalogs, and API contracts, consult [`AGENTS.md`](file:///home/tim/Fork/Arch-System/AGENTS.md).
