---
name: general-best-practices
description: Cross-cutting best practices for naming conventions, error handling, state management, dependency injection, and project conventions across all Arch-System packages and apps
paths:
  - 'apps/**/*'
  - 'packages/**/*'
  - 'libs/**/*'
alwaysApply: true
---

# General Best Practices

These cross-cutting rules establish consistent standards for Arch-System development. They supplement the language-specific rules in other agent rule files.

---

## 1. Naming Conventions

Consistent naming makes code predictable to read and refactor.

### File Naming

| Artifact   | Pattern                                     | Example                                                |
| ---------- | ------------------------------------------- | ------------------------------------------------------ |
| Components | `PascalCase.tsx`                            | `GlassCard.tsx`, `Dashboard.tsx`                       |
| Hooks      | `useXxx.ts`                                 | `usePitConnectivity.ts`, `useSupabaseRealtime.ts`      |
| Schemas    | `kebab-case.schema.ts`                      | `access-control.schema.ts`, `shift-closeout.schema.ts` |
| Types      | `kebab-case.types.ts`                       | `reports.types.ts`, `metrics.types.ts`                 |
| Utilities  | `kebab-case.ts`                             | `cache-utils.ts`, `api-helpers.ts`                     |
| Migrations | `NNN_description.sql` (zero-padded 3-digit) | `163_shift_closeout_rpc.sql`                           |
| Test files | Co-located `*.test.ts(x)`                   | `Button.test.tsx`                                      |
| E2E specs  | `*.spec.ts`                                 | `accessibility.spec.ts`                                |

### Identifier Rules

- **Banned identifiers**: `data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr` — these are too vague.
- **Numeric variables**: Append units (`timeoutMs`, `maxWeightTons`, `delayHours`).
- **Boolean variables**: Prefix with `is`/`has`/`can`/`should`/`did`/`will` (`isVisible`, `hasError`, `canSubmit`, `shouldRefresh`, `didCommit`, `willRetry`).
- **Collections**: Use pluralized nouns (`pendingUsers`, `activeMachines`, `reportItems`).

---

## 2. Error Handling

All domain/runtime errors extend `AppError` from `@repo/errors`.

### Error Hierarchy

```
AppError
├── ValidationError
├── AuthError
├── ForbiddenError
├── NotFoundError
├── ConflictError
├── RateLimitError
├── DatabaseError
└── ExternalError
```

### Pattern

```typescript
import { ValidationError, AppError } from '@repo/errors';

// At boundaries, use type guard
if (isAppError(err)) {
  return Response.json({ error: err.message }, { status: err.status });
}

// Never swallow errors - always return typed fallback or rethrow with context
try {
  await saveRecord(id, payload);
} catch (error) {
  throw new ApplicationError(`Failed to save record [id=${id}]`, {
    cause: error,
    metadata: { operation: 'saveRecord', entityId: id },
  });
}
```

---

## 3. State Management Patterns

### Server State

Use React Server Components by default. TanStack Query for polling/refetch.

```typescript
import { useQuery } from '@tanstack/react-query';

const { data, error } = useQuery({
  queryKey: ['pit-status', pitId],
  queryFn: () => fetchPitStatus(pitId),
  staleTime: 5 * 60 * 1000,
});
```

### Ephemeral Client State

Use Zustand 5 stores for shared UI state.

```typescript
import { create } from 'zustand';

interface NavigationState {
  currentPath: string;
  setPath: (path: string) => void;
}

export const useNavigationStore = create<NavigationState>()((set) => ({
  currentPath: '/',
  setPath: (path) => set({ currentPath: path }),
}));
```

### Form State

React Hook Form + Zod resolver with localStorage persistence.

```typescript
const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    /* ... */
  },
});

// Auto-persist draft to localStorage
useEffect(() => {
  localStorage.setItem('shift-closeout-draft', JSON.stringify(form.getValues()));
}, [form.formState.isDirty, form.getValues()]);
```

### Multi-Step Machines

Use XState 5 actors for complex workflows.

