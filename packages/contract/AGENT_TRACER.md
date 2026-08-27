# Contract Package Agent Tracer

## 2026-08-27: Compliance Audit Contract Schemas & Drift Detection

- **Purpose**: Add canonical Zod contracts for compliance audit runs (`complianceAuditRunSchema`, `createComplianceAuditRunSchema`) and support automated schema drift detection.
- **Changes**:
  - `packages/contract/src/schemas/compliance-audit.schema.ts`: Created compliance audit schemas and types.
  - `packages/contract/src/index.ts`: Barrel exports for `complianceAuditRunSchema`, `createComplianceAuditRunSchema`, `ComplianceAuditRun`, and `CreateComplianceAuditRunInput`.
  - Added `tools/audit-contract-drift.cjs` to enforce continuous 1:1 synchronization between `@repo/database` and `@repo/contract`.
- **Verification**: `pnpm --filter @repo/contract test`, `pnpm --filter @repo/contract type-check`, and `pnpm audit:drift` pass 100% green.

## 2026-08-24: Multi-Site Shift Report Schemas & Types

- **Purpose**: Export canonical Zod schemas and TypeScript types for multi-site shift compilation across BKF, EXT, PLANT, and Bredell Workshop.
- **Changes**:
  - `packages/contract/src/schemas/multi-site-production.schema.ts`: Created `multiSiteShiftReportSchema`, `operationalStatusEnum`, `excavatorHaulSchema`, `dozerRolloverEntrySchema`, `fleetSmuEntrySchema`, `breakdownReportEntrySchema`, `ancillaryReportEntrySchema`, and `bredellReportEntrySchema`.
  - `packages/contract/src/types/multi-site-production.types.ts`: Derived and exported TypeScript interfaces.
  - `packages/contract/src/index.ts`: Barrel exports for schemas and types.
  - `packages/contract/src/index.test.ts`: Added validation unit test.
- **Verification**: `pnpm --filter @repo/contract test` and `pnpm --filter @repo/contract build` pass with 0 errors.

## 2026-08-18: Form Types and Schema Barrel Export Consolidation

- **Purpose**: Export missing derived types (`CreateBreakdownInput`, `BookOutInput`, `DirectCheckoutInput`, `MonthlyReportInput`, `UpdateMachineSiteInput`) from the contract package, aligning index type exports with their schema counterparts in `form.schema.ts`.
- **Changes**:
  - `packages/contract/src/types/form.types.ts`: Defined derived Zod types.
  - `packages/contract/src/index.ts`: Exported new derived types.
- **Verification**: `pnpm quality` and `pnpm type-check` pass successfully across all workspace projects.

## 2026-08-18: Export Drilling Contract Types and Schemas

- **Purpose**: Fix type-check compilation errors in the portal where `drillingDailyLogSchema` and `DrillingDailyLogFormValues` were imported from `@repo/contract` but not exported by its index barrel.
- **Changes**:
  - `packages/contract/src/index.ts`: Exported `drillingDailyLogSchema` and `DrillingDailyLogFormValues`.
- **Additional Cleanup & Verification**:
  - Added `packages/contract/src/index.test.ts` to explicitly validate accessibility of `drillingDailyLogSchema`, `DrillingDailyLogFormValues`, `dailyLogSchema`, `dozerRollSchema`, and `DozerRollFormValues`.
  - Added `packages/contract/jest.config.js` and updated package test script.
  - Removed duplicate `DozerRollForm.tsx` and all redundant control-room components from `apps/portal/features/departments/components/control-room/`.
  - Updated `apps/portal` to import control room components from `@repo/departments/ui`.
- **Verification**: `pnpm quality` and `pnpm test` pass 100% green.

## 2026-06-16: Offline Contract Validation with Static OpenAPI Spec

### Purpose

Resolve the authentication challenge for contract validation by implementing offline spec generation. The portal now generates a static OpenAPI spec file from JSDoc annotations using swagger-jsdoc, eliminating the need to fetch from `/api/doc` endpoint which requires authentication.

### Changes Made

