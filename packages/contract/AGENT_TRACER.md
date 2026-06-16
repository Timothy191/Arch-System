# Contract Package Agent Tracer

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
   - 30 paths generated successfully with no YAML errors

3. **Offline Validation Workflow**:
   - No longer requires running dev server
   - No longer requires authentication
   - Fully offline and CI-friendly
   - Works with committed spec file

### Updated Workflow

The new contract validation workflow:

1. **Portal generates spec**: `pnpm --filter portal generate-openapi-spec` (or automatically via build)
2. **Contract generates types**: `pnpm --filter @repo/contract openapi:generate` (reads from local spec)
3. **Contract validates**: `pnpm --filter @repo/contract openapi:validate`

This workflow is fully offline and can run in CI without any external dependencies.

### What the Next Agent Should Know

- **Spec File**: `packages/contract/openapi.generated.json` is the source of truth (committed)
- **Generated Types**: `src/generated/openapi.types.ts` is generated and in .gitignore
- **No Auth Required**: Validation now works offline without authentication
- **Build Integration**: Portal build script automatically regenerates spec
- **CI Integration**: Can now add spec drift check and contract validation to CI
- **Status**: All 28 API routes have JSDoc annotations (100% coverage)
- **Next Steps**: Add CI integration for spec drift check and contract validation

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
```

### See Also

- `apps/portal/AGENT_TRACER.md` for spec generation implementation details
- Previous authentication challenge fully resolved

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
