<!-- cspell:words sindresorhus remy validatorjs Unitech -->

# Node.js Runtime Stabilization, Auto-Updating System & Annual Tech Stack Assessment

## 1. Executive Summary

This operational specification defines Arch-System's **Node.js Stabilization & Auto-Updating Governance System** (`tools/scripts/node-governance-updater.mjs`), our **Quarterly Verification Cadence** (`pnpm governance:quarterly`), and our **Annual Tech Stack Assessment** (`pnpm governance:annual-assessment`).

All 26 workspace packages are standardized on **Node.js >= 24** (`.nvmrc` and `.node-version` pinned to `24`) and **pnpm 9.15.9** (`packageManager: "pnpm@9.15.9"`), with **zero circular dependencies** (`pnpm cycles`) and **zero dead code** (`pnpm knip`).

---

## 2. Evaluation of the 8 Candidate Node.js Repositories

| Repository                                                                      | Verdict                                | Architectural Rationale in Arch-System                                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`nodejs/node`](https://github.com/nodejs/node)                                 | **ADOPTED (Core Runtime)**             | Standardized on Node.js 24 LTS (`>=24`). Leverages native `fetch`, `WebSocket`, `crypto.timingSafeEqual`, `node:fs/promises`, and `node --watch` to eliminate third-party runtime polyfills.                            |
| [`nvm-sh/nvm`](https://github.com/nvm-sh/nvm)                                   | **ADOPTED (Version Pinning)**          | `.nvmrc` (`24`) and `.node-version` (`24`) are synchronized with `package.json#engines.node` (`>=24`) and `package.json#volta.node` (`24.x`) for deterministic version resolution across `nvm`, `mise`, and CI runners. |
| [`pnpm/pnpm`](https://github.com/pnpm/pnpm)                                     | **ADOPTED (Workspace & Catalog SSoT)** | `pnpm@9.15.9` is strictly enforced via `preinstall` guard, `pnpm-workspace.yaml` catalogs (`catalog:` + `catalogs.react19`), and `syncpack` (`pnpm deps:lint`).                                                         |
| [`sindresorhus/awesome-nodejs`](https://github.com/sindresorhus/awesome-nodejs) | **ADOPTED (Reference Standards)**      | Adopted native-first Node.js engineering patterns: structured Pino logging (`@repo/logger`), Zod 4 schema validation (`@repo/contract`), and zero-bloat CLI scripts.                                                    |
| [`websockets/ws`](https://github.com/websockets/ws)                             | **SCOPED (Test & Tooling Only)**       | Scoped strictly to Node.js test/dev transport harnesses; production browser and edge telemetry use **Supabase Realtime CDC** (`useSupabaseRealtime`) and native `globalThis.WebSocket`.                                 |
| [`remy/nodemon`](https://github.com/remy/nodemon)                               | **DISCARDED**                          | Superseded by native Node.js 24 `node --watch` / `--watch-preserve-output` and Next.js 16 Turbopack HMR (`pnpm dev:turbo`). Discarded to prevent redundant file-watcher dependencies.                                   |
| [`validatorjs/validator.js`](https://github.com/validatorjs/validator.js)       | **DISCARDED**                          | Superseded by `@repo/contract` **Zod 4** schemas (`z.email()`, `z.uuid()`, `z.url()`, `safeParse()`). Discarded to preserve Single Source of Truth (SSoT) validation.                                                   |
| [`Unitech/pm2`](https://github.com/Unitech/pm2)                                 | **DISCARDED**                          | Superseded by **Vercel Fluid Compute** in production and **Docker Compose** health-checked containers for local Redis/Supabase infrastructure.                                                                          |

---

## 3. Automated Node.js Auto-Updating & Governance Commands

| Command                             | Script Target                                                                          | Purpose                                                                                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm node:stabilize`               | `node tools/scripts/node-governance-updater.mjs --mode=stabilize`                      | Verifies `.nvmrc`, `.node-version`, `package.json#engines`, `pnpm@9.15.9`, native Node 24 APIs (`fetch`, `WebSocket`), and zero discarded dependencies (`nodemon`, `validator`, `pm2`). |
| `pnpm node:auto-update`             | `node tools/scripts/node-governance-updater.mjs --mode=auto-update`                    | Runs Node stabilization checks followed by `pnpm policy:gen`, `pnpm policy:check`, `pnpm deps:lint`, `pnpm cycles`, and `pnpm knip`.                                                    |
| `pnpm governance:quarterly`         | `node tools/scripts/node-governance-updater.mjs --mode=quarterly && pnpm agent:verify` | Executes quarterly boundary regeneration (`pnpm policy:gen`), circular dependency & dead-code sweeps, and the full 27-gate verification suite (`pnpm agent:verify`).                    |
| `pnpm governance:annual-assessment` | `node tools/scripts/node-governance-updater.mjs --mode=annual`                         | Generates the annual technology stack health & dependency alignment report (`.ci-local/node-governance-report.json`).                                                                   |

---

## 4. Annual Technology Stack Assessment Matrix (2026 Baseline)

| Layer                      | Technology                 | Pinned / Catalog Version                      | Health & Action Status                                                       |
| -------------------------- | -------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| **JavaScript Runtime**     | Node.js LTS                | `>=24` (`v24.15.0` / `v26.8.1`)               | ✅ Healthy — `.nvmrc`, `.node-version`, `engines`, and `volta` aligned       |
| **Package Manager**        | pnpm + Turborepo           | `pnpm@9.15.9` + `turbo@^2.9.6`                | ✅ Healthy — Workspace catalogs & `syncpack` 100% synchronized               |
| **Web Framework**          | Next.js App Router + React | `next@16.x` + `react@^19.2.7`                 | ✅ Healthy — RSC streaming, `'use cache'`, and `proxy.ts` CSP nonce active   |
| **Type System & Linter**   | TypeScript + Biome         | `typescript@~5.9.2` + `@biomejs/biome@2.4.12` | ✅ Healthy — Zero `any`, `useSortedClasses` enforced                         |
| **Contracts & Validation** | Zod                        | `zod@^4.6.6` (`@repo/contract`)               | ✅ Healthy — Zero contract drift (`pnpm audit:drift`)                        |
| **Database & ORM**         | Supabase Postgres + Kysely | `kysely@^0.28.17` + 217 SQL migrations        | ✅ Healthy — 100% RLS coverage & InitPlan optimized                          |
| **Caching & Locks**        | Redis                      | `@repo/redis` + `@repo/rate-limiter`          | ✅ Healthy — Live TCP + HTTP REST fallback & 34/34 integration tests passing |
| **Testing & Visual QA**    | Jest 30 + Playwright       | `jest@30.x` + `@playwright/test`              | ✅ Healthy — 13-department runner + Control Room visual baselines active     |
| **Codebase Hygiene**       | Dependency Cruiser + Knip  | `pnpm cycles` + `pnpm knip`                   | ✅ Healthy — 0 circular dependencies, 0 unused files/exports                 |
