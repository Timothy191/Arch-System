# Complete Production Overhaul — Risks

## Risk Register

| ID | Risk | Prob | Impact | Mitigation |
|---|---|---|---|---|
| R1 | `GRANT SELECT ON fleet TO authenticated` opens fleet to all roles; RLS policy must do the filtering | Medium | Medium | Verify RLS policy is correct after grant; run `pnpm audit:rls` |
| R2 | Adding `breakdown_sharing` clause to the SELECT policy could expose rows the sharing table doesn't intend | Low | High | Read migration 077 carefully; test with a non-admin user before deploying |
| R3 | GIN index on `accessible_departments` could bloat if the array is large | Low | Low | `accessible_departments` is a UUID array, typically < 10 elements; GIN is appropriate |
| R4 | `handle_new_user` trigger change could break existing user creation flow | Medium | High | Test with a fresh signup before deploying; the `ON CONFLICT` clause handles re-runs |
| R5 | Module-level `dept-registry.ts` Map could grow unbounded if departments are added frequently | Low | Low | 5-min TTL + Map size is bounded by department count (< 20); safe |
| R6 | Raising Redis timeout to 500ms could delay auth on slow Redis | Low | Medium | 500ms is still bounded; the soft-deadline approach returns null and lets the caller proceed |
| R7 | The refactor branch has 70 modified files; merge conflicts with `main` are likely | High | Medium | Merge `main` into the refactor branch first, resolve conflicts, then fast-forward |
| R8 | The three untracked Inngest jobs could break the client bundle if imported incorrectly | Medium | High | Import only from `apps/portal/app/api/inngest/route.ts` (server-only); run `pnpm build` before deploy |
| R9 | `pnpm quality` on the refactor branch may fail; fixing all issues could take longer than estimated | High | Medium | Run `pnpm quality` first; triage failures by severity; fix blocking ones, defer non-blocking |
| R10 | Vercel env CLI repair (`vercel link --yes`) could unlink the project and require reconfiguration | Low | High | Only run if `--team` flag fails; have the Vercel dashboard open as fallback |
| R11 | Deploying a hotfix to production could introduce new failures on the live site | Medium | High | Deploy one migration at a time; verify each with `vercel curl` before proceeding; rollback target bookmarked |
| R12 | The `departments` 19s latency could be partially caused by something other than the Redis timeout race | Low | Medium | Run `EXPLAIN ANALYZE` on the actual query before and after the fix; verify the index scan hypothesis |

## Contingency Plan

If Phase 1 fixes don't resolve the `departments` latency:
1. Run `EXPLAIN (ANALYZE, BUFFERS)` on the exact query from `proxy.ts`
2. Check `pg_stat_statements` for the actual slow query
3. If the bottleneck is elsewhere (e.g. Supabase pooler, network), escalate to Supabase support
4. Fallback: increase the Redis timeout to 1000ms and accept the latency until the root cause is found

If the refactor branch merge to `main` fails catastrophically:
1. Revert the refactor branch to its last known-good commit
2. Cherry-pick only the safe fixes (dept-registry, timeout fix, indexes)
3. Deploy the safe fixes as a separate PR
4. Defer the risky changes (Inngest jobs, UI rework) to a later release