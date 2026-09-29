# Vercel Deployment Architecture Standard & Operations Guide

## 1. Architectural Overview & Monorepo Topology

**Target Application:** `apps/portal`  
**Framework:** Next.js 16 App Router (React 19)  
**Monorepo Engine:** Turborepo 2.x + pnpm workspaces

Deploying an industrial enterprise monorepo to Vercel requires strict alignment between root build boundaries, client bundle sizes, serverless function runtimes, and database/cache latency.

```
                           +-----------------------------------+
                           |        Developer / CI Agent       |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           |    pnpm deploy:vercel:preflight   |
                           |  • vercel.json structure check    |
                           |  • .vercelignore size safeguards  |
                           |  • next.config.mjs mode check     |
                           |  • .vercel linkage verification   |
                           +-----------------------------------+
                                             | (Passed)
                                             v
                           +-----------------------------------+
                           |   pnpm deploy:vercel:[preview|prod]|
                           |  • Non-interactive CLI invocation|
                           |  • Turbopack build execution      |
                           +-----------------------------------+
                                             |
                     +-----------------------+-----------------------+
                     v                                               v
+------------------------------------------+    +------------------------------------------+
|          Edge Routing (Proxy.ts)         |    |        Vercel Serverless Functions       |
|  • CSP Nonce generation                  |    |  • Regional colocation (nearest Supabase)|
|  • Security headers (nosniff, sameorigin)|    |  • 60s timeout allocation                |
|  • Employee session resolution           |    |  • Atomic RPC closeouts & mutations      |
+------------------------------------------+    +------------------------------------------+
```

---

## 2. Core Operational Standards

### A. Next.js Output Mode Strategy

In `apps/portal/next.config.mjs`, output mode is dynamically assigned:

```javascript
output: process.env.VERCEL ? undefined : 'standalone',
```

- **On Vercel (`process.env.VERCEL` is defined)**: `output` is undefined, enabling native Vercel Node File Tracing (NFT), zero-config asset delivery, and optimized Serverless Function bundles.
- **In Docker / On-Prem**: Defaults to `'standalone'` for self-contained, containerized deployments.

### B. Monorepo Build Command & Output Directory

Configured via root `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "pnpm build --filter=portal",
  "outputDirectory": "apps/portal/.next"
}
```

### C. Build Pruning (`.vercelignore`)

To avoid exceeding Vercel's 250 MB deployment payload limit and to speed up deployments, `.vercelignore` strictly excludes:

- Rust targets (`tools/swarms-orchestrator/target/`, `target/`)
- E2E and evaluation suites (`e2e/`, `packages/eval/`, `tests/`)
- Autonomous agent logs and memory snapshots (`.agents/`, `.memory_base/`, `.palabre/`)
- Build caches (`.turbo/`, `.next/`)

---

## 3. Environment Variables & Secret Configuration

Configure these in the Vercel Dashboard under **Project Settings → Environment Variables**:

| Variable Name                   | Environments         | Purpose & Access Control                                             |
| :------------------------------ | :------------------- | :------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Production & Preview | Supabase REST endpoint (Public).                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production & Preview | Public client API key (Public).                                      |
| `SUPABASE_SERVICE_KEY`          | Production & Preview | **Secret**. Server-side admin key bypassing RLS.                     |
| `SUPABASE_URL`                  | Production & Preview | Server-side Supabase URL.                                            |
| `REDIS_URL`                     | Production & Preview | **Secret**. L2 distributed cache and rate limiter connection string. |
| `NEXT_PUBLIC_APP_URL`           | Production & Preview | Base URL for domain routing and cookie security.                     |
| `GOOGLE_AI_API_KEY`             | Production & Preview | **Secret**. Server-side LLM API key.                                 |
| `OTEL_EXPORTER_OTLP_ENDPOINT`   | Production & Preview | OpenTelemetry collector endpoint.                                    |
| `SENTRY_DSN`                    | Production & Preview | Error tracking DSN for server-side errors.                           |
| `NEXT_PUBLIC_SENTRY_DSN`        | Production & Preview | Error tracking DSN for client-side errors.                           |

---

## 4. Execution Commands & Automation Runbook

```bash
# 1. Run automated preflight verification
pnpm deploy:vercel:preflight

# 2. Deploy to Preview environment (non-interactive)
pnpm deploy:vercel:preview

# 3. Deploy to Production environment (non-interactive)
pnpm deploy:vercel:prod

# 4. View live deployment logs
npx vercel logs <deployment-url>
```

---

## 5. Troubleshooting & Prevention Playbook

### Issue: Headless Deployment Failure (`err-20260925-vercel-headless-deploy`)

- **Symptom**: `vercel --prod --yes` crashes when run by autonomous agents or headless CI.
- **Root Cause**: The directory lacks a local `.vercel/project.json` linking it to the Vercel project ID.
- **Fix**: Run `npx vercel link --yes` interactively once on the development host. The automated `tools/scripts/vercel-preflight.cjs` script audits this condition before any deployment attempts.

### Issue: Cross-Region Database Latency

- **Symptom**: Server Actions or RSC pages take > 1500ms to load.
- **Root Cause**: Vercel Serverless Function region is set to `us-east-1` while Supabase is hosted in another region.
- **Fix**: In Vercel Project Settings → Functions, change the **Function Region** to match your Supabase database host location.

### Issue: SSE Stream Gateway Terminations

- **Symptom**: Drilling or telemetry streams disconnect after 15 or 60 seconds.
- **Root Cause**: Vercel Serverless Function execution limit reached.
- **Fix**: Ensure high-frequency real-time telemetry uses client-side Supabase Realtime WebSocket channels (`useSupabaseRealtime`) rather than keeping long-lived HTTP streams open on serverless functions.
