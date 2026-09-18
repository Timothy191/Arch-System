# Pull Request: corpos/redeploy-p2-cascade

**Title:** feat(portal): deployment-ready code changes + agentic system init

**Branch:** `corpos/redeploy-p2-cascade` → `main`

**Tier:** 2 (auth / infra / deploy scope — requires 2 reviewers + security approval)

## Summary

This branch delivers the remaining P0/P1/P2 items from `.agents/corpos/TODO-system-init.md`:
1. Synchronizes the Arch-CorpOS agentic governance system after a workspace relocation.
2. Commits the accumulated deployment-ready portal/UI/control-room/infra worktree changes.
3. Replaces the placeholder swarm runner with a real registry-aware orchestration tool.
4. Records a successful post-live-deploy `deployment-learning-loop` tick.

## Commits

- `chore(corpos): sync agentic governance state and deployment-readiness docs`
- `feat(portal): deployment-ready code changes across UI, control-room, and infra`
- `chore(corpos): close P2 TODOs and finalize swarm runner`
- `docs(corpos): final handoff for redeploy-p2-cascade`
- `chore(corpos): record post-live-deploy tick and healthy watchdog`

## Risk areas flagged for Tier 2 review

- `apps/portal/app/(auth)/login/page.tsx`
- `apps/portal/app/admin/page.tsx`
- `apps/portal/app/api/**/*`
- `apps/portal/app/api/webhooks/[id]/route.ts`
- `apps/portal/features/auth/**/*`
- `apps/portal/features/admin/**/*`
- `apps/portal/features/webhooks/components/WebhookManager.tsx`
- `apps/portal/server/proxy.ts`
- `apps/portal/next.config.mjs`
- `libs/features/auth/ui/src/LoginForm.tsx`
- `scripts/*` (deploy/dev/monitor tooling)
- `.gitlab-ci.yml`

## Validation performed

- `pnpm --filter portal type-check` — ✅ pass
- `pnpm --filter portal test` — ✅ 142 suites, 919 tests pass
- `node tools/scripts/run-swarm.cjs --check` — ✅ 0 violations
- `pnpm corpos status` — ✅ all loops registered, zero pending approvals
- `pnpm corpos tick deployment-learning-loop --dry-run` — ✅ SUCCESS
- `sidekick deploy local` — ✅ succeeded
- `sidekick health` — ✅ Web Portal (3000), Supabase DB (54322), Redis Cache (6379) all UP

## Deployment notes

- Live local redeploy was executed with `sidekick deploy local` and verified healthy.
- Cloud Supabase URL is configured (`https://mrwhtxbhrzyttlsyuofc.supabase.co`).
- Redis is currently pointing at `redis://127.0.0.1:6379`; confirm this matches the target environment before promoting beyond local.

## Next steps after merge

1. Update `TODO-system-init.md` status to `merged`.
2. Schedule recurring `corpos tick codebase-health` and `corpos tick deployment-learning-loop` ticks.
3. Continue using `pnpm agent:swarm` for worktree quality gating.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
