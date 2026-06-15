---
description: Phase 2 implementation plan — seven-layer safety system, agentic loop, advanced tooling. Target: ~50% Claude Code parity.
inclusion: auto
---

# Phase 2: Core Agent Loop & Safety System

## Architecture Overview

Three subsystems wired through the hook system:

```
PreToolUse ──→ safety-gate.js (7 layers: budget → permission → isolation → content → rate → audit → user)
                    │
                    ├── allow  → proceed with tool call
                    └── block  → exit code 2, attach reason to stderr

PostToolUse ──→ loop-persist.js (update state machine after each action)
               audit-log.js (structured audit event to LTM)

SubagentStart ──→ loop-scheduler.js (dispatch, timeout, health check)
SubagentStop  ──→ loop-aggregate.js (collect results, update task queue)

SessionStart ──→ loop-resume.js (restore state machine, check pending tasks)
SessionEnd   ──→ loop-save.js (persist final state, LTM checkpoint)
```

---

## Subsystem 1: Seven-Layer Safety System

Location: `.kiro/safety/`

### Files

| File                                       | Purpose                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `.kiro/safety/index.js`                    | Safety orchestrator — runs all 7 layers, returns allow/block decision        |
| `.kiro/safety/layers/01-budget.js`         | Tool call budget: per-session counter, hard limits (warn at 40, block at 80) |
| `.kiro/safety/layers/02-permission.js`     | Allow/deny rules from settings.local.json, deny-by-default mode              |
| `.kiro/safety/layers/03-isolation.js`      | Command allowlist, path restrictions, dangerous pattern blocking             |
| `.kiro/safety/layers/04-content-filter.js` | PII/secret regex scan + output content safety check                          |
| `.kiro/safety/layers/05-rate-limiter.js`   | Sliding window (60s), per-tool type counters, auto-cooldown                  |
| `.kiro/safety/layers/06-audit-log.js`      | Write structured audit event to `ltm/store/audit.jsonl`                      |
| `.kiro/safety/layers/07-user-control.js`   | Persistent exception store, auto-approve patterns, trust levels              |
| `.kiro/safety/policies/default.json`       | Default policy: warn on suspicious, block on dangerous                       |
| `.kiro/safety/policies/strict.json`        | Strict: deny-by-default, only explicitly allowed operations                  |
| `.kiro/safety/policies/permissive.json`    | Permissive: auto-approve known patterns, block only critical                 |
| `.kiro/safety/exceptions.json`             | User-approved persistent exceptions                                          |

### Layer Interface

Every layer exports: `(toolCall, context) => { allow, reason, severity, layer }`

- `toolCall`: `{ tool, input, sessionId }` — the current tool invocation
- `context`: `{ policy, budget, rateCounts, sessionStart }` — shared execution context
- Returns: `{ allow: boolean, reason: string, severity: 'info'|'warn'|'block' }`

### Wiring

Added to `settings.json` PreToolUse matcher `"*"`:

```json
{
  "type": "command",
  "command": "node \"/home/timothy/Project/Arch-Mk2/.kiro/safety/index.js\""
}
```

Exit codes: 0 = allow, 2 = block (hook stops tool execution)

---

## Subsystem 2: Agentic Loop State Machine

Location: `.kiro/loop/`

### States

```
IDLE → ANALYZE → PLAN → EXECUTE → VERIFY → REPORT → IDLE
                  ↑         |          |         |
                  └─────────┘          └────BLOCKED
                        (re-plan)    (retry/fallback/resume)
```

| State   | Description                                                      |
| ------- | ---------------------------------------------------------------- |
| IDLE    | No active task. Waiting for user input.                          |
| ANALYZE | Task classification, blast radius, dependency discovery          |
| PLAN    | Decompose into units, create task-list.json, assign priorities   |
| EXECUTE | Dispatch subagents, monitor progress, handle failures            |
| VERIFY  | Run validation (lint, typecheck, test), quality gate             |
| REPORT  | Synthesize results, save LTM checkpoint, present to user         |
| BLOCKED | Task blocked (rate limit, missing info, conflict). Wait/resolve. |

### Files

| File                      | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `.kiro/loop/index.js`     | State machine engine: transitions, persistence, hook dispatch |
| `.kiro/loop/queue.js`     | Task queue: priority sort, dependency resolution, CRUD        |
| `.kiro/loop/scheduler.js` | Subagent dispatch: health check, timeout, result aggregation  |
| `.kiro/loop/recovery.js`  | Error recovery: retry with backoff, circuit break, fallback   |
| `.kiro/loop/context.js`   | Context window manager: progressive load, pressure monitor    |
| `.kiro/loop/state.json`   | Persistent state file (machine-readable, LTM-backed)          |

### State JSON Schema

