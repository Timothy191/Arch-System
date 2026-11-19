---
name: deploy-federation
description: Execute deployment preflight checks, build verification, and explicit-approval release gates for Arch-System production deployments.
---

# Deploy Federation

Coordinate preflight verification and release safety checks before merging to `main` or deploying to Vercel production.

## Preflight Sequence

1. `pnpm env:check -- --target=prod` — Verify required production environment variables are present without exposing secret values.
2. `pnpm deploy:vercel:preflight:prod` — Validate Vercel monorepo build and configuration invariants.
3. `pnpm agent:verify` — Verify all mandatory quality, security, and build gates pass.

## Approval Gate

- Obtain explicit user confirmation (or an authorized release CI trigger) before merging to `main`, running `git push origin main`, or executing `pnpm deploy:vercel:prod`.
- Verify live health endpoints after deployment rather than inferring health from local builds.
