---
name: deploy-federation
description: Execute deployment preflight checks, build verification, and autonomous release gates for Arch-System production deployments.
---

# Deploy Federation

Coordinate preflight verification and release safety checks before merging to `main` or deploying to Vercel production.

## Preflight Sequence

1. `pnpm env:check -- --target=prod` — Verify required production environment variables are present without exposing secret values.
2. `pnpm deploy:vercel:preflight:prod` — Validate Vercel monorepo build and configuration invariants.
3. `pnpm agent:verify` — Verify all mandatory quality, security, and build gates pass.

## Autonomous Release Gate

- Once preflight and `pnpm agent:verify` pass, autonomously merge to `main` (`--ff-only`), run `git push origin main`, and execute `pnpm deploy:vercel:prod`.
- Verify live health endpoints after deployment rather than inferring health from local builds.
