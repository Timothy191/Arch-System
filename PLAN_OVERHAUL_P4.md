# Arch-System — Complete Production Overhaul Plan (cont.)

## 1. Phased Remediation (cont.)

### Phase 3 — Harden (10-16h): make it run itself

**3a. Finish the CI deploy pipeline.** `.github/workflows/deploy.yml` has a
`quality-check` job and a `deploy-staging` job but the production deploy job
is truncated in the file. Read the full file, then complete it so that:
  - `main` push triggers quality-check -> deploy-staging (existing)
  - `main` push with a `deploy:production` label, or a tag `v*`, triggers
    quality-check -> deploy-production via `pnpm deploy:vercel:prod`
  - The production job requires the `quality-check` job to pass (no bypass)

**3b. Wire or remove the canary workflow.** `.github/workflows/deploy-canary.yml`
is a stub — every step just `echo`s a message. Either:
  - Wire it to a real Argo Rollout / Istio VirtualService (the comments reference
    `infra/k8s/rollout.yaml` which does not exist), or
  - Delete it. A canary workflow that always reports "Traffic shifted: 90%
    stable, 10% canary" and "Canary stable. Promoting to 100%" is worse than
    no canary — it gives false confidence.

**3c. Set up automated rollback.** `pnpm deploy:rollback` exists but needs a
deployment id. Add a GitHub Actions step that, on a failed production deploy,
automatically reverts to the previous known-good deployment. Store the last
good deployment id as a repo secret or workflow artifact. The current good id:
`dpl_69LXjDrSVgUeRS5H7GXDoYvqDH2q`.

**3d. Close the open TODOs.** `TODO.md` has 4 unchecked items:
  - [ ] 5. Remove dead remember-me checkbox (state never read; server sets
       400-day session maxAge regardless). Either wire the checkbox to the
       session maxAge or remove it.
  - [ ] 8. Align password length with Supabase policy (min 12 in config.toml
       vs client min 6). Set the client min to 12 or the Supabase config to 6.
  - [ ] 9. Resolve PORTAL_VERSION drift (page default 2.4.1, root pkg 1.5.1,
       portal pkg 1.0.0). Make `PORTAL_VERSION=2.4.1` explicit in env files.
  - [ ] 10. Clean redundant clause in `page.tsx` auth-cookie heuristic.
  - [ ] 12. Add `.codebase-memory/` to `.gitignore`.
  - [ ] 16. Correct CLAUDE.md drift (Volta claim -> mise, migration count).
  - [ ] 17. Supabase MCP OAuth — requires user browser auth, cannot be automated.

**3e. Add daily production verification.** A cron job (local, scheduled via the
`cronjob` tool, or a Vercel cron via the existing `apps/portal/app/api/cron`
route that was deleted in the refactor and needs restoring) that:
  - Hits `/api/health`
  - Hits the four critical endpoints from Phase 2f
  - Greps the last 100 Vercel logs for `Database query failed` and
    `Slow database query`
  - Exits non-zero if any check fails, so a monitoring system can alert

**3f. Wire the offline queue back in.** The refactor branch deleted
`apps/portal/hooks/useOfflineQueue.ts`; the new one at
`libs/shared/hooks/src/useOfflineQueue.ts` exists but is untracked. Restore
the import in `apps/portal/app/ClientProviders.tsx` (which was modified in
the refactor) so the offline mutation queue is active for field terminals.