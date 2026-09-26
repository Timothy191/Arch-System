# apps/portal/ (Next.js 16 Web Application)

## Responsibility

Unified web dashboard for Plantcor mining operations. Serves interactive operator dashboards, control room SCADA views, engineering breakdown trackers, and access management tools.

## Design

- **Framework**: Next.js 16 App Router running with Turbopack and React 19.
- **Route Organization**:
  - `(auth)`: Login, password recovery, session handling.
  - `(departments)`: Department dashboards (`/drilling`, `/production`, `/access-control`, `/access-card-actions`, `/engineering`, `/control-room`).
  - `hub/`: Multi-department central hub with shift handover and KPI overviews.
  - `overview/`: System topology map built with React Flow.
  - `api/`: Health (`/api/health`), webhooks, telemetry ingestion endpoints.
- **Security & Middleware**: `proxy.ts` edge router invoking `server/proxy.ts` for Redis auth profile verification.

## Flow

1. Browser requests route -> Edge middleware (`proxy.ts`) authenticates user via Supabase cookie JWT and Redis employee cache.
2. Protected pages load Server Component layouts, fetching initial data via `@repo/supabase`.
3. Client components hydrate and establish WebSocket CDC connections for real-time equipment telemetry and alert broadcasting.

## Integration

- Imports UI primitives and widgets from `@repo/ui` and `@repo/theme`.
- Consumes domain modules from `libs/features/*` (`departments/ui`, `hub/ui`, `auth/ui`).
- Communicates with PostgreSQL database and auth via `@repo/supabase`.
- Leverages `@repo/errors` for structured domain error responses.
