---
description: Agent Intercom, Whiteboard, and File Claim Coordination Protocol
globs: ['**/*']
alwaysApply: true
---

# Agent Intercom, Whiteboard, and File Claim Coordination Protocol

When multiple autonomous agents or subagent swarms operate concurrently within `Arch-System`, they MUST adhere to the following multi-agent concurrency and communication protocol:

1. **Exclusive File Claims**: Before editing any source file, an agent must acquire an exclusive file claim via `pnpm agent:claim <agentId> <filePath> <intent>`.
2. **Conflict Prevention**: If a file is currently claimed by another active agent, requests will throw a conflict error. Agents must respect active locks and coordinate via intercom or switch to non-overlapping tasks.
3. **Prompt Release**: Immediately upon completing edits and running verification, release the file claim using `pnpm agent:release <agentId> <filePath>`.
4. **Intercom Broadcasts**: Broadcast breaking changes, Zod contract updates, or migration additions to the intercom channel via `pnpm agent:talk <sender> <content>`.
5. **Whiteboard Canvas**: Maintain high-level task visibility by updating and reviewing `.agents/a2a/whiteboard/canvas.md`.
