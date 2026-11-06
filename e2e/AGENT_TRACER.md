# AGENT_TRACER — e2e

## 2026-06-24T12:00:00Z

**Purpose:** Enhanced monorepo architectural enforcement through improved project tagging and Nx dependency constraints.

**Changes made:**

- Improved error handling in `tools/apply-project-tags.cjs` for robust package.json parsing with try-catch blocks and detailed error messages
- Added comprehensive inline documentation to `apply-project-tags.cjs` documenting tag vocabulary (scope:app, scope:package, scope:tool, etc.) and tools/ subdirectory handling rationale
- Added dependency constraints to `nx.json` enforcing architectural rules:
  - Apps can only depend on packages (not other apps)
  - Apps cannot depend on database internals (scope:package:db-internal)
  - UI packages cannot depend on database-related packages
  - Theme packages cannot depend on UI packages
  - Tools cannot depend on apps or Supabase
  - Packages cannot depend on apps
- Added tag vocabulary documentation section to `AGENTS.md` explaining the Nx project tagging system and dependency constraints
- Integrated automatic tag generation into pre-commit hooks via lint-staged - now runs `node tools/apply-project-tags.cjs` whenever project.json files are modified

**Next agent:** The monorepo now has automatic architectural enforcement through Nx dependency constraints. The tagging system is documented in AGENTS.md under "Nx Project Tags & Architectural Enforcement". When adding new projects, run `node tools/apply-project-tags.cjs` to ensure proper tagging. The pre-commit hook will automatically re-tag projects when project.json files are modified. Dependency violations will be caught by Nx's enforcement rules.

---

## 2026-06-24T00:00:00Z

**Purpose:** Comprehensive E2E test coverage expansion addressing all identified gaps from test analysis.

**Changes made:**

- Fixed missing `performMockLogin` function in `helpers/auth.ts` - added implementation that wraps existing `loginWithTestUser` with role parameter support for future role-based testing
- Created `authenticated-flows.spec.ts` - Tests for post-login navigation, data entry workflows, feature usage, department-specific workflows, and UI persistence
- Created `session-management.spec.ts` - Comprehensive session testing including logout, persistence, expiration, security, cross-tab behavior, and recovery
- Created `api-mocking.spec.ts` - Network request interception, monitoring, response validation, offline handling, optimization, security, and performance testing
- Created `permissions-roles.spec.ts` - Role-based access control testing for admin, operator, manager, and control-room roles with cross-department isolation
- Created `error-states.spec.ts` - Network error handling, API error messages, form validation errors, page errors, component error boundaries, auth errors, data loading errors, and recovery
- Created `data-entry-validation.spec.ts` - Edge case validation for text, numeric, date, email, password inputs, selects, checkboxes, form submission, copy-paste, and auto-save
- Created `responsiveness.spec.ts` - Multi-viewport testing (mobile 375x667, tablet 768x1024, desktop 1280x720, large desktop 1920x1080), dynamic resizing, responsive images/media, navigation, tables, forms, font scaling, and edge case viewports
- Created `accessibility.spec.ts` - Semantic HTML, ARIA attributes, keyboard navigation, screen reader compatibility, color contrast, form accessibility, table accessibility, motion preferences, touch targets, and automated accessibility checks

**Next agent:** The E2E test suite now has comprehensive coverage across all previously identified gaps. Tests are designed to be resilient and handle various edge cases. Run `pnpm test:e2e` to execute all tests. Some tests may require specific user roles or test data to be fully effective - consider setting up test users with different roles (admin, operator, manager, control-room) for complete coverage.

- [2026-11-05T10:06:24Z] Enforced Biome 2.5.14 official CI/Turborepo root tasks (//#check, //#check:fix, //#lint:ci), strict rules (noUnusedVariables: error, noUnusedImports: error, domains.types: recommended), Rspack 2.x parity audit, and Turbopack Rust React Compiler + persistent FS cache.

## 2026-11-06T09:44:00+02:00 - Galen Relational Spatial Layout Engine for Playwright (`e2e/helpers/galen-layout.ts`)

- **Phase 1 (Comprehension)**: Distill the relational layout specification model from `galenframework/galen` (`above`, `below`, `left-of`, `right-of`, `inside`, `aligned horizontally/vertically`, `no-overlap`) into a native TypeScript + Playwright helper without Java/Selenium dependencies.
- **Phase 2 (Evidence)**: Inspected `e2e/visual/layout.spec.ts` and `e2e/playwright.config.ts`.
- **Phase 3 (Design)**: Created `e2e/helpers/galen-layout.ts` exporting pure bounding-box evaluators (`evaluateAbove`, `evaluateBelow`, `evaluateLeftOf`, `evaluateRightOf`, `evaluateInside`, `evaluateAlignedHorizontally`, `evaluateAlignedVertically`, `evaluateNoOverlap`) and Playwright's fluent `expectGalenLayout(locator)` assertion builder; wired into `e2e/visual/layout.spec.ts`.
- **Phase 4 (Criticism)**: Kept all evaluators pure and deterministic with explicit pixel diagnostic messages.
- **Phase 5 (Contract)**: Created `e2e/helpers/galen-layout.ts` and updated `e2e/visual/layout.spec.ts`.
