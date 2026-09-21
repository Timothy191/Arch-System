# Design — Onboard & Dotfiles Configuration Alignment

## Architecture & Integration Strategy

### 1. Node & Package Tooling Standardization

Developers utilize disparate version managers (`nvm`, `fnm`, `asdf`, `mise`, `nodenv`). While `volta` is declared in `package.json`, creating both `.nvmrc` and `.node-version` ensures automatic environment switching for all workflows without manual intervention.

### 2. EditorConfig Refinements

- Root `.editorconfig` covers generic text files with space indentation (`indent_size = 2`).
- Makefiles require hard tabs (`indent_style = tab`) to prevent make syntax failures.
- Markdown files require `trim_trailing_whitespace = false` to preserve two-space line breaks.

### 3. VS Code / IDE Workspace Architecture

- `.vscode/mcp.json`: Replaced obsolete hardcoded paths with the active user directory and verified project root.
- `.vscode/settings.json`: Configured workspace TypeScript SDK, Biome formatting, file watching limits, and format-on-save.
- `.vscode/extensions.json`: Direct extension recommendations matching the CI lint and formatting stack.
- `.vscode/tasks.json`: Standardized task definitions for quick access to monorepo scripts.

### 4. Diagnostics CLI Architecture (`tools/repo/onboard.cjs`)

- Added CLI argument parser handling `--json` and `--fix`.
- Added check for `.nvmrc` / `.node-version` parity with `package.json`.
- Implemented automated remediation with `--fix`: syncs missing keys from `.env.example` to `.env` without overwriting existing configured secrets.
- Supports structured JSON logging for agentic and CI validation.
