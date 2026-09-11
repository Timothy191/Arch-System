---
id: "codebase-health"
name: "Monorepo Codebase Health & Policy Sentinel"
department: "engineering"
authority_level: "L2"
schedule:
  min_interval_minutes: 15
  max_interval_minutes: 240
  backoff_factor: 2.0
signals:
  - source: "git"
    event: "post-commit"
  - source: "ci"
    event: "build-failure"
  - source: "periodic"
    interval: "adaptive"
verification:
  commands:
    - "pnpm type-check"
    - "pnpm policy:check"
---

# Business Loop: Codebase Health & Policy Sentinel

## 1. Business Intent
Guarantees that the Arch-System monorepo remains strictly typed, free of architectural boundary leaks, and structurally sound across all 21 packages. Prevents compilation regressions from accumulating in long-running development branches.

## 2. Invariants & Guardrails
- **Zero Type Errors**: Must pass `pnpm type-check` across every workspace package.
- **Architectural Isolation**: Package boundaries defined in `tools/repo/policy-compiler.cjs` must never be violated.
- **Light Mode UI**: No `dark:` Tailwind classes.
- **Rollback Guarantee**: If fixes introduce further errors after 2 attempts, revert using `git checkout -- .`.
