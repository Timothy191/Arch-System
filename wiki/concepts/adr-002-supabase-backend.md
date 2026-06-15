---
title: "ADR-002: Supabase as Backend Platform"
created: 2026-05-15
updated: 2026-05-15
type: decision
status: accepted
tags: [adr, database, backend, decision]
sources: [wiki/comparisons/database-backend.md, CLAUDE.md]
confidence: high
---

# ADR-002: Supabase as Backend Platform

## Status

**Accepted** — Implemented May 2024

## Context

We needed a backend platform providing:

- Relational database for mining operations data
- Authentication system for multi-department users
- Real-time subscriptions for live dashboards
- Row-level security for data isolation
- Storage for documents and images
- Cost-effective hosted solution

## Decision

We will use **Supabase** as our primary backend platform.

### Key Components Used

1. **PostgreSQL** — Primary database (15+)
2. **GoTrue Auth** — User authentication, JWT tokens
3. **Realtime** — WebSocket subscriptions for live updates
4. **RLS** — Row Level Security for multi-tenant isolation
5. **Storage** — Document/object storage (S3-compatible)

## Consequences

### Positive

- **PostgreSQL** — Full relational database with JSON support
- **RLS policies** — Security enforced at database level
- **Real-time** — Native subscriptions without WebSocket boilerplate
- **Local development** — CLI provides full local stack
- **Open source** — Can self-host if needed
- **Auth integration** — `auth.users` → `employees` seamless link
- **Cost** — Generous free tier, predictable pricing

### Negative

- **Vendor coupling** — Migration away requires effort
- **Connection limits** — Shared pool requires monitoring
- **Realtime scalability** — High-frequency updates need tuning
- **Function limitations** — Edge functions Deno-only

### Neutral

- **Supabase-specific** — Knowledge transfer if team changes

## Alternatives Considered

### Firebase (Google) (REJECTED)

- Firestore NoSQL doesn't fit relational mining data
- Vendor lock-in to Google ecosystem
- Less mature TypeScript support
- Query limitations for complex joins

### Self-Hosted PostgreSQL + Keycloak (REJECTED)

- DevOps overhead for backups, scaling, patches
- Custom auth implementation required
- Real-time system would need custom WebSocket layer
- Higher operational burden than managed service

### AWS RDS + Cognito (REJECTED)

- Higher complexity than Supabase
- No built-in real-time subscriptions
- More expensive for equivalent features

## Implementation Notes

- Three client contexts: browser, server, middleware
- Always import from `@repo/supabase` (never direct)
- RLS policies on every table
- Auth trigger `handle_new_user()` auto-creates employee row
- Soft deletes via `deleted_at` (no row removal)

## Related

- [[supabase-local-dev]] — Local development setup
- [[rls-policy]] — RLS standards and patterns
- [[database-schema]] — Full schema documentation
- [[comparisons/database-backend]] — Detailed comparison
