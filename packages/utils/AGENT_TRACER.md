# Agent Tracer - packages/utils

Every line in this file answers the question: "Would an agent miss this without help?"

---

## 2026-11-05T06:05:00+02:00: Turbopack ESM Compatibility & Strict Types in Excel Utility

### Purpose

Resolve Turbopack ESM bundle failure where `xlsx` lacked a default export, and enforce strict TypeScript invariants (zero `any`) across Excel export/parse functions.

### Changes Made

1. **`src/excel.ts`**:
   - Replaced default import `import XLSX from 'xlsx'` with namespace import `import * as XLSX from 'xlsx'` for Turbopack ESM compatibility.
   - Replaced `any[]` with `readonly Record<string, unknown>[]` in `exportToExcel` and `Record<string, unknown>[]` in `parseExcel`.
   - Formatted with Biome.

---

## 2026-11-02T20:15:00+02:00: 3D Borehole Collar-to-Toe Vector Math & 2D Canvas Viewport Projection

### Purpose

Provide zero-dependency 3D borehole collar-to-toe vector math and 2D Canvas viewport projection/culling (`spatial-projection.ts`) distilled from `Three.js`, `PixiJS`, and `Taal` spatial math so `Arch-System` can project 3D boreholes and 2D pit/muster coordinates onto `FastTelemetryChart`-style Canvas 2D surfaces without heavy WebGL game engine bundles.

### Changes Made

1. **`src/spatial-projection.ts`**:
   - Implemented `computeBoreholeToeCoordinates` following mining survey conventions (`-90°` vertical down, `0°` horizontal; azimuth `0°` North, `90°` East) with 3-decimal precision rounding.
   - Implemented `projectWorldToCanvas2D` with normalized viewport bounds checks, North-up Y-axis inversion (`isInvertedNorthAxis ?? true`), and viewport culling (`isWithinViewport`).
2. **`src/spatial-projection.test.ts`**:
   - Added unit test suite covering vertical (`-90°`), angled (`-60°`), horizontal (`0°`), negative azimuth boreholes, invalid inputs, and Canvas 2D projection/viewport culling.
3. **`package.json` & `src/index.ts`**:
   - Exported `./spatial-projection` and all spatial projection interfaces/constants.

---

## 2026-11-02T14:30:00+02:00: Deterministic Feature Flag & Rollout Evaluation Utility

### Purpose

Provide a zero-dependency, deterministic targeting and percentage-rollout evaluator (`feature-flags.ts`) supporting department, site, role, employee, and shift-type rules with SHA-256 bucketing.

### Changes Made

1. **`src/feature-flags.ts`**:
   - Implemented deterministic bucketing (`calculatePercentageBucket`).
   - Implemented rule targeting evaluation (`evaluateTargetingRule`).
   - Implemented full flag evaluation (`evaluateFeatureFlag`) with fallback to default values.
2. **`src/feature-flags.test.ts`**:
   - Added unit test suite covering equality, membership, percentage rollout, and disabled flag semantics.
3. **`package.json` & `src/index.ts`**:
   - Exported `./feature-flags` and types.

---

## 2026-11-02T13:28:00+02:00: Tamper-Evident SHA-256 Audit Chaining Utility

### Purpose

Provide zero-dependency cryptographic hash chaining (`crypto-audit.ts`) as a lightweight, zero-overhead Web3 alternative for immutable shift closeouts and safety incident audit trails.

### Changes Made

1. **`src/crypto-audit.ts`**:
   - Implemented canonical JSON stringification (`canonicalJsonStringify`).
   - Implemented deterministic SHA-256 hash chaining (`computeTamperEvidentHash`) linking records to `previousHash`.
   - Implemented linear sequence verification (`verifyTamperEvidentChain`).
2. **`package.json` & `src/index.ts`**:
   - Exported `./crypto-audit` and tested 100% pass across tampering and broken chain test cases.

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

- [2026-11-05T10:06:24Z] Enforced Biome 2.5.14 official CI/Turborepo root tasks (//#check, //#check:fix, //#lint:ci), strict rules (noUnusedVariables: error, noUnusedImports: error, domains.types: recommended), Rspack 2.x parity audit, and Turbopack Rust React Compiler + persistent FS cache.
- [2026-11-06T12:04:30+02:00] Removed redundant `src/excel.browser.ts` and `src/parse-excel.ts` files already consolidated into `src/excel.ts`.
