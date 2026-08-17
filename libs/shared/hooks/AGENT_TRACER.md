# @repo/shared/hooks Agent Tracer

## 2026-08-17: Add @types/node dependency to fix TypeScript check

### Purpose

Fix TypeScript build failure (`TS2580: Cannot find name 'process'`) in `src/client-telemetry.ts`.

### Changes Made

1. Added `"@types/node": "catalog:"` to `devDependencies` in `libs/shared/hooks/package.json`.

### What the Next Agent Should Know

- `shared-hooks` requires `@types/node` for accessing `process.env` in client telemetry logging.
