# Outline — Onboard & Dotfiles Configuration Alignment

## Executive Summary

This initiative standardizes the onboarding toolchain and dotfile configuration across the Arch-Systems monorepo. It establishes strict Node runtime parity, aligns IDE workspace preferences, reconciles environment variable gaps, and implements full automation support (`--fix` and `--json`) in the onboarding diagnostics CLI.

## Scope

- Runtime version pinning: `.nvmrc`, `.node-version`
- Editor and IDE workspace: `.editorconfig`, `.vscode/mcp.json`, `.vscode/settings.json`, `.vscode/extensions.json`, `.vscode/tasks.json`
- Environment parity: `apps/portal/.env`, `apps/portal/.env.example`
- Onboarding diagnostics suite: `tools/repo/onboard.cjs`
