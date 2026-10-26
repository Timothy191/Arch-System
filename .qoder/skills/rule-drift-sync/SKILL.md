---
name: rule-drift-sync
description: Resolve a failing pnpm audit:rule-drift gate in Arch-System. Use when audit:rule-drift, agent:verify step "rule-drift", or the mirror check reports drifted, broken, or dangling rules. Covers the canonical vs mirror trees, the symlink-only standard, and why copying a rule file is a wrong fix.
---

# Rule Drift Sync

`pnpm audit:rule-drift` (`tools/audits/audit-agent-rules-drift.cjs`) exits 1 on drift. It has **no `--fix` flag** — the repair is one `ln -sf`.

## 1. Which trees it compares

- **Canonical:** `Arch-System/.agents/rules/` — the real files. Edit here only.
- **Mirror:** `path.resolve(ROOT_DIR, '..') + '/.agents/rules'` → `/home/tim/Fork/.agents/rules/`. Each mirror entry must be a **live symlink** pointing at its canonical file.

Two things it deliberately does **not** touch, so leave them alone:

- `/home/tim/.agents/rules/` — a home-dir tree that exists but is never read; syncing there fixes nothing.
- `.cursor/rules/*.mdc` — hand-written frontmatter, no generator, not compared. Do not "regenerate" or sync these.

Files present in only one tree are legal; drift is judged only for names present in **both**.

## 2. Drift criteria

| Mirror state                                    | Verdict                         |
| ----------------------------------------------- | ------------------------------- |
| symlink resolving exactly to the canonical path | pass                            |
| symlink pointing elsewhere / broken             | `broken[]` → exit 1             |
| regular file, byte-exact equal                  | `dangling[]` → **still exit 1** |
| regular file, different bytes                   | `drifted[]` → exit 1            |

Comparison is a plain string equality — no hashing, no frontmatter normalization. The structural requirement is the trap: a `cp` that makes the content identical still fails, because every mirror `.md` must be a symlink. Zero readable mirror rules fails loudly.

## 3. Fix

Edit the canonical file, then relink from the parent workspace directory:

```bash
# canonical edit first, e.g. Arch-System/.agents/rules/redis-capabilities.md
cd /home/tim/Fork
ln -sf ../../Arch-System/.agents/rules/<name>.md .agents/rules/<name>.md
pnpm audit:rule-drift
```

If the mirror was a stale copy, remove the regular file before linking. Never reverse the direction — mirror content is not a source of truth.

## 4. Not this gate

`audit:antidrift` (repo-invariant confidence test), `audit:parity` / `watchdog` (zero-drift contract watchdog), and `audit:drift` (contract/Zod drift) are separate concerns and none of them read `.agents/rules`. A failure in those is not fixed by relinking.