1. **Updated openapi:generate script**:
   - Modified `openapi:generate` to use `SPEC_FILE` environment variable
   - Now reads from `./openapi.generated.json` instead of fetching from `/api/doc`
   - Command: `SPEC_FILE=./openapi.generated.json node scripts/generate-openapi-types.js`
   - Updated in package.json: `"openapi:generate": "SPEC_FILE=./openapi.generated.json node scripts/generate-openapi-types.js"`

2. **Static OpenAPI Spec**:
   - Portal generates spec at `packages/contract/openapi.generated.json`
   - Generated using swagger-jsdoc from JSDoc annotations
   - Committed to repository as source of truth
   - 35 endpoint operations across 30 paths generated successfully

3. **Fixed validate-contract.js**:
   - Updated to read OpenAPI spec JSON directly instead of parsing TypeScript
   - Now reads from `openapi.generated.json` instead of generated types
   - Properly extracts all endpoints from `spec.paths` object
   - Added detailed output showing all found endpoints
   - Validation now successfully finds all 35 endpoint operations

4. **Zod Schema Generation**:
   - Installed `openapi-zod-client` and `zod` packages
   - Added `generate-zod` script to generate Zod schemas from OpenAPI spec
   - Generated `src/generated/schemas.ts` with Zod schemas for all endpoints
   - Added `@zodios/core` dependency for schema generation

5. **Deep Contract Validation Test**:
   - Created `src/generated/health-response-schema.ts` with extracted Zod schema for `/api/health`
   - Created `scripts/test-contract-health.js` for runtime contract validation
   - Test calls live `/api/health` endpoint and validates response against Zod schema
   - Added `test:contract:health` script to package.json

6. **Offline Validation Workflow**:
   - No longer requires running dev server for spec generation
   - No longer requires authentication
   - Fully offline and CI-friendly for spec generation
   - Runtime tests require running dev server (expected for contract validation)

### Updated Workflow

The new contract validation workflow:

1. **Portal generates spec**: `pnpm --filter portal generate-openapi-spec` (or automatically via build)
2. **Contract generates types**: `pnpm --filter @repo/contract openapi:generate` (reads from local spec)
3. **Contract generates Zod schemas**: `pnpm --filter @repo/contract generate-zod`
4. **Contract validates**: `pnpm --filter @repo/contract openapi:validate` (reads spec directly)
5. **Runtime contract test**: `pnpm --filter @repo/contract test:contract:health` (requires running dev server)

Steps 1-4 are fully offline. Step 5 requires a running dev server for deep validation.

### What the Next Agent Should Know

- **Spec File**: `packages/contract/openapi.generated.json` is the source of truth (committed)
- **Generated Types**: `src/generated/openapi.types.ts` is generated and in .gitignore
- **Zod Schemas**: `src/generated/schemas.ts` is generated and in .gitignore
- **No Auth Required**: Spec generation and validation work offline without authentication
- **Build Integration**: Portal build script automatically regenerates spec
- **CI Integration**: Can now add spec drift check and contract validation to CI
- **Status**: All 28 API routes have JSDoc annotations (100% coverage), 35 endpoint operations found
- **Schema Coverage Warnings**: Expected - the matching logic is simplistic. Zod schemas in @repo/contract don't necessarily map 1:1 to API endpoints. This can be improved later.
- **Deep Validation**: Runtime test validates actual API responses against Zod schemas derived from spec
- **Next Steps**: Add CI integration for spec drift check, contract validation, and runtime tests

### CI Integration Example

```yaml
- name: Check for spec drift
  run: |
    pnpm --filter portal generate-openapi-spec
    if git diff --exit-code packages/contract/openapi.generated.json; then
      echo "Spec is up to date"
    else
      echo "❌ openapi.generated.json is out of date"
      exit 1
    fi

- name: Validate contracts
  run: pnpm --filter @repo/contract openapi:generate && pnpm --filter @repo/contract openapi:validate

- name: Generate Zod schemas
  run: pnpm --filter @repo/contract generate-zod

- name: Runtime contract tests
  run: pnpm --filter portal dev & sleep 10 && pnpm --filter @repo/contract test:contract:health
```

### See Also

- `apps/portal/AGENT_TRACER.md` for spec generation implementation details
- Previous authentication challenge fully resolved

