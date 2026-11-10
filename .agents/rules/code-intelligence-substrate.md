---
name: code-intelligence-substrate
description: CodeGraph index is the single source of truth for structural knowledge; enforce its integrity, never hand-edit it, and verify before claiming structural work
paths:
  - '**/*'
alwaysApply: true
---

# Code-Intelligence Substrate

The CodeGraph SQLite index (`/home/tim/local.db`, outside the git tree) is the **single
source of truth** for structural knowledge across the repo. Every agent that claims to
have _indexed_, _searched_, _impacted_, or _chunked_ the codebase is claiming to have
used this substrate. It must be kept healthy by all agents.

## Invariants (enforced by `pnpm audit:code-intelligence`, gate 28)

1. **`end_line` is not optional.** Entities carry `(file_path, name, kind, start_line,
end_line)`. A healthy index after a backfill is **≥50% ranged** (`end_line > start_line`)
   and **≤45% no-range** (`end_line == start_line`). If either ratio is violated, the
   index is stale and structural claims made against it are void.
2. **Counts must match the baseline.** `.agents/memory_base/index-snapshot.json` records
   the entity / relation / distinct-file counts. If any count drifts, the index has
   diverged from the source tree and must be rebuilt.
3. **The DB is never hand-edited.** No agent may `INSERT`/`UPDATE`/`DELETE` into
   `local.db` directly. The only sanctioned mutation path is `pnpm ci:reindex`, which
   runs `ts_parse_dir.cjs` → `backfill_ranges.py`. Hand-editing the DB invalidates the
   snapshot and breaks the drift gate.

## Canonical commands

| Command                                                               | Purpose                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm ci:reindex`                                                     | Rebuild the index from the source tree (parse + backfill ranges) |
| `pnpm ci:snapshot`                                                    | Record the current index state as the drift baseline             |
| `pnpm audit:code-intelligence`                                        | Gate 28 — verify the substrate is in sync (exit 0/1)             |
| `pnpm ci:reindex && pnpm ci:snapshot && pnpm audit:code-intelligence` | Full refresh cycle                                               |

## Where the tooling lives

The TS AST parser, batch parser, range backfiller, and chunker live in
`~/.agents/skills/code-intelligence/scripts/` — **outside the repo**. They must never
be copied into `Arch-System/`. The repo contains only the enforcement machinery
(`tools/scripts/ci-*.cjs`, `tools/audits/audit-code-intelligence-drift.cjs`,
`agent-verify.sh` gate 28, this rule, and the `code-intelligence` skill).

## Enforcement machinery (do not disable)

The gate is **always applied**, not only when an agent remembers to run it:

| Layer            | What it does                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit-time hook   | `.qoder/hooks/code-intelligence-gate.sh` fires on every `Edit` / `Write` (registered in `.qoder/settings.json`). Non-blocking — prints a ⚠ drift advisory so the agent is informed at edit time.                                            |
| Pre-commit guard | `tools/scripts/check-enforcement-integrity.cjs` runs in `.husky/pre-commit`. Hard-blocks commits that would ship a disabled or bypassed enforcement layer (audit script, snapshot, hook registration, or magic-numbered pre-push fast-path). |
| Protected paths  | `.qoder/hooks/protect-paths.sh` blocks direct edits to the enforcement SSoT files.                                                                                                                                                           |
| Pre-push gate    | `.husky/pre-push` runs the full `agent-verify.sh`; its fast-path compares `passedGates === totalGates` (not a magic 27/28), so it stays valid as the suite grows.                                                                            |

The enforcement SSoT files are: `tools/audits/audit-code-intelligence-drift.cjs`,
`tools/scripts/ci-snapshot.cjs`, `tools/scripts/ci-reindex.cjs`,
`.agents/memory_base/index-snapshot.json`,
`.agents/rules/code-intelligence-substrate.md`,
`.agents/skills/code-intelligence/SKILL.md`,
`.qoder/hooks/code-intelligence-gate.sh`, and `.qoder/settings.json`.

## Evidence contract

Before an agent reports "indexed / searched / impacted / chunked", it must:

1. Run `pnpm audit:code-intelligence` and confirm `✅ PASS`.
2. Cite the concrete artifact: the DB path, the entity/relation/file counts, and the
   ranged ratio.
3. For impact analysis, name the target entity and list its dependents with file + line.
4. For chunking, report the chunk count and the line ranges.

A report that omits these is an unverified claim and fails the evidence-based-verification
mandate.

## Failure mode

If `pnpm audit:code-intelligence` exits 1, the agent must **stop** structural work and
run `pnpm ci:reindex` → `pnpm ci:snapshot` → re-run the gate. Structural results produced
against a drifted index are not actionable.
