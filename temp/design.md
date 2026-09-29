# Vercel Deployment Architecture & Design

## System Overview

The Vercel deployment architecture automates pre-flight verification, environment validation, build artifact trimming, and deployment execution for `apps/portal` within the Turborepo monorepo.

```
+-------------------------------------------------------------+
|                 Developer / Agent CLI Ingress               |
|            pnpm deploy:vercel:preflight / preview           |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|              tools/scripts/vercel-preflight.cjs             |
|  1. Configuration Assertions (vercel.json, .vercelignore)   |
|  2. Output Mode Validation (VERCEL ? undefined : standalone)|
|  3. Environment Schema Check (Public vs Private Secrets)    |
|  4. Boundary & File Tracing Root Verification               |
|  5. Upload Size Safeguards (Excluded Heavy Targets)         |
+-------------------------------------------------------------+
                               | (Pass)
                               v
+-------------------------------------------------------------+
|               tools/scripts/vercel-deploy.sh                |
|  1. Linkage Check (.vercel/project.json presence)           |
|  2. Preflight Execution Trigger                             |
|  3. Autonomous Deployment (npx vercel --yes)                |
|  4. Post-Deployment Smoke Probe & Status Output             |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                   Vercel Cloud Platform                     |
|  • Build Step: pnpm build --filter=portal                   |
|  • Next.js 16 NFT Tracing & Edge Middleware Proxy           |
|  • Colocated Serverless Functions (Nearest Supabase Region) |
+-------------------------------------------------------------+
```

## Key Components

### 1. `tools/scripts/vercel-preflight.cjs`

A zero-dependency Node.js script that runs before any deployment. It inspects:

- Root `vercel.json` exists and matches schema requirements.
- `.vercelignore` correctly includes patterns for `.agents/`, `packages/eval/`, `e2e/`, `target/`, etc.
- `apps/portal/next.config.mjs` has `outputFileTracingRoot` configured and conditional `output: process.env.VERCEL ? undefined : 'standalone'`.
- Validates that client environment variables conform to `NEXT_PUBLIC_*` naming.
- Checks whether `.vercel/` exists to warn on headless linkage issues.

### 2. `tools/scripts/vercel-deploy.sh`

A bash wrapper executing safe deployment workflows:

- Supports `--preview` (default) and `--prod`.
- Automatically injects `--yes` to prevent interactive CLI lockup.
- Provides actionable diagnostic steps if unlinked or failed.

### 3. Documentation

A permanent reference at `documentation/01-architecture/vercel-deployment-standard.md` capturing standards, checklists, env vars, and recovery playbooks.
