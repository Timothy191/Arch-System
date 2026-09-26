# Arch-CorpOS Agentic Governance & Win Loops

This directory (`.agents/`) contains the Agent Governance infrastructure and the Arch-CorpOS autonomous business loop runner (Win Loop implementation).

## 1. Agent Governance Hooks

Located in `.agents/hooks/`, these scripts guard subagent execution boundaries:

- `pre-invocation-inject.sh`: Injects context prior to agent boot.
- `pre-tool-guard.sh`: Prevents operations outside of designated scopes (e.g. restricts access to system files or destructive commands).
- `post-tool-tracer.sh`: Logs executed operations and metadata to `.agents/audit.log`.
- `worktree-guard.sh`: Ensures agents do not operate directly on protected branches (like `main`) without a clean git state or worktree isolation.

## 2. Arch-CorpOS Business Loops

Located in `.agents/corpos/` and `.agents/loops/`, this system implements the "Win Loop" architecture, a synthesis of `win.sh`, `CorpOS`, and `ai-company`.

### Key Components

- **corpos**: The central CLI binary (`.agents/corpos/bin/corpos`).
- **tick.sh**: The execution engine that ingests a signal, evaluates rules, outputs a strategic brief, invokes verification gates, captures artifacts, determines outcomes, logs to the append-only journal, and schedules the next run (`.agents/corpos/engine/tick.sh`).
- **corpos.config.json**: Defines the organizational departments and their authority ceilings.

### How to use

```bash
# Check system status
pnpm corpos status

# Trigger a manual tick (dry run)
pnpm corpos tick codebase-health --dry-run
```

For detailed specifications of the Win Loop engine, see `.agents/corpos/SPEC.md`.
