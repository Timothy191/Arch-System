---
description: "Multi-agent worktree isolation and concurrency collision avoidance"
paths: ["**/*"]
---

# Multi-Agent Worktree Concurrency & Collision Guard

## 1. Concurrency Context & Agent Awareness

- Multiple autonomous agents (e.g., Antigravity, Claude Code, background Corpos loops) may operate simultaneously in this repository.
- Agents must actively prevent file collisions, race conditions, and corrupted lockfiles.

## 2. Git Worktree Isolation

- Long-running feature development, broad multi-file refactors, or swarm executions MUST operate in isolated `git worktrees` (`.worktrees/<task-id>`) rather than on the shared primary working tree.
- When merging worktree branches, run verification gates (`pnpm quality`) in the target branch before integrating.

## 3. Workspace Lock & Resource Etiquette

- Never delete or bypass lockfiles (`pnpm-lock.yaml`, `.git/index.lock`) while another agent or background process is running.
- If a lock contention occurs, wait or verify process liveness before clearing stale locks.

## 4. Single Source of Truth

- Package boundaries: `tools/repo/policy-compiler.cjs`.
- Agent wire protocol: `.a2a/bus/event-log.jsonl`.
- Database schema: `packages/database/migrations/` and `packages/supabase/src/database.types.ts`.