## 2026-06-16: Runtime API Contract Validation Middleware

### Purpose

Add runtime API request validation middleware (`withValidation`, `withQueryValidation`, `validateBody`) to `@repo/contract`, enabling Zod-schema-based validation for Next.js App Router API routes. Follows the same HOF pattern as `@repo/logger`'s `withLogging`.

### Changes Made

1. **Created `src/validation.ts`**:
   - `ValidationError` class with `statusCode` (400) and structured `z.ZodIssue[]`
   - `validateBody<T>(schema, request)` — parses request body JSON, validates against Zod schema, returns typed data or throws `ValidationError`
   - `withValidation<T>(schema, handler)` — HOF wrapping route handlers with body validation. Returns 400 `Response` with `{ error, issues }` on failure
   - `withQueryValidation<T>(schema, handler)` — HOF for URL search parameter validation (same pattern)
   - Uses `safeParse` for boundary-safe parsing with structured error output
   - Added `AGENT-TRACE` breadcrumb explaining the parse boundary design

2. **Updated `package.json`**:
   - Added `./validation` export entry pointing to `dist/validation.{js,d.ts}`

3. **Updated `src/index.ts`**:
   - Re-exported `ValidationError` from `./validation.js` for shared use

### What the Next Agent Should Know

- Import path: `@repo/contract/validation` (separate sub-path export from the barrel)
- Core exports: `validateBody`, `withValidation`, `withQueryValidation`, `ValidationError`
- The validation module uses standard Web API `Response.json()` (no Next.js dependency) since `@repo/contract` is a shared package
- The `withValidation` HOF catches `ValidationError` and returns JSON error responses; non-validation errors are re-thrown to the framework error boundary
- `withQueryValidation` parses URL params via `Object.fromEntries(url.searchParams.entries())` — flat key-value only, no nested query params
- A route handler that does both webhook detection and direct tag updates (like telemetry/push) should parse the body once in the orchestrator and only delegate the validated path to `withValidation`

---

## 2026-01-XX: OpenAPI Contract Validation Setup

### Purpose

Set up contract validation scripts to ensure API routes defined in the portal match the canonical contract schemas in @repo/contract. This enables automated validation that the OpenAPI specification (generated from JSDoc annotations) stays in sync with the Zod schema contracts used throughout the monorepo.

### Changes Made

1. **Added openapi-typescript dependency**:
   - Package: `openapi-typescript` (^7.13.0) added as devDependency
   - Enables generation of TypeScript types from OpenAPI specifications

2. **Created generate-openapi-types.js script**:
   - Location: `scripts/generate-openapi-types.js`
   - Fetches OpenAPI spec from `/api/doc` endpoint (or local file via SPEC_FILE env var)
   - Generates TypeScript types using openapi-typescript CLI
   - Saves output to `src/generated/openapi.types.ts`
   - Usage: `pnpm --filter @repo/contract openapi:generate`

3. **Created validate-contract.js script**:
   - Location: `scripts/validate-contract.js`
   - Validates that contract schemas match generated OpenAPI types
   - Checks for schema coverage and orphan endpoints
   - Usage: `pnpm --filter @repo/contract openapi:validate`

4. **Updated package.json scripts**:
   - Added `openapi:generate` script to generate types from OpenAPI spec
   - Added `openapi:validate` script to validate contract consistency

### What the Next Agent Should Know

- The validation script is intentionally simple for Phase 1 - it checks basic coverage between schemas and endpoints
- For robust validation in production, consider:
  - Using a proper TypeScript parser (like ts-morph) instead of regex
  - Implementing deep type comparison between Zod schemas and OpenAPI definitions
  - Adding schema property-by-property validation
- The generated types file (`src/generated/openapi.types.ts`) should be added to `.gitignore` as it's generated from the running API
- To run validation in CI, first generate types from a production API URL or cached spec file
- Current workflow: Run dev server → generate types → validate → add JSDoc annotations to uncovered endpoints → repeat
- **Status Update**: All 28 API routes now have JSDoc annotations (100% coverage achieved). The validation workflow can now focus on deep type equivalence checking rather than coverage gaps.
