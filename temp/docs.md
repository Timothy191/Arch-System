# Deployment Readiness and Vercel Compatibility Notes

## Executive summary

This repository is not currently a clean Vercel-first application. It is a monorepo built around a local development and on-prem deployment model, with a Next.js portal app that still contains localhost assumptions and local service dependencies.

The repo does include a Vercel config file, so deployment is not entirely unsupported, but the app is not yet fully cloud-native. The existing setup is much closer to a local/on-prem deployment architecture than a smooth Vercel deployment out of the box.

---

## Current project reality

### Project type

This is a Turborepo monorepo with:

- `apps/portal` as the main web application
- multiple shared packages under `packages/`
- local deployment scripts under `scripts/`
- Docker and monitoring-related infrastructure under `infra/` and other tooling paths

This is confirmed by the root package setup and documentation in:

- [package.json](../package.json)
- [README.md](../README.md)
- [DEPLOYMENT.md](../DEPLOYMENT.md)
- [docs/wiki/concepts/on-premises-deployment.md](../docs/wiki/concepts/on-premises-deployment.md)

### Runtime stack

The main app is a Next.js 16 portal app. The root project declares Node >= 22 and uses pnpm + Turbo. The repo also expects external services such as:

- Supabase
- Redis
- monitoring/ops tooling
- local assistant sidecar services

This makes the app dependent on a broader local infrastructure stack, which is not how Vercel is typically used.

---

## Evidence from the repo

### 1) Vercel config exists, but it is only a partial configuration

The repo contains [vercel.json](../vercel.json):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm build --filter=portal",
  "outputDirectory": "apps/portal/.next",
  "framework": "nextjs"
}
```

This is valid and indicates an intent to deploy the portal app to Vercel, but it does not remove the deeper runtime assumptions inside the app itself.

### 2) The app still contains localhost assumptions

In [apps/portal/next.config.mjs](../apps/portal/next.config.mjs), the assistant rewrite defaults to a local loopback URL:

```js
const assistantUrl = process.env.AI_ASSISTANT_URL ?? "http://127.0.0.1:3100";
```

This is a strong sign the app was built around a locally running sidecar service. On Vercel, `127.0.0.1` is not a valid backend target, and there is no process running on that machine.

### 3) Production env templates are local-first

The production example environment in [apps/portal/env/.env.production.example](../apps/portal/env/.env.production.example) includes many values designed for a local or self-hosted environment, for example:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_URL=http://127.0.0.1:54321
REDIS_URL=redis://:arch-systems-redis-secret@localhost:6379
```

This configuration is not Vercel-native. It expects the services to be present on the same machine or local network.

### 4) The repo documentation is explicitly on-prem oriented

The deployment docs describe a local dev model and an on-prem server target, not a Vercel cloud deployment target. Examples:

- [docs/wiki/concepts/on-premises-deployment.md](../docs/wiki/concepts/on-premises-deployment.md)
- [DEPLOYMENT.md](../DEPLOYMENT.md)
- [README.md](../README.md)

The on-prem document states that the production target is a Linux server at the mining site, not a cloud provider. That is a materially different deployment model from Vercel-hosted production.

---

## Actual blockers to smooth Vercel deployment

### 1) Localhost-only configuration values

The most immediate blocker is that several configuration values assume local runtime services.

Examples:

- `127.0.0.1` / `localhost` in env variables
- sidecar service URLs bound to local ports
- local Redis and local database references

These are not valid in the Vercel cloud environment unless replaced with true public service endpoints.

### 2) Local service dependencies

The repo expects services that are normally not available in a Vercel deployment:

- local Supabase instance
- local Redis instance
- local assistant service
- internal deployment tooling

This is a deployment model mismatch, not just a missing environment variable problem.

### 3) Architecture mismatch

The app is designed as if the platform owns the runtime environment and all supporting infrastructure. Vercel expects the web application to be cloud-hosted while its dependencies are cloud or internet-accessible services.

This repo mixes both patterns, which creates friction when deploying to Vercel.

### 4) Incomplete cloud readiness

The project includes a Vercel config, but the runtime logic and env defaults still reflect local infrastructure assumptions. That means deployment may fail or behave inconsistently unless the environment is reframed for cloud hosting.

---

## What would be required for a smooth Vercel deployment

To make this app genuinely smooth on Vercel, the following would need to be true:

### Required environment changes

Use Vercel environment variables with real public endpoints, such as:

- `NEXT_PUBLIC_SUPABASE_URL` pointing to a managed Supabase project
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or public anon key
- `SUPABASE_URL` and server-side keys for server operations
- `REDIS_URL` pointing to a managed Redis service, if Redis is still required
- `AI_ASSISTANT_URL` pointing to a real deployed service rather than `127.0.0.1`

### Required code changes

The app should avoid defaults like:

- `http://127.0.0.1:...`
- `localhost:...`
- local-only sidecar assumptions

It should instead prefer environment-driven configuration and safe fallbacks for production.

### Required deployment model alignment

The repo should either:

1. be clearly treated as a cloud-deployed Vercel app with remote services, or
2. remain as a self-hosted/on-prem app and not be treated as a Vercel-native deploy target

The current configuration is a blend of both models, which is why it is not friction-free for Vercel.

---

## Bottom line

This repository is not “fully Vercel-ready” in its current form. It includes a Vercel config and a portal app that can be built in a monorepo, but it is still deeply oriented toward local and on-prem deployment assumptions.

The real blockers are:

- localhost and local-network values in environment definitions
- local service dependencies that Vercel does not provide
- deployment architecture mismatch between local/on-prem docs and cloud deployment intent
- an app runtime that still assumes a machine-local sidecar/service stack

If the goal is smooth Vercel deployment, the project should be refactored to a cloud-native configuration with remote services and no localhost runtime assumptions.

---

## Recommendation

For a successful Vercel deployment:

- keep the Next.js app in Vercel
- move Supabase to a managed project
- move Redis to a managed service if needed
- replace local sidecars with public URLs
- remove hardcoded `127.0.0.1` defaults from runtime config
- keep Vercel envs as the source of truth, not local env examples

This is the most realistic path to a smooth deploy without fighting the repo’s current local-first architecture.
