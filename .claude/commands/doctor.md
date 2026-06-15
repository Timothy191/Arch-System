---
description: Diagnose Claude Code configuration and project setup
---

# /doctor - Configuration Health Check

Run a diagnostic on Claude Code and project setup.

## Checks

### 1. Git Status

```bash
git status --short
git stash list
```

### 2. Settings

```bash
cat .claude/settings.json 2>/dev/null | head -5
cat ~/.claude/settings.json 2>/dev/null | head -5
```

Check for conflicting settings between project and user level.

### 3. CLAUDE.md

```bash
wc -l CLAUDE.md 2>/dev/null || wc -l AGENTS.md 2>/dev/null || echo "No guide file found"
```

- < 60 lines: Ideal
- 60-150 lines: Acceptable
- > 150 lines: Consider splitting

### 4. MCP Servers

Check `.mcp.json` — target < 10 servers, < 80 tools.

### 5. Context Health

- Usage < 70%: Healthy
- Usage 70-90%: Consider `/compact`
- Usage > 90%: Compact immediately or start fresh

### 6. Package State

```bash
pnpm lint 2>&1 | tail -5
pnpm type-check 2>&1 | tail -5
pnpm test -- --silent 2>&1 | tail -5
```

### 7. Build State

```bash
pnpm build 2>&1 | tail -10
```

## Report Template

```text
Health Check Summary
  Git:          clean / X uncommitted files / X stashes
  Settings:     OK / CONFLICT
  Guides:       XX lines (OK / SPLIT RECOMMENDED)
  MCPs:         X active
  Context:      XX% (healthy / warning / critical)
  Quality:      lint/type-check/test/build status
```
