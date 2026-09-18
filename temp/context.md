# Project Context for Deployment Readiness

## 1. Project summary

This repository is a Turborepo monorepo for an operations portal and internal platform product. The primary application is the Next.js portal in `apps/portal`, built around React, TypeScript, Supabase, and a local/on-prem infrastructure model.

The repo includes shared packages, deployment scripts, monitoring tooling, and documentation for both local development and production-style self-hosted environments.

## 2. Current architecture

### Monorepo structure

- `apps/portal` — main Next.js application
- `packages/*` — shared libraries such as theme, UI, supabase, database, utils, and contracts
- `scripts/` — local deploy and environment orchestration
- `infra/` — Docker and infrastructure helpers
- `docs/` and `documentation/` — operational and architecture docs
- `temp/` — working notes and project planning artifacts

### Runtime expectations

The app is designed around:

- Node.js >= 22
- pnpm + Turbo monorepo tooling
- local/local-network services for the portal experience
- Supabase as a key backend dependency
- Redis, monitoring, and local sidecar services in some flows

## 3. Deployment model observed in the repo

The repo is not purely a Vercel-first app. It currently contains strong evidence of a local and on-prem deployment model:

- [DEPLOYMENT.md](../DEPLOYMENT.md) describes local, staging, and production scripts.
- [docs/wiki/concepts/on-premises-deployment.md](../docs/wiki/concepts/on-premises-deployment.md) explicitly targets an on-prem Linux server for production.
- [apps/portal/env/.env.production.example](../apps/portal/env/.env.production.example) contains localhost and local-network URLs.
- [apps/portal/next.config.mjs](../apps/portal/next.config.mjs) defaults runtime service URLs to `127.0.0.1`.

This indicates the application was built to run in a self-hosted environment rather than as a Vercel-native cloud app.

## 4. Key environment facts

The repo expects environment values like:

- Supabase URL and keys
- Redis URL
- app runtime configuration
- assistant sidecar URL
- production-specific settings

A number of these values currently rely on local endpoints or placeholders rather than cloud-ready URLs. This is a major deployment mismatch with Vercel.

## 5. What is blocking smooth Vercel deployment

The main blockers are not a single syntax error; they are architecture and runtime assumptions:

1. Localhost defaults such as `127.0.0.1` and `localhost` are embedded in config and examples.
2. The app has local sidecar/service assumptions for the AI assistant and other components.
3. The repo docs and deployment scripts are largely built around self-hosting and local infrastructure.
4. Vercel config exists, but the code and env defaults still reflect a local-first environment.

## 6. Current target state

The project can be made Vercel-friendly if it is refactored into a cloud-native setup:

- public Supabase endpoints instead of local ones
- managed Redis or an equivalent cloud service
- no local loopback values in runtime-critical config
- production env variables set in Vercel
- public URLs for any required auxiliary services

## 7. Practical interpretation

This repo is best understood as:

- a productive monorepo with a valid Next.js app
- a local/on-prem deployment system that is only partially adapted for cloud deployment
- not yet a clean Vercel-first app without additional environment and architecture changes

## 8. Decision context

The goal is to keep the product useful without forcing a risky blanket rewrite. The right path is to document and separate:

- what is already valid for local development
- what is required for a cloud deployment model
- what must change before Vercel deployment is smooth and reliable

This context file is intended to support that alignment work without changing production code.