```typescript
const orchestratorMachine = createMachine({
  id: 'orchestrator',
  initial: 'idle',
  states: {
    idle: { on: { START: 'running' } },
    running: { on: { SUCCESS: 'success', FAIL: 'error' } },
    // ...
  },
});
```

---

## 4. Dependency Injection & Service Factories

Runtime clients use factory helpers from `@repo/supabase`, `@repo/redis`, `@repo/rate-limiter`.

### Supabase Clients

```typescript
import { createServerSupabaseClient } from '@repo/supabase/server';
import { createBrowserSupabaseClient } from '@repo/supabase/client';

// Server-side (RSC or Server Action)
const supabase = createServerSupabaseClient();

// Client-side
const supabase = createBrowserSupabaseClient();
```

### Redis Clients

```typescript
import { getRedisClient, cacheGetOrSet } from '@repo/redis';

const redis = getRedisClient();
const cached = await cacheGetOrSet('key', async () => expensiveOperation(), { ttl: 600 });
```

### Kysely Client

```typescript
import { createKyselyClient } from '@repo/supabase/kysely';

const db = createKyselyClient();
const results = await db.selectFrom('machines').selectAll().execute();
```

### Rate Limiter

```typescript
import { RateLimiter } from '@repo/rate-limiter';

const limiter = new RateLimiter({
  store: new IStore(),
  strategy: new IStrategy(),
});
await limiter.consume(userId, { max: 100, window: 60000 });
```

---

## 5. Git & Commit Conventions

### Commit Messages

Use **Conventional Commits** format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Scope examples: `portal`, `api`, `database`, `auth`, `supabase`

### PR Compliance

- Never commit `.env*` files — use `.env.example` templates
- Append ISO-8601 entries to `AGENT_TRACER.md` when modifying packages:

```
## 2026-10-29T14:30:00Z
- Modified reports-types.ts to add FleetMachineItem and MachineDailyOverviewRecord types
- Affected: apps/portal/app/(departments)/[department]/reports/
```

### Branch Strategy

- Feature branches: `feat/short-description`, `fix/broken-thing`
- Never commit directly to `main` — pull requests require passing `pnpm agent:verify`

---

## 6. Import Conventions

### Canonical Exports

Import via barrel exports, never deep paths:

```typescript
// Good
import { GlassCard } from '@repo/ui';
import { createServerSupabaseClient } from '@repo/supabase/server';

// Bad
import { GlassCard } from '@repo/ui/src/components/GlassCard';
import { createServerSupabaseClient } from '@repo/supabase/src/client';
```

### Package Aliases

- `@repo/*` — shared libraries (`@repo/ui`, `@repo/theme`, `@repo/errors`, etc.)
- `@/*` — internal libs when applicable

---

## 7. Documentation Standards

### Structure

```
docs/
├── agent-cookbooks/       # Step-by-step implementation guides
├── control-room/          # Operations runbooks
├── operations/            # Deployment procedures
├── plans/                 # Architecture decisions
├── agents/                # AI agent guidelines
└── wiki/                  # Team knowledge base
```

### Documentation Files

- **Cookbooks**: Executable guides with code examples
- **Runbooks**: Incident response procedures
- **Architectural Decision Records (ADRs)**: Problem context, options, decision rationale
- **\_AGENT_TRACER.md**: Changes to packages (ISO-8601 format)

---

## 8. Performance Budgets

### Bundle Size

- **Production bundles**: ≤ 1.0 MB uncompressed
- **Image optimization**: Use `next/image` with explicit `width`/`height` or `fill`
- **Static assets**: Stored in `public/` and CDN-cached

### Tailwind Utilities

- **Max 16 utilities per className** (target ≤ 12)
- **Extract repeated chains** (≥ 10 utilities, 3+ uses) into:
  - A component
  - CVA variant
  - `cn()` constant
  - Theme class

### Database Queries

Follow the 7-step Server Action flow to prevent N+1:

1. `authenticate` → 2. `authorize` → 3. `validate` (Zod) → 4. `rate-limit`
2. `RPC/query` with proper joins (never sequential awaits)
3. `invalidate cache` → 7. `redirect/return`
