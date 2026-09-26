# Agent Tracer - packages/utils

Every line in this file answers the question: "Would an agent miss this without help?"

---

## 2026-06-24: Add Analytics Utility Lint Fixes & Novu SDK Logger Fix

### Purpose

Resolve ESLint `no-console` warnings and fix a broken relative import of `logger` in the Novu notification utility.

### Changes Made

1. **Analytics Utility (`src/analytics.ts`)**:
   - Added `eslint-disable-next-line no-console` comments to server-side `console.log` statements in `track()` and `identify()`.
2. **Novu Utility (`src/novu.ts`)**:
   - Removed broken relative import of `logger` from `./index`.
   - Defined a local lightweight console-based `logger` with eslint-disable comments to prevent dependency bloat and type-checking issues.

### What the Next Agent Should Know

- `analytics` and `novu` utilities provide behavior tracking and notifications, but use lightweight console fallback logs which require ESLint rule suppressions to pass the root quality gate.

## 2026-08-24: Implement Centralized FetchClient Utility

### Purpose

Add `FetchClient` and `createFetchClient` in `@repo/utils` to handle automatic exponential backoff with full jitter, `AbortSignal` timeout boundaries, request/response interceptors, and error mapping to `@repo/errors`.

### Changes Made

1. **[src/fetch-client.ts](file:///home/tim/Documents/Arch-System/packages/utils/src/fetch-client.ts)**: Implemented `FetchClient` class, `createFetchClient` factory, and default `fetchClient` singleton.
2. **[src/fetch-client.test.ts](file:///home/tim/Documents/Arch-System/packages/utils/src/fetch-client.test.ts)**: Added unit test suite for fetch client retries, timeouts, and error mapping.
3. **[src/index.ts](file:///home/tim/Documents/Arch-System/packages/utils/src/index.ts)** & **[src/client.ts](file:///home/tim/Documents/Arch-System/packages/utils/src/client.ts)** & **[package.json](file:///home/tim/Documents/Arch-System/packages/utils/package.json)**: Exported `fetch-client` module and types across isomorphic and client entrypoints.

## 2026-08-24: Extend FetchClient with IndexedDB Offline Queue & Read-Through Cache

### Purpose

Add zero-dependency `IndexedDB` (`ArchOfflineFetchDB`) offline storage engine to `FetchClient` for low-connectivity underground mining tablets, featuring automatic mutation queueing, `X-Idempotency-Key` headers, auto-flushing on `online` events, and read-through GET response caching.

### Changes Made

1. **[src/offline-storage.ts](file:///home/tim/Documents/Arch-System/packages/utils/src/offline-storage.ts)**: Implemented `IDBOfflineStorage` with in-memory fallback.
2. **[src/fetch-client.ts](file:///home/tim/Documents/Arch-System/packages/utils/src/fetch-client.ts)**: Integrated `offlineQueue`, `offlineCache`, `idempotencyKey` options, and `flushOfflineQueue()` method.
3. **[src/offline-storage.test.ts](file:///home/tim/Documents/Arch-System/packages/utils/src/offline-storage.test.ts)**: Added unit test suite for IndexedDB storage and fallback behavior.
4. **[apps/portal/hooks/useFetchOfflineQueue.ts](file:///home/tim/Documents/Arch-System/apps/portal/hooks/useFetchOfflineQueue.ts)**: Added React hook for UI visibility and queue flushing.
