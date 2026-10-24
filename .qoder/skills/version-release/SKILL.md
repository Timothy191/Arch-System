---
name: version-release
description: Bump or reconcile Arch-System version metadata at a release milestone. Use when shipping a major/minor/patch, when versions drift across package.json/version.json/version.generated.ts, or before a release verification; never hand-edit generated version files.
---

# Version Release

`tools/scripts/version-manager.mjs` is the single source of truth: root `package.json`, `apps/portal/package.json`, `version.json`, and the generated `apps/portal/lib/version.generated.ts`.

## 1. Inspect

```bash
pnpm version:status
```

Confirm `In Sync: YES` before bumping. If it reports drift, reconcile with `pnpm version:sync` instead of editing files.

## 2. Choose the bump (only at a real milestone)

| Scope | Command              | When                                                                     |
| ----- | -------------------- | ------------------------------------------------------------------------ |
| major | `pnpm version:major` | breaking architectural change, major UI overhaul, new platform milestone |
| minor | `pnpm version:minor` | significant feature or departmental integration                          |
| patch | `pnpm version:patch` | fix, security patch, minor tuning                                        |

`pnpm version:bump <major|minor|patch|prerelease|x.y.z>` takes an explicit target when the shorthand does not fit.

## 3. Never bypass the manager

- Do not edit `apps/portal/lib/version.generated.ts`, `version.json`, or either `package.json` version by hand; the hook blocks generated files. Regenerate with `pnpm version:sync` (the build also syncs before Turbopack compiles).
- Never hardcode a version string in a component or page. Import `APP_VERSION` from `@/lib/version`; `/api/version` exposes the running metadata.
- Changesets (`pnpm version-packages`, `pnpm release`) are for package publishing, not the workspace version.

## 4. Verify

```bash
pnpm version:status                      # In Sync: YES
pnpm --filter portal type-check
```

If the bump ships with code, run `/repo-verify quick` and widen to `full` before claiming release readiness.

## 5. Report

State the previous and new version, the bump scope and its reason, confirmation that all four mirrors are in sync, and the verification commands that passed. Do not claim a release is ready unless `pnpm version:status` shows `In Sync: YES`.
