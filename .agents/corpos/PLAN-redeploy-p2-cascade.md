# Plan: Redeploy + Agentic P2 Cascade

## Scope

- **allow:** `.agents/corpos/`, `tools/scripts/run-swarm.cjs`, `temp/`, `scripts/deploy.sh`, `apps/portal/.env`, `.agents/corpos/TODO-system-init.md`
- **deny:** production secrets, force-push, main-branch direct writes, external API tokens, `.env` values beyond presence checks

## Phases

### Phase 1 — Goal Set & System Bootstrap

1. Set `/goal` stop hook: "redeploy the portal stack, run a full agentic swarm review of the 258 uncommitted files, close all P2 TODOs from TODO-system-init.md, and repeat the swarm→verify→commit loop until no P-level work remains."
2. Run `pnpm corpos status` and `pnpm corpos tick deployment-learning-loop --dry-run` to warm the post-deploy loop.
3. Trigger `sidekick status` and `sidekick health` as baseline telemetry.

### Phase 2 — Redeploy (Local/Hosted)

1. Determine deployment target from `apps/portal/.env`: if `SUPABASE_URL` points to hosted Supabase, use cloud-first path; otherwise local.
2. Run the appropriate deployment command:
   - cloud-first: `bash scripts/deploy.sh local --cloud --skip-tests` (the script auto-detects `CLOUD_MODE`)
   - or `sidekick deploy local` if the sidekick binary supports it
3. Capture deploy result artifact in `.agents/corpos/storage/artifacts/tick-<id>-deploy/`.
4. Run `sidekick health` and `sidekick status` post-deploy, update watchdog.

### Phase 3 — Swarm Review of Uncommitted Work Tree

1. Replace placeholder `tools/scripts/run-swarm.cjs` with a real orchestrator that:
   - enumerates all modified files via `git status --short`
   - classifies each file by domain (UI, API, DB, config, docs, infra)
   - dispatches parallel specialist subagents via `Workflow` or `Agent`
   - produces a structured findings report
2. Execute the swarm review over the 194 code/config files.
3. Produce `temp/swarm-review-findings.md` with buckets:
   - `safe_to_commit` (docs, tests, config fixes)
   - `needs_manual_review` (auth, deploy, env-sensitive)
   - `needs_tests` (code changes without matching tests)
   - `needs_revert` (accidental/stale changes)

### Phase 4 — Autonomous P2 Close Loop

For each bucket, run an autonomous loop until the TODO-system-init.md checkboxes are done:

1. **Commit safe changes** as a scoped commit (docs + corpos sync + temp plans).
2. **Build/test verification** via `pnpm type-check` and `pnpm lint` on affected packages.
3. **Address swarm findings** by dispatching follow-up agents for test gaps or revert decisions.
4. **Update TODO-system-init.md** and memory.
5. **Repeat** from Phase 3 if new uncommitted changes appear.

### Phase 5 — Final Verification & Handoff

1. `pnpm corpos tick codebase-health --dry-run` passes.
2. `pnpm corpos tick deployment-learning-loop` runs post-deploy.
3. All P0/P1 items from TODO-system-init.md are marked done.
4. Write handoff note and clear context.

## Decision Gates

- If `sidekick deploy` is unavailable or fails, fall back to `bash scripts/deploy.sh local --skip-tests`.
- If any finding touches `auth/`, `api/webhooks/`, `infra/`, or `.env`, escalate to explicit human approval (L3 gate) before commit.
- If build/test fails after two self-healing iterations, halt and handoff (P10/S1).

## Rule Waiver

No new rule required; this plan reuses existing skills (`spec-driven-swarming`, `universal-agentic-execution`, `sidekick-cli`, `ralph-loop`) and the corpos loop engine already initialized.
