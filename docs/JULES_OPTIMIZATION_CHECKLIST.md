# Jules Optimization & Refinement Checklist

Use this checklist before opening a Jules optimization/refinement pull request. The goal is to improve measurable performance, simplify unnecessarily complex code, and preserve behavior while avoiding speculative abstractions or premature optimization.

## 1. Scope and baseline

- [ ] Define the exact component, route, service, or workflow being reviewed.
- [ ] Confirm the current behavior and user-visible requirements before changing implementation.
- [ ] Search existing open and recently merged PRs/issues for overlapping optimization work.
- [ ] Keep the change narrowly scoped; do not combine unrelated refactors.
- [ ] Record a baseline when a meaningful performance claim is being made.
- [ ] Prefer real repository data, existing tests, and observed execution paths over assumptions.

## 2. Complexity and data-flow review

- [ ] Identify repeated `filter`, `find`, `some`, `includes`, `sort`, `reduce`, or nested-loop work.
- [ ] Check whether array scans occur inside render loops, callbacks, or other hot paths.
- [ ] Replace repeated linear lookups with an indexed `Map`/`Set` only when the lookup pattern justifies the added structure.
- [ ] Combine compatible passes over the same collection when that makes the code clearer and avoids unnecessary intermediate arrays.
- [ ] Avoid building indexes that are used only once or for small collections where complexity would increase without a practical benefit.
- [ ] Check sorting and grouping for accidental repeated work.
- [ ] Check database/API calls for duplicate requests, unnecessary fields, and avoidable sequential operations.

## 3. React and frontend review

- [ ] Identify unnecessary component re-renders before adding memoization.
- [ ] Use `useMemo` only for computations whose cost or referential stability warrants it.
- [ ] Use `useCallback` only when function identity materially affects a memoized child or dependency graph.
- [ ] Use `React.memo` only where it prevents a meaningful amount of unnecessary rendering.
- [ ] Keep dependency arrays complete and correct; never suppress dependency warnings merely to force caching.
- [ ] Avoid moving trivial calculations into memoization solely for theoretical performance.
- [ ] Preserve loading, error, empty, and permission states.

## 4. Code simplification

- [ ] Remove duplicated logic where a small, obvious simplification improves readability.
- [ ] Prefer straightforward language features such as `??` where they accurately express the intended fallback semantics.
- [ ] Remove unnecessary temporary arrays, wrappers, and defensive checks that cannot occur under the established types/contracts.
- [ ] Do not introduce a utility, abstraction, generic helper, or new dependency for a one-off operation unless reuse is clear.
- [ ] Preserve strong typing; do not replace precise types with `any` or unsafe casts to make refactoring easier.
- [ ] Favor code that a maintainer can understand locally without tracing an unnecessary abstraction chain.

## 5. Backend, database, and security

- [ ] Preserve authentication and authorization behavior.
- [ ] Preserve PostgreSQL RLS policies and security-sensitive query/view behavior.
- [ ] Verify that optimization does not broaden data access or bypass existing server-side checks.
- [ ] Check indexes, joins, filters, pagination, and selected columns before optimizing application-side processing.
- [ ] Avoid moving sensitive filtering from the database to an untrusted client.
- [ ] Do not cache data across users/roles unless cache isolation is explicit and correct.
- [ ] Preserve audit/logging behavior where it is part of the security or operational contract.

## 6. Correctness and edge cases

- [ ] Preserve exact KPI/count/aggregation semantics.
- [ ] Test empty arrays and missing/nullable values.
- [ ] Test duplicate identifiers where indexing could overwrite or merge records.
- [ ] Test ordering requirements when replacing array operations with maps or sets.
- [ ] Check timezone/date/shift boundaries for operational reporting.
- [ ] Verify that fallback behavior remains equivalent after replacing `||` with `??` or vice versa.

## 7. Validation

- [ ] Add or update focused unit tests for changed behavior.
- [ ] Run the smallest relevant test suite first.
- [ ] Run TypeScript/type checking for affected packages.
- [ ] Run linting for affected packages.
- [ ] Run the appropriate build before requesting merge when the change affects production compilation.
- [ ] Check the final diff for accidental files, formatting churn, generated files, or unrelated changes.
- [ ] Report actual validation results; do not claim tests or measurements that were not run.

## 8. Performance evidence

- [ ] State what work was removed or made cheaper.
- [ ] State the relevant complexity change when it is meaningful, e.g. `O(N*M)` to `O(N+M)`.
- [ ] Distinguish measured results from expected benefits.
- [ ] Do not claim a percentage improvement without a reproducible measurement.
- [ ] Confirm that the optimization is relevant to realistic data volume and execution frequency.
- [ ] Consider memory/allocation costs introduced by new maps, memoization, caching, or indexes.

## 9. PR quality gate

- [ ] Title is concise and describes the actual change.
- [ ] PR body explains **what**, **why**, **scope**, and **validation**.
- [ ] Include a checkbox summary showing which sections were completed.
- [ ] Explicitly call out security/RLS/authentication preservation when applicable.
- [ ] Explicitly identify intentionally unchanged areas to prevent scope creep.
- [ ] Confirm the branch is based on the intended base branch.
- [ ] Confirm no existing PR already implements the same optimization.
- [ ] Leave the PR open for review unless merge authorization is explicitly requested.

## Jules completion checklist

- [ ] Research/review completed before editing.
- [ ] Existing implementation understood.
- [ ] Existing optimization PRs checked for overlap.
- [ ] Simplest safe implementation selected.
- [ ] Behavior preserved.
- [ ] Security boundaries preserved.
- [ ] Focused tests added/updated where appropriate.
- [ ] Type-check/lint/build completed as applicable.
- [ ] Diff reviewed for scope and unnecessary complexity.
- [ ] PR body contains evidence and remaining follow-up items.
