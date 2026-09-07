# apps/portal/app/api/ml/

## Responsibility

Parent route group for portal ML API endpoints.

## Design

Next.js App Router API group under `apps/portal/app/api/ml/`. Contains feature-specific route folders, each exposing JSON endpoints for ML-backed portal data.

## Flow

Requests are routed to subfolder handlers. Each handler is a standalone server-side route that returns JSON responses.

## Integration

Part of the portal API surface. ML routes use the Supabase server client and depend on portal auth/session handling.
