---
name: federation-deploy
description: Deploy verified changes across the federated workspace after preflight checks, health verification, and optional rollback. L3 loop requiring human approval.
---

# Skill: Federated Workspace Deployment Gateway

## Execution Contract (Runbook)

**Phase 1: Discover**

- Read `/home/tim/Fork/.agents/config/federation.json` to identify target projects.
- Inspect recent git status in each target project to determine what changed.
- Map changed projects to deployment targets:
  - `Arch-System/` → `arch-system`
  - `arch-system-nest-proxy/` → `arch-system-nest-proxy`
  - `redis/` → `redis`
  - `n8n-vercel/` → `n8n-vercel`

**Phase 2: Preflight**

For each target, run its preflight command from the project directory:

- `arch-system`: `pnpm deploy:vercel:preflight`
- `arch-system-nest-proxy`: `npm run build`
- `redis`: `pnpm build`
- `n8n-vercel`: container-build sanity check

If any preflight fails, halt and report the failure without deploying.

**Phase 3: Approval Gate (L3)**

- Write a brief to `.agents/corpos/storage/briefs/<tick_id>.md`.
- Wait for `corpos approve <tick_id>` before production deploy.

**Phase 4: Deploy**

- Execute `node /home/tim/Fork/.agents/skills/deploy-federation/deploy.mjs targets=<list> environment=production`.
- Probe production aliases for health after each target.

**Phase 5: Outcome**

- Write outcome card to `.agents/corpos/storage/outcomes/<tick_id>.md`.
- Append structured entry to `.agents/corpos/storage/journal.jsonl`.
- Trigger `deployment-learning-loop` for post-deploy diagnostics.
