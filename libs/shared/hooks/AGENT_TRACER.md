# @repo/shared/hooks Agent Tracer

## 2026-11-02T14:35:00+02:00: Accessibility-Aware IntersectionObserver Scroll Reveal Hook

### Purpose

Provide a zero-dependency React 19 hook (`useScrollReveal.ts`) inspired by jlmakes/scrollreveal with automatic `prefers-reduced-motion: reduce` fallback for industrial pit tablets.

### Changes Made

1. **`src/useScrollReveal.ts`**:
   - Implemented `useScrollReveal` with configurable threshold, rootMargin, and triggerOnce.
   - Handled reduced motion query by revealing immediately and bypassing IntersectionObserver.
2. **`src/useScrollReveal.test.ts`**:
   - Added BDD unit test suite verifying intersection behavior, reduced-motion bypass, and toggle transitions.
3. **`src/index.ts`**:
   - Exported `useScrollReveal` and its types.

---

## 2026-08-17: Add @types/node dependency to fix TypeScript check

### Purpose

Fix TypeScript build failure (`TS2580: Cannot find name 'process'`) in `src/client-telemetry.ts`.

### Changes Made

1. Added `"@types/node": "catalog:"` to `devDependencies` in `libs/shared/hooks/package.json`.

### What the Next Agent Should Know

- `shared-hooks` requires `@types/node` for accessing `process.env` in client telemetry logging.

## 2026-09-11: Universal Shared React Hooks Implementation

### Purpose

Extract and formalize 16 zero-dependency React 19 application hooks within `@repo/shared/hooks` alongside agent governance guardrails in `.agents/hooks/`.

### Changes Made

1. Added `types.ts` defining contract interfaces (`DebounceOptions`, `ThrottleOptions`, `PollingOptions`, `StorageOptions`, `ClipboardState`).
2. Implemented `useDebounce`, `useDebounceFn`, `useThrottle`, `useThrottleFn`.
3. Implemented `useLocalStorage`, `useSessionStorage` using `useSyncExternalStore`.
4. Implemented `useOnlineStatus`, `usePolling`, `useClickOutside`, `useCopyToClipboard`, `useMediaQuery`.
5. Implemented `useLatest`, `usePrevious`, `useMount`, `useUnmount`, `useUpdateEffect`.
6. Barrel-exported all hooks in `src/index.ts`.

## 2026-10-23: Offline queue replays carry an idempotency key

### Purpose

A queued mutation replayed after reconnect had no identity, so `/api/sync/fallback`
re-executed it and a double-tapped closeout could write two rows.

### Changes Made

1. `src/useOfflineQueue.ts` now stamps each replay with `x-idempotency-key: req.id`
   (the queue id is already unique per queued mutation) alongside the stored
   headers.

### What the Next Agent Should Know

- The header is the contract with the server: `@repo/redis` `claimIdempotency`
  answers a repeat with the stored result (`'duplicate'`) instead of running the
  work again. Changing the queue id format changes replay semantics.

## 2026-10-29: Cross-tab heartbeat coordination via BroadcastChannel in `usePitConnectivity`

### Purpose

Prevent `N` open foreground tabs from issuing duplicate `/api/health/live` probes in the same heartbeat window (`P3-T1`).

### Changes Made

1. Added `PIT_CONNECTIVITY_CHANNEL` (`arch:pit-connectivity`) `BroadcastChannel` broadcasting and listening in `src/usePitConnectivity.ts`. When any tab completes a probe, peer tabs adopt its `status` and `latencyMs` and reschedule their own probe timer (`scheduleNext()`).

## 2026-11-02: Add `useThrottledDebounce` and `useThrottledDebounceFn` to `@repo/shared/hooks`

### Purpose

Provide a combined throttle + trailing-debounce hook and controller in `@repo/shared/hooks` (`useThrottledDebounce` and `useThrottledDebounceFn`) for high-frequency filter/table inputs that need periodic visual feedback during continuous typing and guaranteed final-state settlement.

### Changes Made

1. Added `ThrottledDebounceOptions` to `src/types.ts`.
2. Created `src/useThrottledDebounce.ts`, `src/useThrottledDebounce.test.ts`, `src/useDebounce.test.ts`, `src/useThrottle.test.ts`, `src/useCopyToClipboard.test.ts`, and `src/useMediaQuery.test.ts`.
3. Exported `useThrottledDebounce` from `src/index.ts` and `package.json` `exports`.
4. Verified all 7 test suites (26/26 tests passing) and zero Knip unlisted dependency warnings.

## 2026-11-02: Add co-located tests for throttle, clipboard, and media query hooks

### Purpose

Cover previously untested shared hooks requested by the test-suite hardening pass.

### Changes Made

1. Added `src/useThrottle.test.ts` for throttled values, leading callback execution, trailing execution, and cancellation.
2. Added `src/useCopyToClipboard.test.ts` for successful writes, reset behavior, missing clipboard support, and write failures.
3. Added `src/useMediaQuery.test.ts` for matching snapshots, change subscriptions, cleanup, and missing `matchMedia`.

## 2026-11-06T09:44:00+02:00: Integrate `styled-breakpoints` Media Query Builders (`breakpoints.up / down / between / only`)

- **Phase 1 (Comprehension)**: Provide typed, zero-CSS-in-JS media query string builders (`up`, `down`, `between`, `only`) and reactive breakpoint hooks (`useBreakpointUp`, `useBreakpointDown`, `useBreakpointBetween`) in `@repo/shared/hooks` (`src/useMediaQuery.ts`), distilled from `mg901/styled-breakpoints`.
- **Phase 2 (Evidence)**: Inspected `libs/shared/hooks/src/useMediaQuery.ts`, `libs/shared/hooks/src/useMediaQuery.test.ts`, and `.agents/rules/css-in-js.md`.
- **Phase 3 (Design)**: Added `ARCH_BREAKPOINTS_PX` (`xs: 0`, `sm: 640`, `md: 768`, `lg: 1024`, `xl: 1280`, `2xl: 1536`) and `breakpoints` helper with `-0.02px` exclusive upper-bound precision so `up('md')` and `down('md')` never overlap at `768px`.
- **Phase 4 (Criticism)**: Preserved zero CSS-in-JS dependencies and added `typeof window !== 'undefined'` guards in `useMediaQuery.test.ts`.
- **Phase 5 (Contract)**: Modified `src/useMediaQuery.ts` and `src/useMediaQuery.test.ts`; verified with `pnpm --filter @repo/shared/hooks test` and `pnpm --filter @repo/shared/hooks type-check`.
