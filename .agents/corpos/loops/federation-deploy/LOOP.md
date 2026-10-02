---
id: 'federation-deploy'
name: 'Federated Workspace Deployment Gateway'
department: 'engineering'
authority_level: 'L3'
schedule:
  min_interval_minutes: 0
  max_interval_minutes: 0
  backoff_factor: 1.0
signals:
  - source: 'agent'
    event: 'agent:verify-passed'
  - source: 'manual'
    event: 'corpos deploy'
verification:
  commands:
    - 'node /home/tim/Fork/.agents/skills/deploy-federation/deploy.mjs dryRun=true'
---

# Business Loop: Federated Workspace Deployment Gateway

## 1. Business Intent

Closes the agent loop by shipping verified changes across the federated workspace
(Arch-System, arch-system-nest-proxy, redis, n8n-vercel). This loop runs only after
project-level verification gates pass and requires L3 human approval before
mutating production deployments.

## 2. Invariants & Guardrails

- **Preflight First**: Every target project must pass its own preflight command
  before `vercel --prod` is invoked.
- **Health Gate**: After each deployment, the production alias is probed for a
  known healthy response.
- **Stop on Failure**: If any target fails preflight, deploy, or health check,
  the sequence halts and later targets are not deployed.
- **Human Approval**: L3 authority means the brief must be written to
  `.agents/corpos/storage/approvals/` and approved via `corpos approve <id>`
  before production deploy.
- **No Secrets in Logs**: Deployment credentials come from Vercel environment
  variables, never from prompts or artifacts.

## 3. Workflow Steps

1. Read `/home/tim/Fork/.agents/config/federation.json` for target projects.
2. Generate a brief at `.agents/corpos/storage/briefs/<tick_id>.md` listing
   changed projects, proposed targets, and rollback plan.
3. Wait for human approval (L3 gate).
4. Execute `.agents/skills/deploy-federation/deploy.mjs` with the approved
   targets and `environment=production`.
5. Capture outcome at `.agents/corpos/storage/outcomes/<tick_id>.md`.
6. Append a structured entry to `.agents/corpos/storage/journal.jsonl`.
7. Schedule the next deployment-learning-loop tick.
