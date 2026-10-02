# Specification: Automated Versioning & Build Telemetry

## Overview
Arch-System implements a single-source-of-truth automated versioning pipeline across its federated Turborepo workspace. The versioning manager (`tools/scripts/version-manager.mjs`) synchronizes root metadata with `apps/portal`, generates build-time telemetry constants, and powers the public health/version API.

## Architecture

```
[ Root package.json ] <───> [ tools/scripts/version-manager.mjs ]
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
[ apps/portal/package.json ]   [ version.json ]        [ apps/portal/lib/version.generated.ts ]
                                                                    │
                                                                    ▼
                                                       [ apps/portal/lib/version.ts ]
                                                                    │
                                        ┌───────────────────────────┴───────────────────────────┐
                                        ▼                                                       ▼
                             [ apps/portal/app/layout.tsx ]                          [ /api/version route ]
                             [ apps/portal/app/(auth)/login ]                        [ Status HUD / Telemetry ]
```

## CLI Commands

| Command | Purpose |
|---|---|
| `pnpm version:status` | Inspect current root and portal versions, commit SHA, and sync state. |
| `pnpm version:sync` | Synchronize versions across all packages and write `version.generated.ts`. |
| `pnpm version:patch` | Bump patch version (e.g. `1.5.1` -> `1.5.2`) and update build metadata. |
| `pnpm version:minor` | Bump minor version (e.g. `1.5.1` -> `1.6.0`) for feature releases. |
| `pnpm version:major` | Bump major version (e.g. `1.5.1` -> `2.0.0`) for milestone overhauls. |

## API Specification: `GET /api/version`
- **Response Format:** JSON
- **Headers:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, `X-App-Version: <version>`
- **Payload Schema:**
  ```json
  {
    "status": "nominal",
    "name": "Arch-System Portal",
    "version": "1.5.1",
    "commit": "42065a8",
    "commitFull": "42065a8d0e95a1868d5f6407893a4d071728ddf7",
    "buildTimestamp": "2026-10-02T06:34:36.987Z",
    "releaseName": "Arch OS v1.5.1 // Industrial Command",
    "systemCodename": "Industrial Telemetry Bus",
    "environment": "production",
    "nodeVersion": "v24.x"
  }
  ```
