# /test Command

Run the single-source test runner suite across all workspaces:

```bash
pnpm test
```

### Invariants:
1. Standardized on Jest 30 with `@swc/jest` (Single-Source Unit Test Runner Invariant).
2. All database migration rollback safety tests must pass (`pnpm --filter @repo/database test`).
3. Never skip or mock out failing tests to force a pass; fix root causes.
