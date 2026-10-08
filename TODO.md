# TODO — Vercel Deployment & Coding Agent Isolation

All phases completed and verified per `.agents/rules/todo-completion-and-detailed-reporting.md`.

## Phase 1: Audit & Invariant Enforcement

- [x] 1. Inspect git status and audit `.vercelignore` and `apps/portal/next.config.mjs` against all coding agent assets.
- [x] 2. Verify `apps/portal/public` static assets for complete absence of agent instructions or private configurations.
- [x] 3. Verify server route handlers (`/api/codebase-maps` and `/api/audit`) for filesystem containment and graceful fallbacks.

## Phase 2: Deployment Boundary Hardening

- [x] 4. Add comprehensive coding agent file exclusion patterns (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude.local.md`, `.cursorrules`, `REVIEW.md`, `**/*AGENT_TRACER.md`, `.mcp.json`, `tools/`, `scripts/`, `.github/`) to root `.vercelignore`.
- [x] 5. Add matching agent isolation patterns to `outputFileTracingExcludes` in `apps/portal/next.config.mjs` to protect serverless Lambda bundles.
- [x] 6. Create `apps/portal/.vercelignore` for defense-in-depth isolation.

## Phase 3: Automated Regression Gate

- [x] 7. Enhance `tools/scripts/vercel-preflight.cjs` to enforce and validate coding agent exclusion rules in both `.vercelignore` and `next.config.mjs`.

## Phase 4: Quality & Policy Verification

- [x] 8. Execute `pnpm audit:vercel` (Vercel Preflight) and achieve 100% PASS across all 6 tiers.
- [x] 9. Execute `bash tools/scripts/agent-verify.sh` and achieve 100% PASS across all 8 real-world quality gates.
