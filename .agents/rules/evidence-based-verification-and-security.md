---
name: evidence-based-verification-and-security
description: Security verification and evidence-level reporting invariants
paths:
  - '**/*'
alwaysApply: true
---

# Evidence-Based Verification & Security Gate Invariants

This rule is permanently active across all autonomous agent sessions.

## Security & Backdoor Verification

When removing/auditing authorization or credentials:

1. **Repository-Wide Search**: Never declare backdoor/token removal based on single-file edits. Run: `rg -n -i "<target-pattern>" .`
2. **Multi-Layer Audit**: Validate across route handlers, server actions, layouts, middleware, and test fixtures
3. **Negative Assertions**: Add unit tests asserting unauthorized users are rejected

## Compile-Check After Batch Edits

After automated replacements (`sed`, AST codemods), **NEVER** conclude without verifying:

```bash
pnpm --filter <workspace> type-check
# or
pnpm type-check
```

## Evidence Levels (E0-E4)

Report status with explicit evidence tiers:

- **E0**: Unsubstantiated claims/assumptions
- **E1**: Static evidence (source inspection)
- **E2**: Automated verification (tests, type-check, build)
- **E3**: Runtime evidence (live server, DOM inspection)
- **E4**: Cross-validation (multiple independent channels)

**Headless Disclosure**: In headless environments, report runtime UI/cookies as `NOT VERIFIED (BLOCKED - Headless)`. Never claim "100% verified" based on static steps alone.

## Anti-Assumption Mandate (CRITICAL)

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

## Additional Anti-Assumption Rules

- **Documentation vs Reality**: When docs contradict implementation, record as architectural discrepancy requiring decision — do not assume or perform unauthorized rewrites
- **Library vs Runtime**: Distinguish standalone utilities from production-integrated systems. If execution layer absent, state library-only/test-only
