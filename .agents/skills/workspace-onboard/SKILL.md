---
name: workspace-onboard
description: Bootstrap and verify a standalone or nested Arch-System monorepo checkout, dependencies, environment templates, policies, and MCP registries.
---

# Workspace Onboard

Prepare a fresh Arch-System checkout for development and autonomous verification without leaving unintended dirty tracked files.

## Bootstrap Steps

1. Verify Node.js `>=24.0.0` (`.nvmrc` / `.node-version`) and `pnpm@9.15.9`.
2. Run `./setup.sh` to install workspace dependencies, create `apps/portal/.env` and `.env.tools`, verify policies, and register MCP servers.
3. Run `pnpm env:check` to validate local development environment variables.
4. Run `pnpm policy:check && pnpm mcp:verify && pnpm audit:code-intelligence` to confirm boundaries, MCP registrations, and substrate readiness.

## Clean-Tree Invariant

- `./setup.sh` must leave `git status` clean on a fresh checkout; only pass `--regenerate` when intentionally updating generated version or policy artifacts.
