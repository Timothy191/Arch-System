# Root Workspace Sanitation & Agent Pipeline Hardening — Outline

## 1. High-Level Strategic Vision
Purge untracked ephemeral caches, decommission the legacy Nx research runner (`autoresearch.sh`), correct absolute agent paths in `GEMINI.md`, and verify zero configuration drift across the Turborepo monorepo root.

## 2. Problem Framing
- Ephemeral logs (`deploy-*.log`), tool output dumps (`biome_output.json`), and obsolete backups (`pnpm-workspace.yaml.bak`) litter the monorepo root directory.
- `autoresearch.sh` contains hardcoded user directory paths (`/home/timothy/orca/Arch-System`) and deprecated Nx tooling commands (`nx reset`, `nx run-many`), whereas the codebase operates on Turborepo 2.x.
- `GEMINI.md` contained an absolute path reference to an external checkout directory instead of a canonical relative link to `./AGENTS.md`.
- Active git symlinks to `docs/` (`DEPLOYMENT.md`, `DESIGN.md`, `PRODUCT.md`, `SECURITY.md`) must be verified to prevent broken symlinks or accidental overwrites.

## 3. Scope Breakdown
- **Root Level (`.`)**: Remove 8 untracked ephemeral files. Decommission `autoresearch.sh`. Update `GEMINI.md` and `AGENT_TRACER.md`. Secure permissions on `.env` and `.env.tools`.
- **Docs Layer (`docs/`)**: Validate integrity and target existence of all 4 root documentation symlinks.
- **Tooling & Compilation**: Ensure zero drift on `package.json`, `pnpm-workspace.yaml`, and `turbo.json`. Validate with `pnpm check:fast` and `pnpm turbo run check-types`.
