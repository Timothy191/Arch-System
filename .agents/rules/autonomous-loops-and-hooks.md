---
description: Autonomous Lifecycle Hooks and Background Maintenance Loops
globs: ["**/*"]
alwaysApply: true
---

# Autonomous Lifecycle Hooks & Background Loops

**Governing Rule:** `ALH-0 — System health, memory consistency, AST safety, and quality gates are continuously enforced via automated lifecycle hooks and background watchdog loops.`

---

## 1. Unified Lifecycle Hooks

The repository connects four key hook layers via `tools/scripts/hooks-bridge.cjs`:

```
+----------------------------------------------------------------------------------------------------+
|                                    Unified Hooks Bridge                                            |
+----------------------------------------------------------------------------------------------------+
        |                         |                         |                         |
        v                         v                         v                         v
+-----------------+       +-----------------+       +-----------------+       +-----------------+
| Git (.husky/)   |       | Orca (~/.orca/) |       | Gemini Engine   |       | Claude Plugin   |
| • pre-commit    |       | • Antigravity   |       | • hooks.json    |       | • AST Auto-     |
| • post-commit   |       |   event bridge  |       | • Pre/PostTool  |         Approval Gate   |
| • pre-push      |       +-----------------+       +-----------------+       +-----------------+
+-----------------+
```

### Hook Responsibilities

- **`git:pre-commit`**: Validates AST compound commands and staged code against lint rules.
- **`git:post-commit`**: Automatically re-indexes the memory base (`.memory_base/index.json`) and verifies tracer logs.
- **`agent:PreToolUse`**: Validates shell commands before execution via `check-compound-bash.cjs`.
- **`agent:PostToolUse`**: Acknowledges tool completion and logs telemetry to `.a2a/bus/hook-events.jsonl`.

---

## 2. Background Watchdog Loops

The autonomous watchdog (`tools/scripts/autonomous-watchdog.cjs`) runs continuous maintenance routines:

1. **`memory-sync`**: Ensures all skills, rules, and architecture specs are registered in `.memory_base/index.json`.
2. **`tracer-integrity`**: Verifies that every discrete task log in `archive/tracers/log/` is indexed in `archive/tracers/README.md`.
3. **`ast-safety-audit`**: Verifies that shell parser rules reject dangerous operators and approve safe chains.
4. **`policy-boundary`**: Validates monorepo dependency boundaries via `tools/repo/policy-compiler.cjs`.
5. **`codebase-health` (Corpos)**: Executes periodic static analysis and reports health outcomes to `.agents/corpos/storage/`.
