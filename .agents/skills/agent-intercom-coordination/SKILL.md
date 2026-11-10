---
name: agent-intercom-coordination
description: Procedure for coordinating concurrent multi-agent file claims, whiteboard updates, and intercom messaging to prevent overlapping edits.
---

# Agent Intercom & Whiteboard Coordination Skill

## Purpose

When multiple agents or subagent swarms operate concurrently across the Arch-System monorepo, uncoordinated file edits can cause merge conflicts, silent overwrites, and state corruption. This skill governs the usage of the Agent Intercom & Whiteboard (AWI) protocol.

## Core Protocols

### 1. File Claim Acquisition (Exclusive Locking)

Before mutating any source file (`.ts`, `.tsx`, `.cjs`, `.sql`, etc.), an agent MUST acquire a file claim:

```bash
pnpm agent:claim <agentId> <filePath> "<intent>"
```

- If another agent holds an active claim on the file, the acquisition throws a conflict error.
- Claims carry an automatic TTL (default 30 minutes) and can be renewed by re-running the claim command.

### 2. File Claim Release

Immediately upon completing edits and running targeted verification, the agent MUST release the file claim:

```bash
pnpm agent:release <agentId> <filePath>
```

### 3. Intercom Broadcasting

When introducing breaking changes, database migrations, or public API contract updates, agents MUST broadcast a notification to the federation:

```bash
pnpm agent:talk <agentId> "Updated Zod contract schema in packages/contract" ALL UPDATE
```

### 4. Whiteboard Canvas Inspection & Update

Review active swarm tasks and register milestones on the shared canvas:

```bash
pnpm agent:whiteboard
```
