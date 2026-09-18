# Deployment Readiness Requirements

## 1. Purpose

This document defines the functional and operational requirements for determining whether this repository is ready for a Vercel deployment or is better treated as a local/on-prem deployment project.

## 2. System context

The system is a monorepo application stack centered on the Next.js portal in `apps/portal`. It includes shared packages, local tooling, deployment automation, and environment-based configuration for backend services.

## 3. Requirements

### REQ-DEPLOY-001: Exact deployment target must be explicit

When the application is deployed,
The system shall define whether the target is Vercel, a self-hosted Linux server, or a local Docker environment.

### REQ-DEPLOY-002: Runtime URLs must be environment-driven

When the application is configured for production,
The system shall use environment-provided endpoints rather than hardcoded local network values such as `127.0.0.1` or `localhost`.

### REQ-DEPLOY-003: Local dependencies must be isolated from cloud runtime

When a runtime dependency is not provided by the deployment target,
The system shall not assume that localhost services are available.

### REQ-DEPLOY-004: Supabase environment must match the intended runtime

When the application requires database access,
The system shall use the public production Supabase URL and keys appropriate for the deployment target, not local development addresses.

### REQ-DEPLOY-005: Redis must be explicitly provisioned for the target environment

When Redis is required,
The system shall provide a valid production Redis endpoint or an equivalent managed alternative.

### REQ-DEPLOY-006: Platform-specific config must not hide local assumptions

When deployment configuration is described in repo files,
The system shall not use local-only service defaults that would break in a cloud runtime.

### REQ-DEPLOY-007: Docs must match actual deployment reality

When deployment behavior is documented,
The system shall align the docs with the actual infrastructure model instead of mixing on-prem and cloud assumptions.

### REQ-DEPLOY-008: Vercel readiness must be proven by env and runtime configuration

When the app is intended for Vercel,
The system shall verify that all required runtime services are internet-reachable and configured via environment variables.

### REQ-DEPLOY-009: Local/on-prem mode must remain clearly separated

When the repo is designed for local or self-hosted deployment,
The system shall keep that mode distinct from cloud deployment and not imply cloud readiness without evidence.

## 4. Acceptance criteria

The deployment-readiness effort is successful when all of the following are true:

- deployment target is explicit
- localhost assumptions are removed or isolated from production config
- environment variables reflect the real production target
- external services are reachable from the intended runtime
- docs match the actual deployment model
- the app is either clearly Vercel-ready or clearly local/on-prem oriented

## 5. Non-goals

This effort does not assume that a Vercel config file alone makes the app deployable. It requires actual runtime configuration and deployment architecture alignment.
