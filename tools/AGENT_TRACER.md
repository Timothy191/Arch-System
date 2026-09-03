# AGENT_TRACER — tools

## 2026-06-24T12:00:00Z

**Purpose:** Enhanced `apply-project-tags.cjs` script with improved error handling, documentation, and integration.

**Changes made:**

- Improved error handling in `apply-project-tags.cjs` for robust package.json parsing:
  - Added try-catch blocks around JSON.parse() calls for both project.json and package.json
  - Added detailed error messages with file paths when parsing fails
  - Gracefully skips projects with malformed configuration files instead of failing the entire script
- Added comprehensive inline documentation to `apply-project-tags.cjs`:
  - Documented complete tag vocabulary (scope:app, scope:app:<name>, scope:package, scope:package:<name>, scope:package:db, scope:package:db-internal, scope:tool)
  - Documented tools/ subdirectory handling rationale - explaining why only specific subdirectories (wiki-viewer, n8n-mcp, preflight-mcp, policy) are tagged
  - Added usage instructions and reference to tools/policy-compiler.cjs for canonical tag vocabulary
- Integrated automatic tag generation into pre-commit hooks:
  - Added lint-staged configuration in root package.json to run `node tools/apply-project-tags.cjs` whenever project.json files are modified
  - Ensures project tags stay synchronized with directory structure automatically

**Next agent:** The `apply-project-tags.cjs` script now has robust error handling and comprehensive documentation. When modifying this script, maintain the inline documentation for tag vocabulary and tools/ subdirectory handling. The script is automatically run via lint-staged when project.json files change, ensuring tags stay up-to-date. For reference on the canonical tag vocabulary, see tools/policy-compiler.cjs.

## 2026-09-02T10:04:00Z

**Purpose:** Synthesized `tools/onboard.cjs` diagnostic CLI and streamlined monorepo onboarding guide in `docs/ONBOARDING.md`.

**Changes made:**
- Created `tools/onboard.cjs` diagnostic suite with automated checks for:
  - Node engine (`>=22`) and Volta (`24.15.0`)
  - pnpm workspace package manager (`9.15.9`)
  - Docker daemon and local Supabase container reachability
  - `.env` variable key alignment against `apps/portal/env/.env.example`
  - Architecture policies (`apply-project-tags.cjs` + `policy-compiler.cjs --check`)
  - Fast sub-second feature hook unit test sanity
- Added `"onboard": "node tools/onboard.cjs"` to root `package.json`.
- Updated `docs/ONBOARDING.md` with complete 15-minute quickstart, sub-second testing patterns, and dependency graph navigation.

**Next agent:** The `pnpm onboard` command is registered as the canonical entry point for local and agent workspace validation. Any new required environment variables in `apps/portal/env/.env.example` will automatically be validated by this tool.
