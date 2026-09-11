# Root Workspace Sanitation & Agent Pipeline Hardening — Tasks

## Phase 1: Ephemeral File Elimination
- [x] Atomically remove 8 untracked ephemeral artifacts from repository root:
  - `.aider.chat.history.md`
  - `.aider.input.history`
  - `.assets-checksum`
  - `biome_output.json`
  - `deploy-20260911-071701.log`
  - `dev-report.md`
  - `files_to_update.txt`
  - `pnpm-workspace.yaml.bak`

## Phase 2: Decommissioning Stale Nx Script
- [x] Decommission `autoresearch.sh` using `git rm -f autoresearch.sh`.
- [x] Verify no package scripts or turbo tasks break.

## Phase 3: Agent SSoT Reference Alignment
- [x] Update `GEMINI.md` to reference `./AGENTS.md` and incorporate Turborepo guidelines.
- [x] Preserve core repository directives (OKLCH tokens, Light Mode invariant, Quality gate).

## Phase 4: Agent Tracer Ledger Entry & Security Hardening
- [x] Append audit entry to `AGENT_TRACER.md`.
- [x] Harden permissions on `.env` and `.env.tools` with `chmod 600`.

## Phase 5: Verification & Validation Loop
- [x] Run `git status -s` to inspect working tree state.
- [x] Verify all 4 documentation symlinks are intact (`DEPLOYMENT.md`, `DESIGN.md`, `PRODUCT.md`, `SECURITY.md`).
- [x] Run `pnpm lint:root` to verify root cleanliness.
- [x] Run `pnpm turbo run check-types` for full monorepo type validation (21/21 packages passed).
- [x] Check local Supabase status (`supabase status` — all 10 containers healthy).
