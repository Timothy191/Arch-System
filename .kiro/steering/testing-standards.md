---
inclusion: fileMatch
fileMatchPattern: ["**/*.test.*", "**/*.spec.*", "e2e/**/*"]
---

# Testing Standards

## Unit Tests (Jest)

- Files: `*.test.ts` or `*.test.tsx` in `apps/portal/`
- Run: `pnpm --filter portal test`
- Single file: `pnpm --filter portal test -- --testPathPatterns=<file>`
- Mock `@repo/supabase`, never `@supabase/supabase-js`
- Test behavior, not implementation details
- Use descriptive test names: `"should X when Y"`

## E2E Tests (Playwright)

- Files: `e2e/*.spec.ts`
- Run: `pnpm test:e2e` (requires app running at localhost:3000)
- Use Playwright's built-in assertions

## Coverage

- Focus on meaningful coverage, not 100%
- Test error states and edge cases, not just happy paths
- Integration tests > isolated unit tests for data-heavy components
