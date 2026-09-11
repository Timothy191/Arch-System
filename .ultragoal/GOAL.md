# Ultragoal: Complete migration of apps/portal to @repo/shared/hooks with zero regression
State: COMPLETED

## Verifier Rubric
- [x] Rubric Check 1: Zero direct imports from legacy hook files.
- [x] Rubric Check 2: pnpm --filter portal type-check passes with 0 errors.
- [x] Rubric Check 3: pnpm check:fast passes with 0 warnings.
- [x] Rubric Check 4: Playwright smoke tests for Control Room pass.
