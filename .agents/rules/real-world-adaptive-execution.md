---
name: real-world-adaptive-execution
description: 10 evidence-based rules for real-world usable code, primary sources, zero-backlog execution, and adaptive thinking per token without dropping quality
paths:
  - '**/*'
alwaysApply: true
---

# Real-World Usable Code, Zero-Backlog Flow & Adaptive Thinking Rules

Grounded in empirical delivery research (DORA / Accelerate Lean capabilities & WIP limits), Anthropic context engineering and adaptive test-time compute findings, and Arch-System's industrial production invariants.

## 1. Real-World Usable Code Over Synthetic Scaffolds

Write code that survives live PostgreSQL, Redis, network partitions, and operator shifts — never mock facades, placeholder data, or hardcoded IDs in production paths. Every change must connect end-to-end to real contracts (`@repo/contract`), real persistence (`@repo/supabase`), and real UI accessibility.

## 2. Evidence-Before-Reasoning Mandate

Ground every premise in current-session observations before proposing or editing: read actual source lines, inspect AST/call sites (`rg` / `codemap`), check lockfiles (`pnpm-lock.yaml`) and migrations (`packages/database/migrations/`). Label unverified hypotheses `HYPOTHETICAL:` and immediately validate them empirically.

## 3. Primary & Proven Sources Only

Verify APIs, CLI flags, framework semantics, and library versions against primary sources (`context7`, official docs, RFCs, installed `node_modules`, and `pnpm-lock.yaml`) rather than memory or outdated blog patterns. Prefer proven, boring industrial defaults over speculative abstractions.

## 4. Functional Verification Over Static Assumptions (E0–E4)

Never infer runtime behavior from static compilation alone. Execute the actual build, unit/integration suite, or probe (`pnpm agent:verify`, `pnpm test:coverage:changed`, `pnpm env:check`), quote exact exit codes and outputs, and explicitly tag unexecuted runtime layers as `UNVERIFIED`.

## 5. Single-Piece Flow & Strict WIP=1 (Zero-Backlog Architecture)

Empirically, unconstrained work-in-process inflates lead time and change failure rate. Complete one shippable vertical slice end-to-end (code + tests + docs + audits) before starting the next; reject half-finished scaffolding or deferred TODOs that create backlog debt.

## 6. Immediate Defect Triage (Zero Bug Graveyard Policy)

When a bug, drift, or broken invariant is discovered, apply immediate triage: **Fix Now** if scoped and unambiguous, **Explicitly Reject** (out-of-scope / non-issue with evidence), or **Escalate** with 3 concrete options. Never silently ignore or park defects in an unscheduled backlog.

## 7. Propagated Closure Across Coupled Boundaries

A change is incomplete until every coupled boundary is updated and verified in the same slice: `@repo/contract` schemas, `tools/repo/policy-compiler.cjs`, `codebase-maps`, `.env.example` templates, audit reports, changed-file test coverage (`pnpm test:coverage:changed`), and root `AGENT_TRACER.md`.

## 8. Adaptive Thinking Effort Scaling (L1 Fast / L2 Standard / L3 Deep)

Allocate reasoning depth dynamically to task risk and ambiguity rather than using fixed verbosity:

- **L1 (Fast)**: Single-file deterministic edits, formatting, renames, or verified lookup — minimal reasoning overhead, direct execution.
- **L2 (Standard)**: Multi-file feature work, bug root-causing, or test additions — targeted `rg`/line-range context, explicit verification plan.
- **L3 (Deep)**: Auth/RBAC, PostgreSQL RLS/migrations, concurrency, or architecture shifts — full 5-phase structured thinking and multi-layer verification.

## 9. High-Signal, Just-In-Time Context Retrieval

Reduce token waste by eliminating _input noise_, never reasoning fidelity: locate symbols with `rg` / AST first, read only required line ranges (`<= 150` lines), parallelize independent read calls, offload large tool logs (`> 2,000` chars) to scratch files, and compact via `pnpm compact` (`SKILL.state` spine) rather than re-reading unchanged files.

## 10. Non-Negotiable Quality Preservation Invariant

Token budgets (`pnpm token:budget-check`) are telemetry signals, **never execution ceilings**. Never skip verification steps, omit edge-case handling, weaken assertions, drop reasoning, or leave partial work to save tokens; automatically escalate `L1 -> L2 -> L3` whenever hidden complexity emerges.
