# apps/portal/app/api/codebase-maps/

## Responsibility

- Serves generated codebase map markdown files through a JSON API.
- Resolves the `codebase-maps` output directory dynamically from the current working directory.
- Returns a manifest plus the requested map file content for a given log id and file key.

## Design

- Single `GET` handler; no mutation or write path.
- Directory resolution walks up from `process.cwd()` to find `codebase-maps`, with a fallback to `../../codebase-maps`.
- Inputs are query params: `log` defaults to `latest`, `file` defaults to `route-feature-architecture.md`.
- Reads `manifest.json` if present; otherwise returns an empty manifest.
- Reads the target markdown file from `<logDir>/<fileKey>` or falls back to the maps root.
- Missing files return a simple unavailable message instead of an error.

## Flow

1. Parse `log` and `file` query params.
2. Resolve `mapsRoot` by searching upward for `codebase-maps`.
3. Load `manifest.json` from `mapsRoot` if it exists.
4. Build `targetDir` from `mapsRoot/<logId>`; if missing, use `mapsRoot`.
5. Read `<fallbackDir>/<fileKey>`; if missing, return placeholder text.
6. Respond with JSON containing `manifest`, `activeLogId`, `activeFileKey`, and `content`.

## Integration

- Consumed by frontend or tooling that renders codebase map documentation.
- Depends on generated artifacts under `codebase-maps/`, especially `manifest.json` and per-log markdown files.
- No direct database, auth, or external service integration in this route.
