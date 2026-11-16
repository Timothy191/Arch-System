# api/health/vibemon/

## Purpose

Optional health and synchronization probe (`GET /api/health/vibemon`) for the VibeMon multi-agent telemetry sink and remote MCP workspace (`vibemon.dev/api/mcp`).

## Exports & Routes

- `route.ts` → `GET` (validates response against `vibemonHealthResponseSchema` from `@repo/contract`, always returning HTTP `200` with zero secret exposure)
- `route.test.ts` → Node Jest test suite covering local-only and remote MCP telemetry states
