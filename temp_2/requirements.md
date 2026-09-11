# Root Workspace Sanitation & Agent Pipeline Hardening — Requirements

## 1. Ephemeral File Purge
- **Normal**: WHEN the sanitation pipeline executes, THE SYSTEM SHALL atomically remove the 8 designated untracked ephemeral files (`.aider.chat.history.md`, `.aider.input.history`, `.assets-checksum`, `biome_output.json`, `deploy-20260911-071701.log`, `dev-report.md`, `files_to_update.txt`, `pnpm-workspace.yaml.bak`).
- **Edge Case**: WHEN any of the designated ephemeral files are already absent, THE SYSTEM SHALL complete the removal pass without throwing errors (`rm -f`).

## 2. Legacy Nx Script Decommissioning
- **Normal**: WHEN the legacy script decommissioning runs, THE SYSTEM SHALL remove `autoresearch.sh` from git tracking and the filesystem using `git rm -f autoresearch.sh`.
- **Integrity**: WHEN `autoresearch.sh` is removed, THE SYSTEM SHALL verify that no root `package.json` scripts or Turborepo pipeline tasks break.

## 3. Agent SSoT Reference Alignment
- **Normal**: WHEN the agent guidance is audited, THE SYSTEM SHALL ensure `GEMINI.md` references the canonical `./AGENTS.md` file using a relative markdown link.
- **Normal**: WHEN updating `GEMINI.md`, THE SYSTEM SHALL retain core repository invariants (light mode enforcement, OKLCH design tokens, quality gates, phased execution framework).

## 4. Audit Ledger & Tracing
- **Normal**: WHEN workspace changes complete, THE SYSTEM SHALL append an ISO-formatted entry to `AGENT_TRACER.md` recording actions taken, decommissioned scripts, and verified symlinks.

## 5. Security & Secret Protection
- **Normal**: WHEN root sanitation executes, THE SYSTEM SHALL preserve `.env` and `.env.tools` without modification and enforce restrictive POSIX permissions (`chmod 600 .env .env.tools`).