```json
{
  "session_id": "ses_xxx",
  "state": "idle|analyze|plan|execute|verify|report|blocked",
  "current_task": { "id": "t-001", "description": "...", "priority": 1 },
  "queue": [
    {
      "id": "t-002",
      "description": "...",
      "priority": 2,
      "dependencies": [],
      "status": "pending"
    }
  ],
  "subagents": [
    {
      "id": "unit-1",
      "agent": "scout",
      "status": "running",
      "started_at": "..."
    }
  ],
  "history": [
    {
      "state": "plan",
      "entered_at": "...",
      "exited_at": "...",
      "result": "..."
    }
  ],
  "metrics": {
    "tool_calls_total": 127,
    "tokens_used": 45000,
    "subagents_dispatched": 8,
    "errors": 2
  }
}
```

### Wiring

| Hook Event   | Script                          | When                                     |
| ------------ | ------------------------------- | ---------------------------------------- |
| PreToolUse   | `loop/index.js` state='execute' | Check queue, throttle dispatch if busy   |
| PostToolUse  | `loop/index.js`                 | Persist state, update metrics            |
| SubagentStop | `loop/index.js`                 | Aggregate results, check if all complete |
| SessionStart | `loop/index.js` restore         | Resume from saved state                  |
| SessionEnd   | `loop/save-state.js`            | Save final state to LTM checkpoint       |

---

## Subsystem 3: Advanced Tooling

### Shell Command Sandbox

File: `.kiro/tools/shell-sandbox.js`

Features:

- Command allowlist (pre-approved commands from settings.local.json)
- Dangerous pattern detection (rm -rf, sudo, pipes to shell)
- Path restriction (reject writes outside project dir)
- Execution timeout (30s default)
- Output truncation (100KB max)

### File Diff Preview

File: `.kiro/tools/file-diff.js`

Features:

- Pre-edit diff generation via `git diff`
- Highlight lines added/removed/changed
- Reject edits that modify too many lines (>200)
- Builds on existing `read-before-write.js`

### Tool Composition Engine

File: `.kiro/tools/composer.js`

Features:

- Chain simple tools: `Read → Edit → Lint → Check` as one operation
- Parallel tool execution with result merging
- Error rollback on partial failure

---

## Migration & Integration

### Files to Create

```
.kiro/
├── safety/
│   ├── index.js
│   ├── layers/
│   │   ├── 01-budget.js
│   │   ├── 02-permission.js
│   │   ├── 03-isolation.js
│   │   ├── 04-content-filter.js
│   │   ├── 05-rate-limiter.js
│   │   ├── 06-audit-log.js
│   │   └── 07-user-control.js
│   ├── policies/
│   │   ├── default.json
│   │   ├── strict.json
│   │   └── permissive.json
│   └── exceptions.json
├── loop/
│   ├── index.js
│   ├── queue.js
│   ├── scheduler.js
│   ├── recovery.js
│   ├── context.js
│   └── state.json
├── tools/
│   ├── shell-sandbox.js
│   ├── file-diff.js
│   └── composer.js
└── steering/
    └── phase2-plan.md      [this file]
```

### Files to Modify

| File                           | Change                                                  |
| ------------------------------ | ------------------------------------------------------- |
| `.kiro/settings.json`          | Add safety-gate PreToolUse hook; add loop persist hooks |
| `.kiro/settings.local.json`    | Add loop restore hooks; update permissions              |
| `.kiro/agents/digital-twin.md` | Reference safety system and loop states                 |
| `.kiro/agents/team-lead.md`    | Use loop queue for task management                      |

---

## Implementation Order

### Phase 2a: Safety System (7 layers)

1. Create `.kiro/safety/` directory structure and policy files
2. Implement layer 2 (permission) — reuse existing allow/deny rules
3. Implement layer 1 (budget) — port from tool-call-budget.js with hard limits
4. Implement layer 3 (isolation) — dangerous command blocking
5. Implement layer 5 (rate limiter) — sliding window counters
6. Implement layer 4 (content filter) — port from secret-scan.js
7. Implement layer 6 (audit log) — structured events to LTM
8. Implement layer 7 (user control) — exception store
9. Implement orchestrator (`index.js`) — chain all layers
10. Wire to `settings.json` PreToolUse
11. Test all 7 layers with known inputs

### Phase 2b: Agentic Loop

12. Create `.kiro/loop/` directory and state.json
13. Implement state machine engine (`index.js`)
14. Implement task queue (`queue.js`)
15. Implement scheduler (`scheduler.js`)
16. Implement recovery (`recovery.js`)
17. Implement context manager (`context.js`)
18. Wire loop hooks to settings.json/local.json
19. Test state transitions with mock actions

### Phase 2c: Advanced Tooling

20. Create shell sandbox (`tools/shell-sandbox.js`)
21. Create file diff preview (`tools/file-diff.js`)
22. Create tool composer (`tools/composer.js`)
23. Wire to hooks
24. Integration test all three subsystems
