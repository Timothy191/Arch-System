# Deployment Readiness Tasks

## 1. Objective

Determine whether the project is deployable to Vercel without a large architecture mismatch or whether it should be treated as a local/on-prem application with separate deployment constraints.

## 2. Task list

### Task 1 — Audit deployment model

- Confirm whether the repo is fundamentally local/on-prem or cloud-first.
- Review root config, docs, and environment assumptions.

### Task 2 — Trace runtime dependencies

- Identify every service dependency that is expected to be available in production.
- Check whether those dependencies are local-only or internet-reachable.

### Task 3 — Inspect environment and config files

- Review `vercel.json`
- Review `apps/portal/next.config.mjs`
- Review `apps/portal/env/.env.production.example`
- Assess whether defaults are local-only.

### Task 4 — Evaluate Vercel blockers

- Catalog localhost assumptions.
- Identify local sidecar/service dependencies.
- Determine if the app is cloud-ready as written.

### Task 5 — Document the real recommendation

- Recommend either a Vercel-native refactor or a self-hosted deployment model.
- Keep the recommendation grounded in the actual repo architecture.

## 3. Current findings

- The repo has a Vercel config but also local-first runtime assumptions.
- The app includes local service URLs such as `127.0.0.1`.
- Deployment documentation points toward local/on-prem production hosting.
- Vercel compatibility is not smooth out of the box without further configuration changes.

## 4. Status

- [x] repo architecture reviewed
- [x] deployment assumptions checked
- [x] environment config inspected
- [x] Vercel blockers identified
- [x] recommendation documented in temp docs

## 5. Completion principle

This task is successful when the repo documentation accurately reflects the actual deployment reality and does not claim cloud readiness without the required environment and architecture changes.
