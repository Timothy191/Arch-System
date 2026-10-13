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

### Layer 2: Real-World Fault Tolerance

- **Database & RLS Performance**: All queries and RLS policies utilize `(SELECT auth.uid())` initplan caching to avoid sequential scans.
- **Fail-Safe Recovery**: Graceful degradation on network failure without data loss.
- **Optimistic Updates**: Local storage queues for intermittent connectivity scenarios.
- **Operator Safety**: Clear visual error cues and fail-safe defaults for high-turnover operators.

## 4. Verification Before Claiming

Never claim a change "works" or is "verified" based solely on static analysis. Execute runtime verification:

- For database changes: Run `pnpm audit:drift` and `@repo/database:test:migration-rollback`
- For UI changes: Run Playwright E2E tests and capture console/accessibility metrics
- For API changes: Test with authenticated sessions and verify RLS enforcement
- For production claims: Require evidence from live preview environments, not just local builds

## 5. Anti-Assumption Mandate (CRITICAL)

**NEVER guess, assume, or speculate about errors or issues.**

Before claiming any error, blocker, or issue exists, you **MUST**:

1. **Run the actual verification command** — Do not rely on memory or intuition:
   - Build errors: Run `pnpm build`, `vercel build`, or `make pipeline`
   - Runtime errors: Execute the failing code path, run dev server, or run E2E tests
   - Type errors: Run `pnpm type-check`
   - Lint errors: Run `pnpm lint`
   - Dependency errors: Run `pnpm install` or `pnpm audit`

2. **Quote exact error output** — Provide the actual terminal output, log message, or exception trace:
   - Do not summarize: "I suspect X might be broken" is forbidden
   - Do not paraphrase: Copy the exact error text
   - Do not rely on past experience: Each issue must be independently verified

3. **Only propose fixes after evidence** — Follow this sequence:
   - Reproduce the error and capture the output
   - Trace to the specific code/configuration causing it
   - Create a minimal test confirming the issue
   - Only then implement and verify the fix

**Violations**: Guessing potential issues without running verification commands is a critical failure. Measure twice, claim once.

## Grounded Reasoning Mandate (CRITICAL)

**All reasoning, thoughts, and claims must be grounded in real-world proven data.**

Before building any reasoning, analysis, or proposal, you **MUST**:

1. **Ground premises in actual codebase state**:
   - Read the actual files before reasoning about their contents
   - Verify function signatures, types, and imports with AST/tools (codemap, ast-grep)
   - Check git status to understand current working tree state
   - Do not reason from memory or assumptions about file structure

2. **Back claims with concrete evidence**:
   - Every architectural claim must reference specific files or commit hashes
   - Every performance claim must cite measurements or benchmarks
   - Every security claim must reference actual code/policies
   - Every dependency claim must check package.json/lockfile

3. **Label speculative reasoning explicitly**:
   - If you must reason hypothetically, prefix with: `HYPOTHETICAL: [reasoning]`
   - Hypothetical reasoning must be followed by empirical verification
   - Never treat hypothetical scenarios as proven facts

4. **Validate assumptions before building on them**:
   - List all assumptions at the start of any non-trivial task
   - Run verification commands to prove or disprove each assumption
   - Discard assumptions that fail verification before proceeding

**Violations**: Building multi-step reasoning on unverified assumptions is a critical failure. Ground first, reason second.
