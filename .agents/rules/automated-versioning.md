# Automated Versioning Invariants & Release Rules

## Core Principles
1. **Single Source of Truth (SSoT):**
   - The workspace version lives in root `package.json` and is mirrored to `apps/portal/package.json` and `version.json`.
   - Never hardcode version strings in React components or pages (e.g., `'2.0.0.1'` or `'2.4.1'`). Always import `APP_VERSION` from `@/lib/version`.
   - The `/api/version` endpoint exposes the running version and commit metadata for health checks, telemetry, and uptime audits.

2. **Automated Version Bumps at Major Milestones:**
   - Whenever completing a major system release, significant architectural milestone, or major feature integration, bump the version:
     - `pnpm version:major` for breaking architectural changes, major UI overhauls, or new platform milestones (e.g. `v2.0.0`).
     - `pnpm version:minor` for significant new features, new departmental integrations, or new dashboard components (e.g. `v1.6.0`).
     - `pnpm version:patch` for security fixes, bug fixes, or minor tuning (e.g. `v1.5.2`).
     - `pnpm version:sync` to reconcile metadata and regenerate build constants.

3. **Build Pipeline Integration:**
   - Every build (`pnpm build`, `pnpm build:vercel`) automatically calls `node tools/scripts/version-manager.mjs sync` via `scripts/sync-assets-smart.cjs`.
   - This bakes the current commit SHA, branch, and build timestamp into `apps/portal/lib/version.generated.ts` before Turbopack compiles the portal.
