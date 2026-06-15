---
title: Database/Backend Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [database, backend, architecture, decision]
sources:
  [wiki/concepts/supabase-local-dev.md, wiki/concepts/rls-policy.md, CLAUDE.md]
confidence: high
---

# Database/Backend Comparison: Supabase vs Firebase vs Self-Hosted PostgreSQL

## What is Being Compared

Selection of backend-as-a-service platform for a mining operations portal requiring real-time data, authentication, and row-level security.

## Dimensions of Comparison

| Dimension             | Supabase                    | Firebase (GCP)          | Self-Hosted PostgreSQL + Custom Auth |
| --------------------- | --------------------------- | ----------------------- | ------------------------------------ |
| **Database**          | PostgreSQL (managed)        | Firestore (NoSQL)       | PostgreSQL (full control)            |
| **Real-time**         | Native subscriptions        | Firestore listeners     | Custom WebSocket/SSE                 |
| **Authentication**    | Built-in (GoTrue)           | Firebase Auth           | Custom implementation                |
| **RLS/Security**      | PostgreSQL RLS policies     | Firestore rules         | Manual authorization layer           |
| **Storage**           | Built-in (S3-compatible)    | Firebase Storage        | MinIO/S3 integration                 |
| **Edge Functions**    | Deno-based                  | Cloud Functions         | Custom serverless                    |
| **Local Development** | CLI with Docker             | Emulators               | Full manual setup                    |
| **Vendor Lock-in**    | Moderate (open source core) | High (Google ecosystem) | None                                 |
| **Pricing**           | Generous free tier          | Pay-as-you-go           | Infrastructure costs only            |
| **Data Residency**    | Configurable                | US-centric              | Fully controllable                   |

## Project Implementation

The portal uses **Supabase** with:

- **Database**: PostgreSQL 15 with 16 migrations in `packages/database/migrations/`
- **Auth**: GoTrue-based with custom `handle_new_user()` trigger
- **RLS**: Every table has `ENABLE ROW LEVEL SECURITY` with department-scoped policies
- **Real-time**: `supabase.channel().on('postgres_changes')` for live dashboards

```sql
-- Example RLS policy pattern
CREATE POLICY "Users can view their department's machines"
ON machines FOR SELECT
USING (
  department_id = auth.user_department_id()
  OR auth.is_admin()
  OR department_id = ANY(auth.has_department_access())
);
```

## Why Supabase Was Chosen

1. **PostgreSQL** — Relational data fits mining operations schema (departments, machines, logs, relations)
2. **RLS** — Row-level security enforces multi-tenant isolation at database level
3. **Real-time** — Native subscriptions without WebSocket boilerplate
4. **Local dev** — `supabase start` gives full local stack
5. **Open source** — Can self-host if vendor situation changes
6. **Auth integration** — `auth.users` links to `employees` table seamlessly

## Why Not Firebase

Firestore's NoSQL model would require:

- Denormalized data for department/machine relationships
- Complex client-side joins
- Less mature TypeScript support
- Vendor lock-in to Google ecosystem

Mining operations data is inherently relational (machines belong to departments, logs reference machines).

## Why Not Self-Hosted

Self-hosting PostgreSQL + Keycloak/Auth0 would give full control but require:

- DevOps overhead (backups, scaling, security patches)
- Custom real-time implementation (WebSocket management)
- Auth system maintenance
- RLS policy engine implementation

For a lean team, Supabase's managed service is operational excellence.

## Verdict

**Supabase is the correct choice** for a relational data model with real-time needs and a lean operations team. The RLS policies provide security that would be error-prone to implement manually.

## Related

- [[supabase-local-dev]] — Local development workflow
- [[rls-policy]] — RLS patterns and security definer functions
- [[database-schema]] — Full schema documentation
