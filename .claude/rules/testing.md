# Testing

## Default Posture: Parsimonious

Reuse existing behavioural tests first. When a new public production class truly needs new tests, the ceiling is 1 unit test class + 1 functional test class (only when behaviour cannot be exercised through unit tests). Multiply test classes only when the production class has genuinely independent behavioural axes that warrant separation.

Avoid one-test-class-per-method, redundant assertions on the same path, and tests written purely to push a coverage number above a threshold.

The structure of tests should be **contra-variant** with the structure of code — tests should be structure-insensitive. Their pass/fail signal must respond to behaviour change, not to where you happened to put a method today.

## TDD — Default with Documented Escapes

**Default: have a failing test before you write production code.**

### Red-Green-Refactor

1. **RED** — One minimal test for the desired behavior. Behavior, not implementation. Mocks for external deps only.
2. **VERIFY RED** — Run it; confirm it fails because the feature doesn't exist (not syntax). If it passes → rewrite.
3. **GREEN** — Simplest code that passes. No extras, no refactor. Hardcoding is fine.
4. **VERIFY GREEN** — Full suite passes. Check diagnostics.
5. **REFACTOR** — Improve quality; tests stay green; no new behavior.

**TDD applies to:** new functions, API endpoints, business logic, bug fixes (reproduce first), behavior changes.

**Skip RED when:**

- Docs, config, dep version bumps, formatting-only changes
- The task carries a `Trivial:` justification naming the existing covering test (≤ 5 net new lines, no new branch/loop/try with non-trivial body, no new public symbol, no new error path)
- **Bugfixes never qualify for the trivial escape.** A bugfix without a reproducing test is a rubber-stamp fix.

**Recovery (code before test):** don't revert — write the test now, verify it catches regressions.

## Test Strategy

**Unit for logic, integration for interactions, E2E for workflows.**

| Type            | When                                       | Requirements                      |
| --------------- | ------------------------------------------ | --------------------------------- |
| **Unit**        | Pure functions, business logic, validation | Mock ALL external deps            |
| **Integration** | DB, external APIs, file I/O, auth flows    | Real test deps, fixtures, cleanup |
| **E2E**         | Complete user workflows, API chains        | Test entire flow                  |

External deps? No → unit. Yes → integration. Complete user workflow? Yes → E2E.

## Coverage Rule

Coverage is a diagnostic, not a quota. Critical paths (business logic, security, data integrity, error handling) must have explicit behaviour coverage. For glue code, configuration plumbing, simple CRUD, and trivial UI bindings, no numeric coverage gate. Padding tests purely to push a coverage number is an anti-pattern.
