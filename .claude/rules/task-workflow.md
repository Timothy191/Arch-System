# Task & Workflow

## Task Complexity Triage

Default is quick mode (direct execution).

| Complexity                             | Action                                   |
| -------------------------------------- | ---------------------------------------- |
| Trivial (single file, no active tasks) | Execute directly                         |
| Any request while tasks exist          | TaskCreate FIRST                         |
| Moderate (2–5 files)                   | TaskCreate, then execute                 |
| High (architectural, 10+ files)        | **Ask** if user wants spec or quick mode |

## Task Management

**Always use task management in quick mode.** Tasks are working memory — without them, requests get lost during compaction. Skip only for a truly trivial one-shot with empty TaskList.

### Quick Mode: Task-First

Every user request gets a task BEFORE any code/research/substantive response: TaskCreate → in_progress → work → completed.

### On-Demand Interrupts

When the user sends a new request mid-work: STOP, TaskCreate for the new request as your FIRST tool call, then assess priority. If it's not in the task list, it will be forgotten.

### Other Rules

- **Session start:** TaskList first, delete stale tasks, create new ones for current request.
- **Cross-session isolation:** Tasks are scoped per session via CLAUDE_CODE_TASK_LIST_ID.
- **Deferring a request:** TaskCreate immediately — never just say "noted."

## Tool Parameter Exactness

| Tool                  | Correct                    | Wrong                             |
| --------------------- | -------------------------- | --------------------------------- |
| `Bash`                | `command`                  | `cmd`, `bash_command`, `shell`    |
| `Write`/`Edit`/`Read` | `file_path`                | `path`, `filepath`, `file`        |
| `Write`               | `content`                  | `contents`, `text`, `body`        |
| `Edit`                | `old_string`, `new_string` | `old`, `new`, `search`, `replace` |
| `Grep`                | `pattern`                  | `query`, `search`, `regex`        |

## Workflow Commands

Three primary workflows:

| Command | Use                                                                                                 | Model          |
| ------- | --------------------------------------------------------------------------------------------------- | -------------- |
| `/spec` | Feature or refactor needing a plan, approval, TDD, and verification                                 | Fresh subagent |
| `/fix`  | Quick bugfix — investigate, RED test, fix, E2E verify. Bails to `/spec` if scope exceeds quick lane | Direct         |
| `/prd`  | Brainstorming — vague ideas into concrete requirements before `/spec`                               | Direct         |

### Spec Workflow

```
/spec → Plan (explore → questions → spec → approval) → Implement (TDD per task) → Verify (tests + E2E + review)
```

- Plans live in markdown files
- One atomic commit per task
- Quality hooks auto-run on every edit
- E2E verification mandatory for UI changes

### Fix Workflow

```
Investigate → RED → Fix → E2E Verify → Quality Gate → Done
```

**Iron laws:**

1. NO FIXES WITHOUT ROOT CAUSE — traced to file:line, explained WHY.
2. NO CODE WITHOUT A FAILING REPRODUCING TEST — TDD.
3. FIX AT THE SOURCE — not where the error appears.
4. END-TO-END VERIFICATION IS MANDATORY — unit tests alone are never accepted as proof.
5. STOP WHEN OVER YOUR HEAD — multi-component / architectural bugs need `/spec`.

**Bail-out triggers:**

- Confidence is Low after investigation
- Two quick-lane fix attempts have already failed
- Fix introduces new abstractions (new module, API, data structure)
- Fix requires architectural redesign
- Net new production code likely exceeds ~150 lines
- Change crosses independent components with unrelated logic

### PRD Workflow

```
Understand → Research (optional) → Ideate (if vague) → Clarify → Converge → Write PRD → Hand off to /spec
```

- PRDs saved to `docs/prd/`
- Two modes: Divergent (free-form prose) vs Convergent (structured forms)
- Research tiers: Quick (skip) / Standard (web search) / Deep (parallel agents)
