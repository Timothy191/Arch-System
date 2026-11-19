# Repository Guidelines & Operational Directive

> **Governing SSoT:** [`AGENTS.md`](AGENTS.md)  
> **Target Audience:** All AI Coding Agents (Antigravity, Cursor, Claude Code, OpenCode, Codex, Subagents)  
> **Workspace:** Repository root (`Arch-System`, Plantcor / Arch OS)

---

## 1. Project Overview & Invariants

Arch-System is a production industrial mining portal (SCADA telemetry, multi-department dashboards, shift closeout, access control) on **Next.js 16 App Router + React 19**, pnpm 9.15.9, Turborepo 2.x, Node.js ≥ 24, backed by cloud Supabase and local Redis.

### Non-Negotiable Invariants

1. **Light Mode Only:** Canvas `#f3f4f6`; semantic OKLCH tokens from `@repo/theme/src/tokens/`. No `dark:` classes or raw hex colors.
2. **Layering Rules:** `apps/*` routes through `@repo/supabase` (never direct `packages/database`). `packages/ui` is pure presentation (no DB/Supabase imports). `packages/theme` is consumed by UI, never the reverse. `tools/*` never import runtime `@repo/supabase`.
3. **Canonical 8-Step Server Action Sequence:** 1. Authenticate (`getAuthenticatedEmployee`) → 2. Authorize → 3. Validate (`@repo/contract` Zod) → 4. Rate-limit → 5. Execute → 6. Audit log → 7. Invalidate caches (`updateTagInAction`) → 8. Return typed result (before any `redirect()`).
4. **Strict TypeScript & Zero Mock Data:** Zero `any`, zero `@ts-ignore`, real Supabase/Redis data schemas.
5. **On-Demand Context & Adaptive Thinking:** DO NOT eager-read full documentation files. Query specific line ranges or symbols on demand (`rg`, `read_file` ranges, `codemap`), and follow `.agents/rules/real-world-adaptive-execution.md` (scale effort L1/L2/L3 to risk without ever dropping quality).

---

## 2. Core Toolchain & Verification

Always run scoped inside `Arch-System/`:

```bash
export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH:/home/tim/.cargo/bin"
pnpm env:check               # Validate local/target environment configuration
pnpm agent:start             # Branch off main + initialize [ ] checklist
pnpm agent:finish            # Verify + safe commit + optional --ff-only --merge
pnpm agent:verify            # Mandatory 28-gate verification suite (fails fast)
pnpm test:coverage:changed   # Enforce >= 70% coverage on changed portal runtime files
pnpm type-check              # turbo type-check --concurrency=2
pnpm lint                    # turbo run lint (Biome per package)
pnpm test                    # turbo run test
pnpm audit:compliance        # static invariant sweep
```

---

## 3. Autonomous Execution & Guardrails

1. **Universal Checklist & Clean-Git Flow:** Follow `.agents/rules/universal-agent-workflow.md`: assess -> break into `- [ ]` checkboxes (`1` task = `1` checkbox) -> branch (`pnpm agent:start`) -> complete all primary, related, and recommended items (`0` `[ ]` left) -> verify -> safe commit & `--ff-only` merge (`pnpm agent:finish -- --message "..." --merge`).
2. **Zero-Interruption Self-Healing:** Autonomously inspect errors, fix files, and re-verify until all applicable gates pass (`pnpm agent:verify`). Never stop to ask the user to fix test failures.
3. **Zero Speculation (3-Option Prompt):** Never invent requirements. When genuinely uncertain, prompt the user with 3 concrete options (Option 1 `(Recommended)`).
4. **Remote Release Gate:** Run local verification and `--ff-only` branch cleanup autonomously; require explicit user approval (or a dedicated release CI trigger) before pushing to `origin/main` or deploying via `pnpm deploy:vercel:prod`.
5. **Traceability:** Append ISO-8601 entries to root `AGENT_TRACER.md`.
6. **VibeMon Tracking (Mandatory):** Keep VibeMon updated (`pnpm vibemon:update`) and emit session/task events via `pnpm vibemon:track` (`pnpm vibemon:status`).

For full specifications, architecture catalogs, and API contracts, consult [`AGENTS.md`](AGENTS.md).
