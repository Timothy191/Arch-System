# apps/portal/app/api/c66/

## Responsibility

Implements the C66 badge-scanner access-control API. It authenticates scanner hardware, validates badge payloads, resolves personnel/visitor identity, and records access attempts.

## Design

- Single `POST` handler wrapped with `withBodyLimit` and CORS application.
- Scanner auth is header-based: `x-scanner-token` must match `SCANNER_API_KEY`; `x-scanner-source` must be in `ALLOWED_SCANNER_SOURCES`.
- Request body is validated against `scannerBadgeSchema`; accepted code fields are `code`, `barcode`, `barcodeData`, `data`, and `qr_code`.
- Access decisions are based on badge state (`badges.is_active`) and linked entity status (`personnel.status` or `visitors.status`).
- All outcomes, including denials, are written to `access_logs` via `logAccess`.

## Flow

1. Reject requests with missing/invalid scanner token (`401`) or disallowed scanner source (`403`).
2. Parse and validate the badge code payload; reject empty codes (`400`).
3. Look up the badge by `qr_code`; if missing, log denial and return `404`.
4. If the badge is inactive, log denial and return `403`.
5. Resolve the linked personnel or visitor name and authorization status.
6. Log the access event with grant/deny outcome and return `{ success, name, message }`.

## Integration

- Uses `createServiceRoleClient` from `@repo/supabase/service-role` for direct DB access.
- Depends on `@repo/contract/schemas/scanner.schema` for request validation.
- Writes audit events to `access_logs`; reads from `badges`, `personnel`, and `visitors`.
- Tests in `route.test.ts` focus on scanner auth bypass prevention and source/token enforcement.
