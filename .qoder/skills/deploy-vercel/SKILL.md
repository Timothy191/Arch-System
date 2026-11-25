---
name: deploy-vercel
description: Deploy Arch-System's portal to Vercel (preview or production) with preflight and an explicit approval gate. Use when asked to deploy, promote a preview to production, or roll back a Vercel release. Covers the arch-system project guard, verification before shipping, and the no-autonomous-production rule.
disable-model-invocation: true
---

# Deploy (Vercel)

Never deploy to production or push to `origin/main` without explicit user approval (`AGENTS.md` → Runtime/Tooling Preferences; `GEMINI.md` §3 Remote Release Gate). A preview is low-risk; production is not.

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
pnpm deploy:vercel:prod           # tools/scripts/vercel-deploy.sh --prod  (needs explicit approval)
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
