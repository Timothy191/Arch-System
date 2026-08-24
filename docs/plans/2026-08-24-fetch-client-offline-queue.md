---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: lfg-pipeline
title: "FetchClient Centralization, IndexedDB Offline Storage & Context Optimization Plan"
date: "2026-08-24"
---

# FetchClient Centralization, IndexedDB Offline Storage & Context Optimization Plan

## 1. Executive Summary & Problem Frame

This plan establishes a resilient client-side network fetch architecture for low-connectivity underground mining tablets in `@repo/utils`, connects it to `@repo/errors`, updates client widgets in `apps/portal`, displays offline queue indicators in `SystemTray`, and optimizes agent context files (`CLAUDE.md`, `docs/AGENTS.md`, `docs/GEMINI.md`) to minimize pre-context token pollution.

## 2. Requirements & Scope Boundaries

### In Scope

- **Domain Errors (`packages/errors`)**: `FetchTimeoutError` (504), `NetworkError` (503), type guards `isFetchTimeoutError`, `isNetworkError`.
- **Fetch Core & Offline Storage (`packages/utils`)**: Centralized `FetchClient` class with backoff retries, jitter, timeout boundaries, read-through GET caching, and IndexedDB mutation queueing (`IDBOfflineStorage`).
- **Portal UI Components (`apps/portal`)**: Migration of `WeatherWidget`, `AIMetricsDashboard`, `WebhookManager`, and `FeedbackWidget` to `fetchClient`. Integration of `useFetchOfflineQueue` hook and offline status indicator in `SystemTray.tsx`.
- **Pre-Context Optimization**: Streamlining `CLAUDE.md`, `docs/AGENTS.md`, and `docs/GEMINI.md`, and enforcing `codebase-memory` MCP rules in `.agents/rules/codebase-memory-advisor.md`.

### Out of Scope

- Server-side database schema changes.
- Dark mode CSS modifications (light-only system invariant).

## 3. Architecture & Key Implementation Units

### Unit 1: Error Domain Hierarchy (`packages/errors`)

- Define `FetchTimeoutError` and `NetworkError` extending `APIError`.
- Provide `isFetchTimeoutError` and `isNetworkError` predicate helpers.
- Test files: `packages/errors/src/index.ts`.

### Unit 2: Centralized Fetch Engine & IndexedDB Persistence (`packages/utils`)

- Implement `IDBOfflineStorage` with fallback in-memory capability in `packages/utils/src/offline-storage.ts`.
- Implement `FetchClient` in `packages/utils/src/fetch-client.ts` with exponential backoff, timeout signal chaining, idempotency keys, and offline queue auto-flushing.
- Unit tests: `packages/utils/src/fetch-client.test.ts`, `packages/utils/src/offline-storage.test.ts`.

### Unit 3: Portal Widgets & System Tray Badge (`apps/portal`)

- Create React hook `useFetchOfflineQueue` in `apps/portal/hooks/useFetchOfflineQueue.ts`.
- Update `SystemTray.tsx` with offline pill badge and sync row options.
- Refactor `WeatherWidget`, `AIMetricsDashboard`, `WebhookManager`, and `FeedbackWidget` to consume `fetchClient`.

### Unit 4: Pre-Context Optimization & Rule Enforcement (`docs/`, `.agents/`)

- Streamline `CLAUDE.md` and `docs/AGENTS.md` to remove duplicated Nx configuration text.
- Enforce graph-first exploration via `.agents/rules/codebase-memory-advisor.md`.

## 4. Verification & Quality Gates

- Run unit test suite: `pnpm --filter @repo/utils test` and `pnpm --filter @repo/errors test`.
- Run workspace quality gate: `pnpm quality`.
