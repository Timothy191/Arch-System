# Tasks — Onboard & Dotfiles Configuration Alignment

## Task Checklist

- [x] **Task 1: Runtime Dotfiles**
  - Create `.nvmrc` with `24.15.0`.
  - Create `.node-version` with `24.15.0`.

- [x] **Task 2: EditorConfig Alignment**
  - Update `.editorconfig` with Makefile tab rules and Markdown whitespace preservation.

- [x] **Task 3: VS Code Workspace Standardization**
  - Update `.vscode/mcp.json` with correct active system paths and server definitions.
  - Update `.vscode/settings.json` with TypeScript SDK, Biome formatter, and format-on-save.
  - Create `.vscode/extensions.json` with recommended monorepo tooling extensions.
  - Create `.vscode/tasks.json` with onboarding and build tasks.

- [x] **Task 4: Portal Environment Reconcile**
  - Update `apps/portal/.env` to include `GOOGLE_AI_API_KEY`.
  - Create `apps/portal/.env.example` referencing `apps/portal/env/.env.example`.

- [x] **Task 5: Onboarding Diagnostics CLI Enhancement**
  - Enhance `tools/repo/onboard.cjs` to support `--json` and `--fix`.
  - Add validation for `.nvmrc` and `.node-version`.

- [x] **Task 6: Verification & Gate Audit**
  - Run `pnpm onboard` and verify 0 warnings / 0 failures.
  - Run `node tools/repo/onboard.cjs --json` and verify parseable JSON.
  - Run `pnpm policy:check` and `pnpm lint:root`.
  - Produce walkthrough artifact.
