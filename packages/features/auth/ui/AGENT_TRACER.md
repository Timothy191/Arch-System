# Agent Tracer - @repo/feature-auth-ui

## 2026-06-24 - Pilot Feature Migration (Auth Feature UI)

- **Purpose**: Decompose the domain features currently inside `apps/portal/features/` into dedicated, domain-encapsulated Nx libraries as per Frontend Architecture Audit recommendations.
- **Changes**:
  - Generated `@repo/feature-auth-ui` inside `packages/features/auth/ui/` with project, eslint, tsconfig, and package configurations.
  - Migrated `LoginForm.tsx`, `LoginForm.test.tsx`, and `RefractionGlow.tsx` from `apps/portal/features/auth/components/` to `packages/features/auth/ui/src/`.
  - Registered exports in `packages/features/auth/ui/src/index.ts`.
- **Next Steps**: None. Pilot feature library migration is completed and verified.

## 2026-06-24 - Auth Utils & Data-Access Libraries

- **Purpose**: Create `@repo/feature-auth-utils` and `@repo/feature-auth-data-access` as companion libraries to `@repo/feature-auth-ui`, following the feature-sliced design pattern.
- **Changes**:
  - Created `packages/features/auth/utils/src/` with `redirect.ts` (isInternalRedirect, isValidPageRedirect, resolveSafeRedirect) and `sso.ts` (validateSsoUrl).
  - Created `packages/features/auth/data-access/src/` with `login.ts` (loginWithCredentials), `telemetry.ts` (pushAuthTelemetry), and `types.ts` (LoginResult).
  - Both packages registered in Nx with proper project tags (`scope:package`, `scope:auth`).
- **Next Steps**: None. Manual patches applied and verified.

## 2026-06-24 - Manual Post-Scaffold Patches

- **Purpose**: Wire up cross-package dependencies, update portal configs, and register all three auth packages in workspace tooling.
- **Changes**:
  - Added `@repo/feature-auth-utils` and `@repo/feature-auth-data-access` as dependencies of `@repo/feature-auth-ui`.
  - Updated `project.json` tags to include `scope:auth` and `type:ui`.
  - Refactored `LoginForm.tsx` to import `resolveSafeRedirect`/`validateSsoUrl` from `@repo/feature-auth-utils` and `loginWithCredentials`/`pushAuthTelemetry` from `@repo/feature-auth-data-access`, removing all inline equivalents.
  - Added `moduleNameMapper` entries in `apps/portal/jest.config.js` for both new packages.
  - Added both packages to `transpilePackages` in `apps/portal/next.config.mjs`.
  - Appended four `dependencyConstraints` entries in `nx.json` for `scope:auth`, `type:util`, `type:data-access`, and `type:ui`.
  - Extended `tools/apply-project-tags.cjs` to recursively scan `packages/features/*/*`.
  - Registered all three auth packages in `config/tools/knip.json` workspace entries.
  - Ran `pnpm install` and verified `type-check`, `test`, `lint`, and `build` pass.

## 2026-06-24 - Enforced Architecture & Dependency Boundaries

- **Purpose**: Break direct package dependencies from `@repo/feature-auth-ui` on `@repo/feature-auth-data-access` to comply with layer dependency constraints.
- **Changes**:
  - Created `login-types.ts` in `packages/features/auth/ui/src/` to define `LoginCredentialsResult` and `LoginFormProps`.
  - Refactored `LoginForm.tsx` to receive `loginWithCredentials` and `pushAuthTelemetry` via props instead of direct imports.
  - Refactored `LoginForm.test.tsx` to use a `renderLoginForm()` helper that injects mock functions delegating to mocked fetch operations.
  - Removed dependency `@repo/feature-auth-data-access` from `packages/features/auth/ui/package.json`.
  - Tightened dependency constraints in `nx.json` to prevent future violations.
  - Created `apps/portal/app/(auth)/login/LoginFormContainer.tsx` to inject the dependency.
  - Updated `apps/portal/app/(auth)/login/page.tsx` to consume the container.
- **Next Steps**: Repeat this design pattern for other features (`access-control`, `departments`, `hub`, `admin`).

