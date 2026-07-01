# Lending library — fetch, use, return

Ephemeral skills and tools for **adaptive agentic mode**. Keeps the orchestrator lean: checkout only what the task needs, then remove staging.

## Commands

| Command | Purpose |
|---------|---------|
| `checkout-skill.py <name>` | Local search → catalog → GitHub/npm fetch |
| `return-skill.py <name>` | Clear active + delete ephemeral staging |
| `checkout-tool.py <name>` | Ephemeral CLI (npm) or print local command |
| `return-tool.py <name>` | Remove tool staging |
| `list-catalog.py [skills\|tools\|all]` | Allowlisted capabilities |
| `purge-staging.py` | Emergency cleanup of all staging |
| `record-learning.py` | Session lessons (unchanged) |

## Flow

```bash
python3 03_operations_automation/lending-library/checkout-skill.py ce-debug
# Read PATH output (SKILL.md)
python3 03_operations_automation/lending-library/return-skill.py ce-debug
```

Fetched artifacts live under `run/lending-library/staging/` (gitignored).

## Catalog (`catalog.json`)

| `type` | Behavior |
|--------|----------|
| `local` | Search `~/.cursor/skills-cursor`, plugins cache, `.cursor/skills` |
| `github_raw` | Single file from `raw.githubusercontent.com` |
| `github_tree` | Sparse git clone of repo subpath |
| `npm` | `npm install --prefix staging/<id>` |
| `pypi` | `pip install --target staging/<id>/site-packages` |

Add new remote entries here — **allowlist only** (no ad-hoc URLs in agent prompts).

## Active state

`run/lending-library/active.json` tracks checked-out resources. `return-*` removes ephemeral dirs.

## Rule integration

- `.cursor/rules/adaptive-agentic-mode.mdc` — orchestrator behavior
- `.cursor/rules/cognitive-loops.mdc` — checkout/return hooks in CoT loop
