# Verification

## Core Principle

Tests passing does not prove the program works. Always execute the actual program.

## Evidence Before Claims

Before proceeding, ask: "Do these tests verify what matters, or only what was easy to test?" If important edge cases go untested, acknowledge the gap explicitly.

| Claim                | Required Evidence                         | Insufficient                |
| -------------------- | ----------------------------------------- | --------------------------- |
| "Tests pass"         | Fresh run: 0 failures                     | Previous run, "should pass" |
| "Build succeeds"     | Build exit 0                              | "Linter passed"             |
| "Bug fixed"          | Reproducing test passes                   | "Code changed"              |
| "UI works"           | Browser snapshot or live check            | "API returns 200"           |
| "No perf regression" | Hot paths cache/memoize, no heavy imports | "Tests pass"                |

If you have not run the command in this message, you cannot claim it passes.

## Frontend Changes Require Live Verification

Unit tests and typechecks are NOT sufficient for UI changes. After tests pass, verify the change works in the running app.

**Procedure:**

1. Start the dev server (`pnpm dev` for portal on :3000)
2. Navigate to the affected page
3. Interact with the changed UI
4. Report what you saw — "UI works" requires browser evidence, not "tests pass"

**Don't skip.** "Small CSS change" or "tests cover it" is not an excuse. Common pitfalls: stale cached bundles, CSS layout invisible to tests, elements in DOM but not visible/interactive.

## Stop Signals

About to use uncertain language ("should", "probably"), express satisfaction ("Done!"), commit, or mark complete? Run verification first.

## Failure Mode Self-Check

Before reporting completion, check for these five failure modes:

1. **Hallucinated actions** — invented paths, env vars, IDs, function names, library APIs, URLs. Cross-ref "Never invent values" in development-practices.md.
2. **Scope creep** — diff touches files/behaviors outside the request? Apply the lineage test.
3. **Cascading errors** — a failure suppressed/caught/wrapped in a way that hides root cause. Silent fallbacks metastasize bugs.
4. **Context loss** — diff contradicts earlier decisions in the session, plan, or CLAUDE.md? ~65% of agent failures trace to context drift.
5. **Tool misuse** — wrong tool for the job, or right tool with wrong params. Re-check parameter names.

Any mode flagged → fix and re-run, don't claim done.

## Auto-Fix in Spec Mode

During a spec workflow, fix all verification errors without asking. Outside spec mode, respect the user's mode — present issues and proposed fixes instead of applying them.
