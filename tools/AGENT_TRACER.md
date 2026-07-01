# AGENT_TRACER — tools

## 2026-06-29T00:00:00Z

**Purpose:** Monorepo AI separation — removed `tools/n8n-mcp` and `n8n-mcp` from `TAGGED_TOOLS` in `apply-project-tags.cjs`.

**Handoff:** AI/agent orchestration tooling is no longer part of this monorepo.

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
