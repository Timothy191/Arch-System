---
name: code-intelligence
description: CodeGraph substrate — index, hybrid RRF search, TDAD impact analysis, and AST chunking. Use for any structural, search, impact, or chunking task.
---

# Code-Intelligence Substrate

Operational protocol for the CodeGraph index: the single source of truth for structural
knowledge across the Arch-System monorepo. The index is a SQLite DB at
`/home/tim/local.db` (outside the git tree) holding 8,982 entities and 46,000 relations
across 779 files, with `end_line` body ranges on 75.2% of entities.

## When to invoke

Invoke this skill for any task that touches **structure, search, impact, or chunking**:

- "What calls / imports / depends on X?"
- "Where is Y used across the repo?"
- "What is the blast radius of changing file Z?"
- "Chunk this file into syntactic units."
- "Is the code-intelligence substrate healthy?"
- Any task where a structural query would shortcut guesswork.

Do **not** invoke for pure UI, styling, or single-file edits that need no cross-file
context — those go to `ui-engineer` / `testing-rules`.

## Step 0 — Verify the substrate first

Before any structural claim, run the integrity gate:

```bash
pnpm audit:code-intelligence
```

Expect `✅ PASS — code-intelligence substrate is in sync.` (exit 0). If it exits 1, stop
and run the refresh cycle (below). Structural results produced against a drifted index
are void.

## Step 1 — Refresh cycle (when the gate fails)

```bash
pnpm ci:reindex && pnpm ci:snapshot && pnpm audit:code-intelligence
```

`ci:reindex` runs `ts_parse_dir.cjs` (batch TS/TSX AST parse) → `backfill_ranges.py`
(merge `end_line` ranges into the SQLite index). `ci:snapshot` records the new baseline
into `.agents/memory_base/index-snapshot.json`.

**Never hand-edit the DB.** No `INSERT`/`UPDATE`/`DELETE` on `local.db`. The only
sanctioned mutation path is `pnpm ci:reindex`.

## Step 2 — Hybrid RRF search

Fuses CodeGraph entities+relations with ripgrep, ranked by Reciprocal Rank Fusion
(k=60). The bundled `hybrid_rrf_search.py` defaults to `/home/tim/.agents` — always
pass the repo path explicitly:

```bash
python3 ~/.agents/skills/code-intelligence/scripts/hybrid_rrf_search.py \
  "shift_closeout" --repo /home/tim/Fork/Arch-System
```

Graph relations outrank docs-only keyword matches. A relation like
`saveOfficeDocumentAction → CALLS → updateTagInAction` at `office/actions.ts:188` is
stronger evidence than a comment mentioning the same name.

## Step 3 — TDAD impact analysis

Test-Driven Impact Analysis: walks the dependency graph from a target file and returns
every entity that depends on it, with file + line call sites.

```bash
python3 ~/.agents/skills/code-intelligence/scripts/tdad_impact_analyzer.py \
  apps/portal/lib/actions/shift-closeout.ts
```

Output: target entities, dependent count, direct test call sites, and a recommended test
suite. Use this before touching a shared module to size the test surface.

## Step 4 — AST chunking

Split a file into syntactic chunks with real line ranges. The TS AST path
(`ts_ast_chunker.py`) produces semantic chunks (functions, classes, interfaces); the
generic regex path is coarser and only a fallback.

```bash
python3 ~/.agents/skills/code-intelligence/scripts/ts_ast_chunker.py \
  apps/portal/lib/actions/shift-closeout.ts
```

Prefer the TS AST path for `.ts`/`.tsx` files.

## Tooling locations

All parsing/querying tooling lives in `~/.agents/skills/code-intelligence/scripts/` —
**outside the repo**. Never copy it into `Arch-System/`. The repo holds only enforcement
machinery: `tools/scripts/ci-*.cjs`, `tools/audits/audit-code-intelligence-drift.cjs`,
`agent-verify.sh` gate 28, the `code-intelligence-substrate` rule, and this skill.

## Evidence contract

Every structural claim in a report must cite:

1. `pnpm audit:code-intelligence` → `✅ PASS`.
2. The DB path and counts (entities / relations / files / ranged ratio).
3. For search: the query, the fused hit count, and at least one graph-relation hit.
4. For impact: the target entity, dependent count, and file+line call sites.
5. For chunking: the chunk count and line ranges.

Reports that omit these are unverified claims and violate the evidence-based-verification
mandate.

## Failure mode

If the gate fails, stop structural work and run the refresh cycle. Never present results
from a drifted index as actionable.

## Enforcement machinery (do not disable)

The gate is **always applied**, not only when an agent remembers to run it. Four layers
keep it that way; none of them may be disabled, bypassed, or hand-edited:

| Layer            | What it does                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit-time hook   | `.qoder/hooks/code-intelligence-gate.sh` fires on every `Edit` / `Write` (registered in `.qoder/settings.json`). Non-blocking — prints a ⚠ drift advisory so the agent is informed at edit time.                                                                       |
| Pre-commit guard | `pnpm audit:enforcement` (`tools/scripts/check-enforcement-integrity.cjs`) runs in `.husky/pre-commit`. Hard-blocks commits that would ship a disabled or bypassed enforcement layer (audit script, snapshot, hook registration, or magic-numbered pre-push fast-path). |
| Protected paths  | `.qoder/hooks/protect-paths.sh` blocks direct edits to the enforcement SSoT files.                                                                                                                                                                                      |
| Pre-push gate    | `.husky/pre-push` runs the full `agent-verify.sh`; its fast-path compares `passedGates === totalGates` (not a magic 27/28), so it stays valid as the suite grows.                                                                                                       |

The enforcement SSoT files are: `tools/audits/audit-code-intelligence-drift.cjs`,
`tools/scripts/ci-snapshot.cjs`, `tools/scripts/ci-reindex.cjs`,
`.agents/memory_base/index-snapshot.json`,
`.agents/rules/code-intelligence-substrate.md`, this skill,
`.qoder/hooks/code-intelligence-gate.sh`, and `.qoder/settings.json`.

Run `pnpm audit:enforcement` anytime to self-check the layer; it exits 0 on success and 1
on any break.
