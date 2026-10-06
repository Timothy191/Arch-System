# Nile Database Integration (Serverless Multi-Tenant Postgres)

Nile is a serverless Postgres database designed for modern multi-tenant SaaS applications, providing built-in tenant isolation, tenant-scoped user tables, and auto-scaling vector storage.

## Credentials & Configuration

Configured in `.env.local` (and exported by Vercel storage integrations):

- `NILEDB_URL`: Connection string for PostgreSQL drivers and ORMs.
- `NILEDB_API_URL`: REST/Auth endpoint for tenant APIs.
- `NILEDB_USER` / `NILEDB_PASSWORD`: Authenticated credentials for database pool.
- `NILEDB_POSTGRES_URL`: Direct host URL (`eu-central-1.db.thenile.dev/nile_bisque_leaf`).

## Usage Patterns

### 1. Nile Server SDK (`@niledatabase/server`)

Located at [`apps/portal/lib/nile/server.ts`](file:///home/tim/Fork/Arch-System/apps/portal/lib/nile/server.ts):

```typescript
import { nile, getTenantNile } from '@/lib/nile';

// Global query across tenants
const tenants = await nile.query('SELECT id, name FROM tenants ORDER BY name;');

// Tenant-scoped instance with automatic isolation
const tenantDb = await getTenantNile('tenant-uuid', 'user-uuid');
const todos = await tenantDb.db.query('SELECT * FROM tasks ORDER BY title;');
```

### 2. Drizzle ORM (`drizzle-orm/node-postgres`)

Located at [`apps/portal/lib/nile/drizzle.ts`](file:///home/tim/Fork/Arch-System/apps/portal/lib/nile/drizzle.ts):

```typescript
import { nileDb, verifyNileConnection } from '@/lib/nile';

// Execute queries via Drizzle
const health = await verifyNileConnection();
console.log('Nile status:', health);
```

### 3. Prisma Multi-Schema

Located at [`apps/portal/lib/nile/schema.prisma`](file:///home/tim/Fork/Arch-System/apps/portal/lib/nile/schema.prisma):

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("NILEDB_URL")
  schemas  = ["public", "users"]
}
```
