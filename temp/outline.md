# Deployment Readiness Outline

## 1. Objective

Establish whether the repository is genuinely ready for a Vercel deployment or whether it is still fundamentally a local/on-prem application with cloud deployment assumptions layered on top.

## 2. Scope

### In scope

- deployment model analysis
- runtime env and config review
- localhost dependency detection
- Vercel compatibility assessment
- deployment documentation alignment

### Out of scope

- broad feature work unrelated to deployment
- production code rewrites without a target deployment plan
- cloud-only assumptions that ignore repo architecture

## 3. Current state

This repo contains a valid monorepo and a functioning Next.js application, but it is not yet a clean Vercel-first deployment project. The strongest evidence points to a local/on-prem infrastructure model with a Vercel config file present but not fully supported by the runtime assumptions.

## 4. Workstreams

### Workstream 1: confirm runtime assumptions

Review the app configuration and environment templates to identify hardcoded local endpoints and service assumptions.

### Workstream 2: audit deployment docs

Compare repository docs with runtime configuration to determine whether the target architecture is cloud or self-hosted.

### Workstream 3: assess Vercel blockers

List the concrete items that would prevent a smooth Vercel deployment, including localhost and service dependency mismatches.

### Workstream 4: deliver the recommendation

Document whether the project is truly Vercel-ready or whether it should remain a local/on-prem deployment model.

## 5. Evidence to gather

- `vercel.json`
- `apps/portal/next.config.mjs`
- `apps/portal/env/.env.production.example`
- `DEPLOYMENT.md`
- `docs/wiki/concepts/on-premises-deployment.md`
- root package and app configuration

## 6. Decision gates

The system should be considered Vercel-ready only when:

- no localhost runtime assumptions remain
- environment variables reference external/public services
- all required infrastructure is reachable from the deployment target
- docs and config agree on the deployment model

## 7. Risk areas

- hidden local service dependency assumptions
- cloud blockers hidden in default env values
- architecture mismatch between Vercel config and repo intent
- false confidence from a valid `vercel.json` file alone

## 8. Exit criteria

This investigation is complete when the docs clearly state:

- the actual deployment model of the repo
- which components are local-only
- which values must be replaced for Vercel
- the realistic path to a production-safe deployment
