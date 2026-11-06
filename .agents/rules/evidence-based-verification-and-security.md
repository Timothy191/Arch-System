---
name: evidence-based-verification-and-security
description: Security verification and evidence-level reporting invariants
paths:
  - '**/*'
alwaysApply: true
---

# Evidence-Based Verification & Security Gate Invariants

Permanently active across all autonomous agent sessions.

## Security & Backdoor Verification

1. **Repo-wide search**: Never declare backdoor/token removal from single-file edits. Run `rg -n -i "<target-pattern>" .`
2. **Multi-layer audit**: route handlers, server actions, layouts, middleware, test fixtures.
3. **Negative assertions**: unit tests asserting unauthorized users are rejected.

## Compile-Check After Batch Edits

After `sed`/AST codemods, **NEVER** conclude without `pnpm --filter <workspace> type-check` (or `pnpm type-check`).

## Evidence Levels (E0–E4)

E0 unsubstantiated · E1 static (source inspection) · E2 automated (tests, type-check, build) · E3 runtime (live server, DOM) · E4 cross-validated (multiple independent channels).

**Headless**: report runtime UI/cookies as `NOT VERIFIED (BLOCKED - Headless)`. Never claim "100% verified" from static steps alone.

## Anti-Assumption Mandate (CRITICAL)

**NEVER guess, assume, or speculate about errors.** Before claiming any error/blocker you **MUST**:

1. **Run the real command**: build → `pnpm build`/`vercel build`/`make pipeline`; runtime → execute path, dev server, or E2E; types → `pnpm type-check`; lint → `pnpm lint`; deps → `pnpm install`/`pnpm audit`.
2. **Quote exact output** — no summarizing ("I suspect X" is forbidden), no paraphrasing, no reliance on past experience.
3. **Fix only after evidence**: reproduce + capture → trace to code/config → minimal confirming test → implement and verify.

Guessing without verification is a critical failure.

## Grounded Reasoning Mandate (CRITICAL)

All reasoning must be grounded in real, proven data. You **MUST**:

1. **Ground premises**: read files before reasoning; verify signatures/types/imports with codemap/ast-grep; check git status; never reason from memory about structure.
2. **Back claims**: architecture → files/commit hashes; performance → measurements; security → actual code/policies; dependencies → package.json/lockfile.
3. **Label speculation** `HYPOTHETICAL: [reasoning]`, follow with empirical verification; never treat it as fact.
4. **Validate assumptions**: list them at start of non-trivial tasks, verify each, discard failures before proceeding.

Building on unverified assumptions is a critical failure.

## Additional Rules

- **Docs vs reality**: record contradictions as architectural discrepancies requiring decision — no assumptions or unauthorized rewrites.
- **Library vs runtime**: if the execution layer is absent, state library-only/test-only.
