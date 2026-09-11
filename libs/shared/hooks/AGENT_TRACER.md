# @repo/shared/hooks Agent Tracer

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
