# Universal React Hooks & Agent Hooks Architecture — Strategic Outline

## 1. Executive Summary & Problem Framing
The user requested extracting, adapting, and refactoring beneficial hooks from key open-source repositories:
1. **React Application Hooks (`alibaba/hooks`, `streamich/react-use`, `uidotdev/usehooks`):**
   - Currently, `@repo/shared/hooks` contains only a minimal set of hooks (`usePitConnectivity`, `useSupabaseRealtime`, `useThrottledState`, `useCommandScope`, `useOptimisticAction`).
   - Adding a robust, production-grade suite of shared React hooks tailored for Next.js 16 App Router, React 19, Supabase, and real-time mining operations (debouncing, throttling, polling, local storage, clipboard, click outside, online status, media queries, lifecycle refs).
2. **Agent & Workflow Hooks (`disler/claude-code-hooks-mastery`):**
   - Arch-System monorepo uses multi-agent coordination (Orca, Antigravity, Claude, Gemini).
   - Establishing structured agent hooks inside `.agents/hooks/` registered via `.agents/hooks.json` to enforce execution guardrails, tool call safety, clean worktrees, RTK token savings logging, and automated quality gate assertions.

## 2. Real-World Council Viewpoints
- **Frontend Lead:** "Shared UI components need battle-tested React 19 hooks for debouncing search filters, throttling SCADA gauge updates, handling local storage options, and tracking online/offline transitions without introducing external heavy dependencies."
- **DevOps & Infrastructure:** "Agent hooks must execute cleanly in bash without blocking agent invocations. All pre-tool and post-tool hooks must handle timeouts gracefully and sanitize terminal output."
- **Security Lead:** "Pre-tool execution hooks must block destructive commands on protected system files (`/usr/share/omarchy/`) and enforce worktree clean states."

## 3. Scope Breakdown
- **Package `@repo/shared/hooks` (`libs/shared/hooks`):**
  - Implement 12 essential React hooks: `useDebounce`, `useDebounceFn`, `useThrottle`, `useThrottleFn`, `useLocalStorage`, `useSessionStorage`, `usePolling`, `useOnlineStatus`, `useClickOutside`, `useCopyToClipboard`, `useMediaQuery`, `useLatest`, `usePrevious`, `useMount`, `useUnmount`, `useUpdateEffect`.
  - Re-export all hooks from `libs/shared/hooks/src/index.ts`.
  - Provide unit tests in `libs/shared/hooks/src/__tests__/`.
- **Agent Governance Hooks (`.agents/hooks/` & `.agents/hooks.json`):**
  - Create executable bash hook scripts in `.agents/hooks/`:
    - `pre-tool-guard.sh`: Verifies safety rules, blocks forbidden operations, checks protected paths.
    - `post-tool-tracer.sh`: Captures operational telemetry and updates trace logs.
    - `worktree-guard.sh`: Enforces clean worktree invariant.
  - Update `.agents/hooks.json` registering the hooks for `PreToolUse`, `PostToolUse`, `PreInvocation`, and `Stop` events.
