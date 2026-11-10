# Specification: Monorepo Lexical, Spelling, Grammar & File-Naming Governance (`AGENT_TRACER.md`)

**Status:** Implemented & Verified  
**Date:** 2026-11-10  
**Scope:** Root `AGENT_TRACER.md` SSoT rename, CSpell & Markdownlint scope expansion, `.agents/rules/lexical-and-naming-governance.md`, `.qoder/hooks/` & `lint-staged` enforcement, and Gate 2 / Gate 9 / Gate 25 verification.

---

## 1. Objective

Eliminate naming and spelling drift across all autonomous agents and repository layers by:

1. Renaming the misspelled root consolidated ledger to the canonical `AGENT_TRACER.md` and forbidding both non-canonical root tracer variants (`AGENTS_TRACER*`, `AGENTS-TRACER*`) and distributed per-package `*/AGENT_TRACER.md` files.
2. Removing the `"**/AGENT_TRACER*.md"` blind spot from `config/tools/cspell.json` and expanding `pnpm lint:spelling` (`cspell`) to audit root `*.md`, `.agents/**/*.md`, `.github/**/*.md`, `tools/**/*.{js,cjs,mjs,ts,md}`, and `scripts/**/*.{js,cjs,mjs,ts,md}` in addition to `apps/`, `packages/`, `libs/`, and `docs/`.
3. Authoring `.agents/rules/lexical-and-naming-governance.md` (`alwaysApply: true`, symlinked to workspace `../.agents/rules/lexical-and-naming-governance.md`) so every agent applies identical spelling, grammar (`en-US`), identifier, and file-naming rules.
4. Wiring automatic lexical/grammar/formatting checks into `.qoder/hooks/auto-format.sh` (PostToolUse), `.qoder/hooks/protect-paths.sh` (PreToolUse), `.lintstagedrc.mjs` (pre-commit), `tools/audits/audit-agentic-content.cjs`, and Gate 25 (`tools/audits/audit-agent-permissions.cjs`).

---

## 2. EARS Acceptance Criteria

- **WHEN** `pnpm lint:spelling` and `pnpm md:lint` are executed, **THE SYSTEM SHALL** spell-check and lint `*.md`, `.agents/**/*.md`, `.github/**/*.md`, `apps/**/*.{ts,tsx,js,jsx,md}`, `packages/**/*.{ts,tsx,js,jsx,md}`, `libs/**/*.{ts,tsx,js,jsx,md}`, `docs/**/*.md`, `tools/**/*.{js,cjs,mjs,ts,md}`, and `scripts/**/*.{js,cjs,mjs,ts,md}` (including root `AGENT_TRACER.md`) with **0 unknown words** and **0 markdownlint violations**.
- **WHEN** `node tools/audits/audit-agentic-content.cjs --check` runs, **THE SYSTEM SHALL** verify that root `AGENT_TRACER.md` exists and is non-empty, that zero non-canonical root tracer variants or distributed sub-package `*/AGENT_TRACER.md` files exist anywhere in the workspace, and that all contract schemas, contract types, and SQL migrations follow canonical file-naming conventions.
- **WHEN** any agent attempts to write a non-canonical tracer file (`AGENTS_TRACER.md`, `AGENTS-TRACER.md`) or a nested `*/AGENT_TRACER.md` via `Edit|Write`, **THE SYSTEM SHALL** block the write in `.qoder/hooks/protect-paths.sh` with exit code `2` (verified by synthetic probes in Gate 25 `audit-agent-permissions.cjs`).
- **WHEN** any agent edits or writes a code or Markdown file via `Edit|Write` or stages files for commit (`lint-staged`), **THE SYSTEM SHALL** run Biome/Markdownlint/Prettier and `cspell` on the modified file(s).
- **WHEN** `pnpm agent:verify` executes all 27 gates, **THE SYSTEM SHALL** pass 27/27 gates with `0` violations.

---

## 3. Risks & Rollback

- **Risk**: Expanding `pnpm lint:spelling` to `.agents/`, `.github/`, `tools/`, `scripts/`, and root `*.md` surfaces previously un-audited technical terms or typos.
- **Mitigation**: Fix real code/identifier typos (`importSpecifiers` in `tools/scripts/generate-codemaps.mjs`, canonical `AGENT_TRACER.md`), add regex patterns for token/ID prefixes (`team_[A-Za-z0-9]+`, `sb_publishable_[A-Za-z0-9_-]+`), and register legitimate domain/technical vocabulary in `config/project-words.txt`.
- **Rollback**: `git revert <commit>` restores previous filenames and configurations atomically.
