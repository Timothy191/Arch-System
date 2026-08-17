# ArchDB — Supabase-inspired database architecture

## Purpose

ArchDB is the independent database control plane for Arch business systems. It takes architectural lessons from the public Supabase repository without copying Supabase implementation code. The goal is a self-hostable, production-oriented PostgreSQL platform with a Studio-style control plane.

## Research basis

The public `supabase/supabase` repository is a Turborepo monorepo. Its developer documentation identifies `/apps/www`, `/apps/studio`, and `/apps/docs`, with shared packages under `/packages`, and Docker used for local Studio development. The repository also separates client libraries and other services into dedicated repositories.

## ArchDB architecture

```text
Business Portal / Mobile / CLI / MCP
             |
       API Gateway / SDK
             |
       ArchDB Control Plane
       +-------------------+
       | Project Manager   |
       | Auth/RBAC         |
       | Schema API        |
       | Data API          |
       | Migration Engine  |
       | Audit API         |
       | Realtime Gateway  |
       +---------+---------+
                 |
       PostgreSQL data plane
       +-------------------+
       | PostgreSQL        |
       | roles/RLS         |
       | extensions       |
       | migrations       |
       +-------------------+
                 |
       Storage / backups / logs
```

## Monorepo layout

- `apps/studio` — database administration UI.
- `apps/api` — control-plane API.
- `apps/gateway` — external API boundary and rate limiting.
- `apps/realtime` — WebSocket/change delivery service.
- `apps/docs` — operator/developer documentation.
- `packages/ui` — shared Studio components.
- `packages/config` — shared TypeScript/build configuration.
- `packages/db-client` — typed database client.
- `packages/schema` — schema metadata types and validation.
- `packages/auth` — identity, sessions, roles and permissions.
- `packages/audit` — append-only audit event model.
- `packages/migrations` — migration manifest and execution primitives.
- `packages/realtime-protocol` — versioned event protocol.

## PostgreSQL responsibilities

PostgreSQL remains the source of truth for business data. ArchDB should expose schema, tables, indexes, constraints, functions, views, roles, grants, RLS policies, extensions and migration history through controlled APIs. Direct administrative credentials must never be exposed to browser clients.

## Security model

1. Separate control-plane credentials from application credentials.
2. Browser clients receive only scoped public credentials/tokens.
3. Server-side database access uses least-privilege roles.
4. RLS is the final data boundary for tenant/user isolation.
5. Every privileged schema mutation is audited.
6. Destructive operations require explicit confirmation and migration tracking.
7. Secrets remain outside Git and outside client bundles.
8. Backups are encrypted and restoration is tested periodically.

## Realtime

Use PostgreSQL change capture or an equivalent durable change stream behind a dedicated realtime service. Clients subscribe to logical entities rather than polling. Events use a versioned envelope and include project, entity, operation and sequence metadata.

## Migration strategy

All schema changes are represented as ordered, immutable migrations. Each migration records checksum, author/tool, timestamp, dependency metadata and execution status. Production migration execution is transactional where PostgreSQL permits it and is guarded by advisory locking to prevent concurrent runners.

## Clone boundary

This project is an architectural reimplementation. Do not copy Supabase source files, proprietary assets, credentials, trademarks or implementation code into ArchDB. Recreate required interfaces and behavior independently using PostgreSQL and open standards.

## Initial implementation phases

1. Studio shell and project registry.
2. PostgreSQL connection abstraction.
3. Schema/table metadata API.
4. Row browser with bounded pagination.
5. CRUD API with validation.
6. Migration registry and runner.
7. Roles, grants and RLS management.
8. Audit/event pipeline.
9. Realtime gateway.
10. Backup/restore and health monitoring.
11. SDK/CLI and MCP integration.
12. Production hardening, load testing and disaster recovery drills.
