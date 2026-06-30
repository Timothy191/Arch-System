# Scripts Agent Tracer

## 2026-06-18: Optimized pre-flight cleanup find commands and set Node memory limit

### Purpose

Prevent system lockups/freezes during dev script and deploy script startups by optimizing the recursive python cache search and adding a memory cap to the Next.js dev server.

### Changes Made

1. **`03_operations_automation/dev.sh`**:
   - Optimized the `find` command that clears `__pycache__` directories by pruning `node_modules`, `.next`, `.nx`, `.git`, and `.turbo` subtrees.
   - Added `NODE_OPTIONS="${NODE_OPTIONS:- --max-old-space-size=4096}"` to the portal start process to prevent out-of-memory crashes during Turbopack compilation.

2. **`03_operations_automation/deploy.sh`**:
   - Optimized the `find` command that clears `__pycache__` directories in the pre-flight phase by pruning `node_modules`, `.next`, `.nx`, `.git`, and `.turbo` subtrees.

### Verification

- Run `time find . ...` shows finding pycache directories with pruning finishes in **0.008 seconds** compared to **4.1 seconds** without pruning (513x speedup).
- All changes verified to build and deploy.

### What the Next Agent Should Know

- Future cleanup find commands MUST explicitly ignore standard build/workspace folders (`node_modules`, `.next`, `.nx`, `.git`, `.turbo`) to avoid locking up client systems with I/O bottlenecks.
- Next.js portal uses `--turbopack` by default which runs multi-threaded and is extremely memory intensive. The memory cap of 4GB prevents swap-thrashing system freezes.
