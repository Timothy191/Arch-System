---
name: audit-federation
description: Run Arch-System monorepo audit suites (policy boundaries, contract drift, static compliance, and the verification gate suite) in standalone or federated checkouts.
---

# Audit Federation

Execute repository-wide static, architectural, security, and runtime verification suites directly from the repository root.

## Core Commands

1. `pnpm policy:check` — Verify dependency boundaries and security rules.
2. `pnpm audit:drift` — Verify `@repo/contract` Zod schemas match DB and API surfaces.
3. `pnpm audit:compliance` — Run the static invariant sweep (tokens, Tailwind, RSC, caching, RLS, hooks, agents).
4. `pnpm agent:verify:fast` — Run fast static, boundary, and governance verification gates.
5. `pnpm agent:verify` — Execute the full empirical verification suite before release.

## Evidence Contract

- Report exact command exit codes and output summaries for every executed audit.
- Never extrapolate unexecuted runtime checks; mark skipped runtime probes as `UNVERIFIED`.
