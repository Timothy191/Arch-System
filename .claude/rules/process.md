# Process & Workflow

Consolidated agent behavior rules. Domain-specific rules live in `architecture.md`, `portal.md`, `auth.md`, `design-system.md`.

## Task discipline

- Every non-trivial request: `TaskCreate` → `in_progress` → work → `completed`. Tasks are working memory across compaction — without them, requests are lost.
- New request mid-work → STOP, `TaskCreate` first, then assess priority.
- Complexity triage: Trivial (1 file, no active tasks) → direct. Moderate (2–5 files) → task then execute. High (architectural, 10+ files) → ask spec vs quick.

## Workflows

- `/spec` — feature/refactor needing plan, approval, TDD, verification (fresh subagent). One atomic commit per task; E2E mandatory for UI.
- `/fix` — quick bugfix: investigate → RED test → fix → E2E verify → quality gate. Bails to `/spec` if confidence low, 2 failed attempts, new abstractions, >150 net new lines, or architectural scope.
- `/prd` — vague ideas → concrete requirements → hand to `/spec`. PRDs in `docs/prd/`.

## Fix iron laws

1. No fix without root cause (file:line, explain WHY). 2. No code without a failing reproducing test. 3. Fix at the source, not where the error surfaces. 4. E2E verification mandatory — unit tests alone never prove. 5. Stop when over your head → `/spec`. Revert-first when something breaks; consider deleting the broken thing before patching.

## TDD

Default: failing test before production code. RED (one behavior test, verify it fails for the right reason) → GREEN (simplest code) → REFACTOR (tests stay green, no new behavior). Skip RED only for docs/config/deps/formatting, or a `Trivial:` justification (≤5 net new lines, no new branch/loop/try, no new public symbol, names existing covering test). **Bugfixes never qualify** — reproduce first. Recovery if code-before-test: write the test now, verify it catches regressions.

## Testing posture

Parsimonious — reuse existing behavioural tests first. Ceiling: 1 unit + 1 functional test class, only when behaviour can't be exercised through unit tests. Tests are **contra-variant** to code structure — pass/fail responds to behaviour, not to where a method sits. Unit for logic (mock all external deps), integration for DB/API/auth (real deps, fixtures, cleanup), E2E for workflows. Coverage is a diagnostic, not a quota — cover critical paths (business logic, security, data integrity, error handling); don't pad glue/CRUD/trivial UI bindings.

## Verification & evidence

Tests passing ≠ works. Execute the real program. A claim requires fresh evidence: build exit 0, fresh test run with 0 failures, reproducing test pass. Don't claim a command passes you didn't run this turn. **UI changes require live verification**: start `pnpm dev` (:3000), navigate, interact, report what you saw — "tests pass" is not proof. Stop signals: about to say "should"/"Done!"/commit/mark complete? Verify first. Before reporting done, self-check five failure modes: hallucinated values, scope creep, cascading/silent errors, context drift, tool misuse. In `/spec` mode, auto-fix verification errors; otherwise present issues + proposed fixes.

## Code review reception

Read → understand → verify against codebase → evaluate → respond → implement one item at a time. User feedback: implement after understanding (ask if scope unclear). External reviewers: verify first — correct for this codebase? breaks existing? reason for current impl? conflicts with prior decisions? `must_fix`/`should_fix` → fix now; `suggestion` → if quick. YAGNI: if a suggested "proper" feature is unused anywhere, push back to remove.

## Change discipline

Think before coding; when ambiguous, state assumptions and ask. Lineage test: every changed line traces to the request — else revert. Remove orphans your changes create; don't touch pre-existing dead code (mention, don't delete). Self-check: would a senior engineer call this overcomplicated? **Never invent values** — paths, env vars, IDs, versions, function names must be confirmed (read code, run command, or ask). File size <800 lines (>1000 = split signal). Hot paths (render loops, request handlers, polling) must cache/memoize. Fix your own syntax/typos; don't auto-fix user-edited code — report it. Check diagnostics before and after; fix all errors before complete.

## Systematic debugging

No fixes without root cause. Phases: root cause (read errors fully, reproduce, `git diff`, instrument boundaries) → pattern analysis (find working examples, diff) → hypothesis (falsifiable, one variable) → implementation (failing test, single fix, verify fully). Red flags → STOP: "quick fix for now", multiple changes at once, fixing before tracing data flow, 2+ failed fixes (3+ = architectural — question the pattern). Defense-in-depth after fixing: validate at entry point, business logic, env guards, debug instrumentation — make the bug structurally impossible, not just patched.

## Constraints

**Hard** (non-negotiable: physics, external contracts, security, deadlines) · **Soft** (conventions, negotiable if trade-off stated) · **Ghost** (past constraints no longer applying — ask "why can't we?" and if no one names a current requirement, it may be a ghost).

## Communication

Direct, high-signal — eliminate filler, don't narrate deliberation. One-sentence pre-declaration before the first tool call of a turn; one-sentence progress updates at root-cause/find, direction change, or blocker. No compatibility shims or dead code — delete unused code. Boundary-only validation: validate at system boundaries (API, user input), trust internal types. Read before edit. No unrequested planning docs. End substantive turns with **Summary of Actions** (bulleted) and **Suggested Next Steps** (3 options, `@path`-tagged: immediate / verify / harden). No sycophancy.
