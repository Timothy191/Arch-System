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
  - Documented tools/ subdirectory handling rationale - explaining why only specific subdirectories (wiki-viewer, preflight-mcp, policy) are tagged
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

## 2026-09-08T12:35:00Z

**Purpose:** Integrated Biome fast check/format/lint, Turborepo pipeline tasks, Next.js standalone optimization, and Vercel/Streamdown tooling.

**Changes made:**

- Root `biome.json` added with sub-second lint and format coverage across all 25 workspace projects.
- Added `check:fast`, `check:fast:fix`, `lint:fast`, and `format:fast` in `package.json` and `Makefile`.
- Added `turbo.json` declarative pipeline configuration.
- Fixed duplicate keys in `packages/supabase/package.json` and type safe `ReturnType<typeof setTimeout>` in `packages/ui/src/components/ui/context-*`.
- Evaluated and integrated Vercel AI SDK and Streamdown for streaming LLM markdown rendering.

**Next agent:** Use `make check-fast` for sub-second pre-commit formatting and lint sanity across all packages.

## 2026-10-05T11:22:00Z

**Purpose:** Hardened the repository audit runner during a Vercel production-readiness audit.

**Changes made:**

- Replaced the unsupported `pnpm audit --ignore-decls` invocation with the supported audit command.
- Increased the audit timeout and made audit errors and high-severity dependency findings fail closed and appear in reports/actions.
- Corrected audit completion messaging so a failing dependency gate cannot be described as successful.

**Verification:** Dependency audit now reports two remaining high-severity advisories instead of silently passing. The full portal build passed.

**Next agent:** Keep dependency findings deployment-blocking. Revisit the `http-cache-semantics` and `braces` advisories when upstream patched releases are available.

## 2026-10-05T12:23:00Z

**Purpose:** Reassessed the dependency audit and historical database warnings against current package and migration sources.

**Changes made:**

- Updated the dependency audit gate to block on production dependency findings while explicitly reporting high/critical workspace-only advisories as non-blocking warnings.
- Pinned `http-cache-semantics` to the fixed 4.3.0 release and updated Sass to 1.105.1, removing the vulnerable braces chain from production/build dependencies.
- Moved the theme's Tailwind plugins to development dependencies; the consuming portal already declares its build-time Tailwind dependencies.
- The current full-workspace audit retains one high `braces` advisory, only through root `@changesets/cli` release tooling; no patched braces release is available in the registry.
- Scanned 86 dollar-quoted migration function declarations; all currently declare `SET search_path`. The historical 85-warning summary is not reproduced by the current migration sources.

**Verification:** `pnpm audit --prod --audit-level=high`, `pnpm quality`, `pnpm agent:verify`, portal production build, and Vercel preflight passed. Audit report `log-131(26-10-05)` records zero production dependency blockers and one non-production warning.

**Database review:** After the owner confirmed the offline migration 165 had been applied and authorized renumbering, moved the duplicate `168_offline_crdt_mutation_log_and_smr.sql` to `171_offline_crdt_mutation_log_and_smr.sql`; left the deleted 165 source untouched. The migration sequence now has no duplicate numbers, and database rollback-safety/RLS checks passed.

## 2026-10-06: Deployment Audit Severity and Dependency Fixes

- Added root pnpm overrides for `proxy-addr@2.0.8` and `@opentelemetry/auto-instrumentations-node@0.80.0`; the first removes the critical proxy advisory, and the latter removes eight production telemetry advisories.
- Fixed dependency gate classification in `tools/audits/run-audit.cjs`: use parsed high/critical severities as blockers, keep low/moderate production advisories and non-production high/critical findings visible as warnings, and fail closed when audit JSON is unavailable.
- Verified `pnpm audit:suite`: exits successfully with WARN, zero high/critical production findings, one moderate production advisory (`sprintf-js`, no patched upstream release), and the pre-existing high `braces` advisory in non-production tooling.
- `pnpm quality` initially failed because pnpm returned a nonzero JSON-audit exit for moderate advisories despite `--audit-level=high`; rerun the full suite after this correction.

## 2026-10-06: Archived Skill Audit False Positive

- The Agentic Content Audit counted every top-level directory in `.agents/skills` as an active skill, so the cleanup tool's `.archived` container triggered a false `MISSING_SKILL_MD` critical violation.
- Extracted active skill directory filtering into `active-skill-directories.cjs`; dot-prefixed archive containers are excluded, while normal active directories without `SKILL.md` continue to be audited and fail.
- Added three Node regression tests and included them in `audit:compliance`.
- Verified: targeted audit tests pass; agentic audit checks 52 active skills with zero critical findings; `pnpm quality` exits 0 with WARN for remaining dependency advisories; `pnpm agent:verify` passes; portal production build passes after removing the route runtime option incompatible with Cache Components.
