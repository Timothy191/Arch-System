---
description: 'Real-world engineering standards for industrial mining operations'
paths: ['apps/**/*', 'packages/**/*', 'libs/**/*']
---

# Real-World Engineering Standards

## 1. Industrial Reality Context

Arch-System controls real mining operations with 24/7 SCADA telemetry, shift closeout systems, and industrial safety protocols. Every agent operating in this codebase must:

- **Assume production deployment** — this is not a playground or learning environment
- **Prioritize reliability over cleverness** — proven, boring solutions beat novel, elegant ones in industrial settings
- **Consider operational constraints** — intermittent connectivity, vibration-heavy environments, high operator turnover
- **Treat failures as catastrophic** — a single wrong RLS policy or broken telemetry stream can halt production across an entire pit

## 2. Pre-Write Real-World Critique Council

Before modifying any core application logic or schema:

1. **Aspect Debate**: Evaluate the proposed change against Feasibility, Maintainability, Security, Performance, and Industrial Reliability.
2. **Quality Score Gate**: Proceed only when the Real-World Quality Score achieves $\ge 90/100$:
   $$\text{Real-World Score} = \frac{\text{Feasibility} + \text{Maintainability} + \text{Security} + \text{Performance} + \text{Reliability}}{5}$$

## 3. Two-Layer Verification

### Layer 1: Structural & Syntactic Gate

- **TypeScript**: 100% strict mode, zero `any`, zero `@ts-ignore`.
- **Architectural Boundaries**: Full compliance with `tools/repo/policy-compiler.cjs`.
- **Unit & Integration Tests**: 100% pass rate across all Jest test suites.
- **Lexical Integrity**: Full compliance with CSpell dictionary.

### Layer 2: Real-World Fault Tolerance & Usability

- **Database & RLS Performance**: All queries and RLS policies utilize `(SELECT auth.uid())` initplan caching to avoid sequential scans, and service-role mutations explicitly scope by `department_id` / `site_id`.
- **Fail-Safe Recovery & Idempotency**: Graceful degradation on network failure without data loss; mutations must be idempotent against duplicate clicks or retries.
- **Optimistic Updates**: Local storage queues for intermittent connectivity scenarios.
- **Operator Usability & Ergonomics**: Clear visual cues, high-contrast light-mode OKLCH tokens, golden structural separators, assistive input auto-formatting, and fail-safe defaults for high-turnover shift operators.

## 4. Complete Information Prerequisite & 3-Option Uncertainty Prompt (Zero Guessing)

Never assume, guess, or proceed when required information is missing or ambiguous:

1. **Exhaustive Grounded Research First**: Inspect actual source files, AST call graphs (`ast-grep`, `codemap`), database migrations (`@repo/database`), and Zod contracts (`@repo/contract`), and consult primary documentation (`context7`).
2. **Prompt With 3 Options When Uncertain**: At any time when uncertainty or ambiguity arises regarding requirements, architecture, or behavior, **STOP and prompt the user with 3 concrete options** (with Option 1 prefixed `(Recommended)`). Never invent requirements, silent defaults, or speculative logic.

## 4b. Autonomous Branch, Merge to `main`, and GitHub + Vercel Push Lifecycle

1. **Always Create a Branch**: Before mutating files, create a dedicated task branch (`git checkout -b <type>/<scope>`) and execute all user-requested actions autonomously.
2. **Verify, Commit to `main`, and Deploy**: Once all verification gates pass (`pnpm agent:verify`), merge/commit the verified changes into `main`, push to GitHub (`git push origin main`), and deploy to Vercel Production (`pnpm deploy:vercel:prod` / `vercel --prod --yes`).

## 5. Verification Before Claiming

Never claim a change "works" or is "verified" based solely on static analysis. Execute runtime verification:

- For database changes: Run `pnpm audit:drift` and `@repo/database:test:migration-rollback`
- For UI changes: Run unit/component and Playwright E2E tests and capture console/accessibility metrics
- For API/Server Action changes: Test authentication, department authorization, idempotency, and controlled error paths
- For production claims: Require evidence from live preview environments, not just local builds

## 6. Anti-Assumption & Grounded Reasoning Mandate (CRITICAL)

**NEVER guess, assume, or speculate.** All reasoning, claims, and fixes must be grounded in empirical repository evidence:

1. **Run the actual verification command & quote exact output**:
   - Build/type/lint/deps: `pnpm build`, `pnpm type-check`, `pnpm lint`, `pnpm install`, `pnpm audit`, or `make pipeline`.
   - Runtime: Execute the failing code path, dev server, or E2E tests.
   - Quote the exact terminal output, log message, or exception trace without paraphrasing (`"I suspect X might be broken"` is forbidden).
2. **Evidence-first fix sequence**: Reproduce the error → trace to specific code/config → create a minimal confirming test → implement and verify the fix.
3. **Ground premises in actual codebase state**:
   - Read actual files and verify signatures/imports via AST (`codemap`, `ast-grep`) and `git status`.
   - Cite specific files, commit hashes, benchmarks, policies, or `package.json`/`pnpm-lock.yaml`.
   - Prefix any hypothetical reasoning with `HYPOTHETICAL: [reasoning]` and immediately verify empirically.
   - Validate all assumptions with verification commands at task start and discard any that fail.
