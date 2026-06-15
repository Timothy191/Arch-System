---
description: Agent teams coordination protocol for parallel subagent execution. Defines task-list format, worktree lifecycle, and communication rules for team-lead orchestrated work.
inclusion: auto
---

# Agent Teams Coordination Protocol

This steering defines how agents coordinate when working in parallel teams.

## Task List Format

Location: `.kiro/worktrees/task-list.json`

```json
{
  "task_id": "task-<timestamp>",
  "objective": "High-level goal of the task",
  "units": [
    {
      "id": "unit-1",
      "description": "Short description of this work unit",
      "agent_type": "frontend-developer | debugger | scout | reviewer | test-writer | security-reviewer",
      "files": ["relative/path/to/file.ts"],
      "instructions": "Step-by-step instructions for the subagent",
      "status": "pending | running | complete | failed",
      "result_summary": null,
      "assignee": null
    }
  ],
  "created_at": "2026-05-16T20:00:00Z",
  "completed_at": null,
  "lead_notes": "Optional notes from team lead"
}
```

## Status Transitions

- `pending` → `running`: When a subagent picks up the unit
- `running` → `complete`: Subagent finishes successfully, writes result_summary
- `running` → `failed`: Subagent reports failure, lead must reassign
- `failed` → `running`: Lead reassigns to another subagent

## Worktree Lifecycle

1. Create: `git worktree add ../Arch-Mk2-{unit-id} HEAD`
2. Work: Subagent operates in the worktree directory
3. Merge: Lead pulls changes from worktree or applies diff
4. Remove: `git worktree remove ../Arch-Mk2-{unit-id}` and `git worktree prune`

Max 3 concurrent worktrees. Name worktrees with the unit id for tracking.

## Communication Rules

- Subagents do NOT communicate directly with each other
- All coordination happens through the task-list.json file
- The team lead is the single point of merge and conflict resolution
- Subagents report results via result_summary in their unit entry

## Conflict Resolution

When subagent outputs conflict:

1. Read both outputs completely
2. Identify the specific points of conflict
3. Check which output better matches project conventions (CLAUDE.md, DESIGN.md)
4. Make a judgment call and document the decision in lead_notes
5. If unsure, ask the user

## When to Use Agent Teams

Use this protocol when:

- Task touches 5+ files across multiple directories
- Task has clearly independent sub-tasks
- Task benefits from parallel investigation (bug hunting, research)
- Task has both read-only analysis and implementation phases

Skip when:

- Single-file change with clear instructions
- Emergency hotfix (execute directly)
- Related changes that create merge conflicts (same file, same section)
