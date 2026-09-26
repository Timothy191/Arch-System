# apps/portal/app/api/audit/

## Responsibility

- Exposes audit report data through a single API route.
- Serves the current or a named audit log's markdown reports as JSON.

## Design

- One handler: `GET`.
- Reads from the filesystem rather than a database or CMS.
- Resolves the audit root by walking up from `process.cwd()` looking for `documentation/03-audit-reports`; falls back to `../../documentation/03-audit-reports`.
- Loads `manifest.json` if present; otherwise returns an empty manifest.
- Selects the target directory from `?log=<id>` or `latest`.
- Reads report files directly with `fs.readFileSync`; missing files return a placeholder string.

## Flow

- Request arrives with optional `?log=<id>`.
- Resolve `auditRoot`, then `manifest.json`.
- Choose `targetDir` based on `logId`.
- Read `results.md`, `required-actions.md`, `design-report.md`, and `rls-report.md`.
- Return JSON with `manifest`, `activeLogId`, and report contents.

## Integration

- Consumed by portal frontend code that displays audit reports.
- Depends on the repository-local `documentation/03-audit-reports` directory structure.
- No direct database, auth, or external service integration in this route.
