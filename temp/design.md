# Universal React Hooks & Agent Hooks — Technical Design

## 1. Architectural Overview

```
+-----------------------------------------------------------------------------------+
|                            ARCH-SYSTEM MONOREPO                                   |
|                                                                                   |
|  [ React Application Layer ]                     [ Agent Governance Layer ]       |
|  libs/shared/hooks/src/                          .agents/ & .agents/hooks/        |
|  +---------------------------+                   +-----------------------------+  |
|  | - useDebounce / Fn        |                   | - hooks.json                |  |
|  | - useThrottle / Fn       |                   | - pre-tool-guard.sh         |  |
|  | - useLocalStorage         |                   | - post-tool-tracer.sh       |  |
|  | - useSessionStorage       |                   | - worktree-guard.sh         |  |
|  | - usePolling              |                   +--------------+--------------+  |
|  | - useOnlineStatus         |                                  |                 |
|  | - useClickOutside         |                                  v                 |
|  | - useCopyToClipboard      |                   +-----------------------------+  |
|  | - useMediaQuery           |                   | Orca / Antigravity Agent    |  |
|  | - useLatest / usePrevious |                   | Lifecycle Execution Fabric  |  |
|  | - useMount / useUnmount   |                   +-----------------------------+  |
|  +-------------+-------------+                                                    |
|                |                                                                  |
|                v                                                                  |
|  +---------------------------+                                                    |
|  | @repo/shared/hooks        |                                                    |
|  | Barrel exported SSoT      |                                                    |
|  +---------------------------+                                                    |
+-----------------------------------------------------------------------------------+
```

## 2. Shared React Hooks Package Structure (`libs/shared/hooks`)

### Exported Modules (`src/index.ts`):
- `useDebounce<T>(value: T, delay: number): T`
- `useDebounceFn<T extends (...args: any[]) => any>(fn: T, delay: number): { run: T; cancel: () => void }`
- `useThrottle<T>(value: T, delay: number): T`
- `useThrottleFn<T extends (...args: any[]) => any>(fn: T, delay: number): { run: T; cancel: () => void }`
- `useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void, () => void]`
- `useSessionStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void, () => void]`
- `usePolling(callback: () => void, intervalMs: number | null, options?: { immediate?: boolean }): { isPolling: boolean; pause: () => void; resume: () => void }`
- `useOnlineStatus(): boolean`
- `useClickOutside(ref: RefObject<HTMLElement | null>, handler: (event: MouseEvent | TouchEvent) => void): void`
- `useCopyToClipboard(timeoutMs?: number): { isCopied: boolean; copy: (text: string) => Promise<boolean>; error: Error | null }`
- `useMediaQuery(query: string): boolean`
- `useLatest<T>(value: T): React.MutableRefObject<T>`
- `usePrevious<T>(value: T): T | undefined`
- `useMount(fn: () => void): void`
- `useUnmount(fn: () => void): void`
- `useUpdateEffect(effect: EffectCallback, deps?: DependencyList): void`

---

## 3. Agent Governance & Hook Master Pipeline (`.agents/hooks/`)

### `.agents/hooks.json` Configuration:
```json
{
  "agent-execution-guardrails": {
    "enabled": true,
    "description": "Autonomously active guardrails enforcing compliance, security policies, and AGENTS.md standards."
  },
  "PreToolUse": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "/bin/bash .agents/hooks/pre-tool-guard.sh",
          "timeout": 5
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "/bin/bash .agents/hooks/post-tool-tracer.sh",
          "timeout": 5
        }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "/bin/bash .agents/hooks/worktree-guard.sh",
          "timeout": 10
        }
      ]
    }
  ]
}
```

### Script Implementations:
1. `.agents/hooks/pre-tool-guard.sh`: Checks environment variables, denies writes to `/usr/share/omarchy/`, validates `rtk` usage.
2. `.agents/hooks/post-tool-tracer.sh`: Records tool execution metadata into workspace telemetry.
3. `.agents/hooks/worktree-guard.sh`: Performs `git status --porcelain` audit to alert on uncommitted untracked temporary files before ending turn.
