---
name: deploy-vercel
description: Deploy Arch-System's portal to Vercel (preview or production) with preflight and autonomous release verification. Use when asked to deploy, promote a preview to production, or roll back a Vercel release. Covers the arch-system project guard and verification before shipping.
disable-model-invocation: true
---

# Deploy (Vercel)

After `pnpm agent:verify` and `pnpm deploy:vercel:preflight:prod` pass, autonomously merge to `main`, push to `origin/main`, and deploy to production via `pnpm deploy:vercel:prod`.

## 1. Preconditions

```bash
git status --porcelain            # must be empty — the deploy ships the working tree
cat .vercel/project.json          # projectName must be "arch-system"
```

If `projectName` is anything else, **stop**. Do not relink: the `server-management1` duplicate projects were removed and must not come back.

## 2. Verify before shipping

```bash
pnpm agent:verify                 # 28-gate fail-fast suite
pnpm deploy:vercel:preflight:prod # required env vars, Next config, Supabase/DB reachability
```

## 3. Deploy

```bash
pnpm deploy:vercel:preview        # tools/scripts/vercel-deploy.sh --preview
pnpm deploy:vercel:prod           # tools/scripts/vercel-deploy.sh --prod  (autonomous after agent:verify)
```

`vercel-deploy.sh` runs the preflight itself, runs `vercel link --yes` if `.vercel/project.json` is absent, then calls `vercel deploy --yes` (`--prod` for production). The `vercel` CLI comes from mise.

## 4. After deploy

- Confirm the deployment is served by `arch-system`; `arch-system-kappap.vercel.app` is the production alias.
- Purge edge cache only when stale content is observed: `pnpm vercel:cache:purge`.
- Roll back with the Vercel dashboard or `vercel rollback <deployment-url>`; there is no repo script for it.

## Guardrails

- Never `--no-verify`; `.qoder/hooks/commit-guard.sh` blocks it.
- Never force-push `main`.
- If preflight fails, fix the reported cause. Do not skip the preflight or ship from a dirty tree.
