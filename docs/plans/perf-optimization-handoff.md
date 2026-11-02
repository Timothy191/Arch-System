# Perf optimization handoff (backend → DB → UI/UX)

**Goal ID:** armed in session (CreateGoal)  
**Swarm:** `swarm-1793600421417-27vi5p` (hierarchical, max 8)  
**Orchestrate:** BLOCKED — `CURSOR_API_KEY` unset in agent shell (need personal key from Cursor Dashboard → Integrations)

## Professional decisions (auto-approved)

| Topic                 | Decision                                                       | Why                                                                        |
| --------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Custom load balancers | **Do not add**                                                 | Vercel CDN + Fluid Compute already distributes; DIY LB fights the platform |
| Redis / dual-tier     | **Keep & expand adoption**                                     | `withCache` + `cachedRSC` + `cacheInvalidateTags` is the SSoT              |
| Supabase              | Prefer **read replica** + existing pooler for RSC reads        | Already used on hub/dept paths                                             |
| Client Query          | `refetchOnReconnect: true`, keep `refetchOnWindowFocus: false` | TanStack default + pit tablet reality                                      |
| Edge runtime          | **Stay on Node Fluid Compute**                                 | Edge deprecated for this stack                                             |

## Done this pass

1. Client: `ReactQueryProvider` reconnect refetch + `networkMode: 'online'`
2. Server: dual-tier cache on drilling dashboard + engineering hub (were uncached hot paths)
3. Audit: hub already dual-tier; many other dept `page.tsx` still raw DB

## Next — Database phase

- Confirm pooler URL / read-replica routing under load
- Index / RLS initplan for hot queries (`machines`, `breakdowns`, `machine_operations`, `drill_operations`)
- Tag invalidation on write paths that mutate those tables (ensure `updateTag` / `cacheInvalidateTags` fire)
- Measure: `/api/health/redis` + cache hit metrics before/after

## Next — Frontend UI/UX phase

- Expand dual-tier to remaining dept dashboards (control-room, production, access-control)
- Suspense boundaries around dynamic dept shells
- Perceived load: keep GlassCard skeletons; avoid focus-refetch stampede
- CWV / route timing via Vercel metrics (`arch-system` project) once Observability available

## Key files

- `apps/portal/lib/server-cache.ts`, `apps/portal/lib/query-cache.ts`, `apps/portal/app/ReactQueryProvider.tsx`
- `libs/shared/utils/src/cache-utils.ts` → `withCache`
- `packages/redis/src/{cache,registry}.ts`
- Pattern exemplar: `apps/portal/lib/hub-departments.ts`
