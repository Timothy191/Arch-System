# Requirements — Onboard & Dotfiles Configuration Alignment (EARS Syntax)

## 1. Runtime Version Pinning

- **REQ-ENV-01 (Ubiquitous)**: The repository SHALL provide `.nvmrc` containing `24.15.0` matching `package.json` Volta configuration.
- **REQ-ENV-02 (Ubiquitous)**: The repository SHALL provide `.node-version` containing `24.15.0` matching `package.json` Volta configuration.

## 2. Editor & IDE Workspace Alignment

- **REQ-IDE-01 (Event-Driven)**: When a developer edits a `Makefile`, the editor SHALL enforce tab indentation per `.editorconfig`.
- **REQ-IDE-02 (Event-Driven)**: When a developer edits a Markdown file, the editor SHALL not trim intentional trailing whitespace per `.editorconfig`.
- **REQ-IDE-03 (Ubiquitous)**: The `.vscode/settings.json` file SHALL configure the TypeScript workspace SDK (`node_modules/typescript/lib`) and set Biome as default formatter.
- **REQ-IDE-04 (Ubiquitous)**: The `.vscode/extensions.json` file SHALL recommend the standard monorepo tool extensions (`biomejs.biome`, `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `bradlc.vscode-tailwindcss`, `streetsidesoftware.code-spell-checker`, `stylelint.vscode-stylelint`).
- **REQ-IDE-05 (Ubiquitous)**: The `.vscode/mcp.json` file SHALL reference current valid absolute workspace paths (`/home/tim/Projects/Next.js-Monorepo-Business-Portal` and `/home/tim/agentsroom-root/opt/AgentsRoom/resources/...`) in alignment with root `.mcp.json`.

## 3. Environment Variable Parity

- **REQ-CFG-01 (Ubiquitous)**: The `apps/portal/.env` file SHALL declare `GOOGLE_AI_API_KEY` matching the assigned Gemini API key to satisfy the onboarding environment matrix.
- **REQ-CFG-02 (Ubiquitous)**: The repository SHALL expose `apps/portal/.env.example` referencing `apps/portal/env/.env.example` for immediate setup.

## 4. Onboarding Diagnostic CLI

- **REQ-CLI-01 (Event-Driven)**: When `pnpm onboard` is executed, the tool SHALL verify runtime versions, local infrastructure, environment variables, architecture policies, and feature hook tests with 0 failures and 0 warnings.
- **REQ-CLI-02 (Optional Feature)**: Where the user passes `--json`, `tools/repo/onboard.cjs` SHALL emit machine-parseable JSON diagnostics to stdout.
- **REQ-CLI-03 (Optional Feature)**: Where the user passes `--fix`, `tools/repo/onboard.cjs` SHALL automatically populate missing environment variables or templates from examples.
