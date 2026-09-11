# Universal React Hooks & Agent Hooks — Requirements Specification (EARS Syntax)

## 1. Shared React Hooks Requirements (`@repo/shared/hooks`)
- **REQ-HOOK-001:** WHEN a component needs debounced values or functions, THE SYSTEM SHALL provide `useDebounce` and `useDebounceFn` with configurable delay milliseconds and clean unmount cancellation.
- **REQ-HOOK-002:** WHEN high-frequency events occur (SCADA sensor polling, resize, scroll), THE SYSTEM SHALL provide `useThrottle` and `useThrottleFn` limiting execution rate.
- **REQ-HOOK-003:** WHEN interacting with browser storage, THE SYSTEM SHALL provide `useLocalStorage` and `useSessionStorage` with JSON serialization, fallback default values, and cross-tab window `storage` event synchronization.
- **REQ-HOOK-004:** WHEN periodic telemetry polling is active, THE SYSTEM SHALL provide `usePolling` / `useInterval` supporting dynamic interval adjustments, pause/resume, and immediate execution flags.
- **REQ-HOOK-005:** WHEN monitoring network connectivity, THE SYSTEM SHALL provide `useOnlineStatus` returning real-time browser online/offline status via `navigator.onLine` and `online`/`offline` window events.
- **REQ-HOOK-006:** WHEN detecting user clicks outside target elements (modals, popovers, dropdowns), THE SYSTEM SHALL provide `useClickOutside` accepting element refs and callback handlers.
- **REQ-HOOK-007:** WHEN copying text to clipboard, THE SYSTEM SHALL provide `useCopyToClipboard` returning copied state, error state, and auto-reset timeout duration.
- **REQ-HOOK-008:** WHEN evaluating responsive design breakpoints, THE SYSTEM SHALL provide `useMediaQuery` subscribing to `window.matchMedia` query changes.
- **REQ-HOOK-009:** WHEN tracking dynamic state history or refs, THE SYSTEM SHALL provide `usePrevious` and `useLatest` to prevent stale closure bugs in async callbacks.
- **REQ-HOOK-010:** WHEN component lifecycle events fire, THE SYSTEM SHALL provide `useMount`, `useUnmount`, and `useUpdateEffect` executing strictly on initial mount, cleanup, or subsequent dependency updates.

## 2. Agent Governance Hooks Requirements (`.agents/hooks/` & `.agents/hooks.json`)
- **REQ-AGNT-001:** WHEN an agent attempts a tool invocation, THE SYSTEM SHALL execute `pre-tool-guard.sh` verifying target paths against protected read-only directories (`/usr/share/omarchy/`) and blocking dangerous shell commands.
- **REQ-AGNT-002:** WHEN an agent completes a tool invocation, THE SYSTEM SHALL execute `post-tool-tracer.sh` recording tool telemetry and RTK token optimization logs.
- **REQ-AGNT-003:** WHEN an agent session ends or receives a stop signal, THE SYSTEM SHALL execute `worktree-guard.sh` verifying clean git worktree status per `end-of-turn-clean-worktree.md` rules.
- **REQ-AGNT-004:** WHEN `.agents/hooks.json` is processed, THE SYSTEM SHALL define structured JSON hook schemas linking `PreToolUse`, `PostToolUse`, `PreInvocation`, and `Stop` handlers.
