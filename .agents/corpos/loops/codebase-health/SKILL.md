---
name: "codebase-health-skill"
description: "Adaptive operational runbook for resolving TypeScript errors, package boundary leaks, and dependency conflicts."
department: "engineering"
authority_level: "L2"
---

# Codebase Health & Policy Sentinel — Agent Skill Runbook

## 1. Input Context
- **Signal**: Commit hash, compiler error log, or scheduled diagnostic trigger.
- **Brief**: Read `.agents/corpos/storage/briefs/<tick_id>.md`.

## 2. Execution Phases

### Phase 1: Ingestion & Diagnosis
1. Execute `pnpm type-check` and capture output.
2. If clean, terminate early with outcome `IDLE`.
3. If errors detected, group errors by workspace package and identify root-cause file paths.

### Phase 2: Isolation & Planning
1. Ensure running inside an isolated worktree (`.agents/worktrees/<tick_id>`).
2. Verify package boundaries against `tools/repo/policy-compiler.cjs`.

### Phase 3: Resolution
1. Apply targeted type adjustments without using `any`, `unknown` casts without type predicates, or `// @ts-ignore`.
2. If an export is missing, export it strictly from `src/index.ts` of the defining package.
3. If a boundary rule is violated, refactor shared types into `@repo/shared` or `@repo/contract`.

### Phase 4: Verification Gate
1. Run `pnpm type-check`.
2. Run `pnpm policy:check`.
3. If both succeed, stage files and commit to branch `corpos/<tick_id>`.
4. If failures persist after 2 iterations, execute rollback: `git checkout -- .`.

## 3. Negative Constraints
- NEVER modify `/usr/share/omarchy/`.
- NEVER bypass TypeScript strict checks.
- NEVER suppress lint rules with file-level disables.
