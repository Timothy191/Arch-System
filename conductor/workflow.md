<!-- cspell:ignore commitlint styleguides Checkpointing -->

# Project Workflow — Arch-System Conductor Protocol

## Guiding Principles

1. **The Plan is the Source of Truth:** All track work is specified in `spec.md` and tracked sequentially in `plan.md`.
2. **The Tech Stack is Deliberate:** Changes to core libraries, schemas, or boundaries must be documented in `conductor/tech-stack.md` and `AGENTS.md` _before_ implementation.
3. **Test-Driven Development (TDD):** Write failing unit/integration tests before implementing functionality whenever practical, and verify both happy-path and failure/authorization cases.
4. **High Code Coverage:** Enforce the Arch-System changed-files ratchet (`>= 70%` statements and lines via `pnpm test:coverage:changed`) and aim for `> 80%` coverage on new modules.
5. **User Experience & Light-Mode Invariants First:** Preserve light-mode OKLCH tokens, taskbar liquid-glass + golden steel branding (`glassSurfaceBranding`), mobile responsiveness, and zero mock data.
6. **Non-Interactive & CI-Aware:** Always run Mise Node 24+ in `PATH` and non-interactive commands (`CI=true` / `pnpm --filter portal test -- ...`).

## Task Workflow

All tasks follow the **Context -> Spec & Plan -> Implement** lifecycle:

### Standard Task Workflow

1. **Select Task:** Choose the next available task from the active track's `plan.md` in sequential order.

2. **Mark In Progress:** Before editing code, update the task marker in `plan.md` from `[ ]` to `[~]`.

3. **Write Failing Tests (Red Phase):**
   - Create or extend the co-located Jest (`*.test.ts` / `*.test.tsx`) or Playwright spec covering expected behavior, RBAC/validation boundaries, and edge cases.
   - Run the targeted test suite (`pnpm --filter portal test -- --testPathPatterns="<suite>"`) and confirm it fails before implementation.

4. **Implement to Pass Tests (Green Phase):**
   - Implement the minimal, boundary-compliant solution following `conductor/code_styleguides/` and `AGENTS.md`.
   - Re-run the targeted test suite and confirm all assertions pass.

5. **Refactor & Format:**
   - Apply DRY/guard-clause cleanup, remove dead imports, and run `pnpm exec biome check --write` on touched code plus `prettier` / `markdownlint-cli2` / `cspell` on touched docs.
   - Re-run affected tests to confirm zero regressions.

6. **Verify Coverage & Quality Gates:**
   - Run `pnpm --filter portal type-check`, `pnpm test:coverage:changed` (`>= 70%` ratchet, target `> 80%`), and for cross-module or pre-merge checks run the full 28-gate `pnpm agent:verify`.
   - Record an ISO-8601 entry in root [`AGENT_TRACER.md`](../AGENT_TRACER.md) and update `documentation/03-audit-reports/agentic-audit-report.md` if needed (`node tools/audits/audit-agentic-content.cjs`).

7. **Document Deviations:** If implementation requires a tech-stack or architectural deviation:
   - **STOP** implementation.
   - Update `conductor/tech-stack.md` (and `AGENTS.md` if workspace-wide) with a dated note.
   - Resume implementation.

8. **Commit Code Changes (Conventional Commits Only):**
   - Stage all code and traceability changes related to the task.
   - Use `@commitlint/config-conventional` types (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`) with headers `<= 100` characters (e.g., `feat(control-room): add shift target alert`).
   - **IMPORTANT:** Do NOT use custom commit types like `conductor(...)` — `commitlint` rejects them; use `chore(conductor): ...` or `docs(conductor): ...` instead.

9. **Attach Task Summary with Git Notes:**
   - Obtain the commit hash (`git log -1 --format="%H"`).
   - Attach a concise summary note (`git notes add -m "<summary>" <commit_hash>`).

10. **Record Task Commit SHA in `plan.md`:**
    - Update the completed task in `plan.md` from `[~]` to `[x]` and append the 7-character commit SHA.
    - Stage and commit the plan update (`chore(conductor): mark task '<task>' complete`).

### Task Correction & Plan Amendment Workflows

1. **In-Flight Refinements:** Resolve minor gaps found while a task is `[~]` directly in the active implementation loop and re-verify before committing.
2. **Code Review Corrections (`/conductor:conductor-review`):** Audit diffs against `AGENTS.md`, `product-guidelines.md`, and `code_styleguides/`, execute verification, and append a `Review Fixes` phase to `plan.md` for any findings.
3. **Logical State Reversions (`/conductor:conductor-revert`):** Safely revert flawed track/phase/task commits and reset affected checkboxes in `plan.md` to `[ ]`.

### Phase Completion Verification & Checkpointing

1. Announce phase completion and determine the diff since the previous checkpoint SHA (`git diff --name-only <prev_sha> HEAD`).
2. Verify every modified runtime file has test coverage (`pnpm test:coverage:changed`).
3. Run the 28-gate suite:
   ```bash
   export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$HOME/.cargo/bin:$PATH"
   pnpm agent:verify
   ```
   (Fix up to 2 failures autonomously; halt and ask the user if a 3rd failure occurs.)
4. Present concrete verification evidence to the user before tagging/pushing.
5. Attach verification report via `git notes` and record `[checkpoint: <sha>]` in `plan.md`, committed as `chore(conductor): checkpoint phase '<PHASE NAME>'`.

## Development Commands

### Setup & Local Runtime

```bash
export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$HOME/.cargo/bin:$PATH"
pnpm install --frozen-lockfile
pnpm dev            # Full local stack (Redis + portal :3000)
pnpm dev:quick      # Portal only against cloud Supabase
```

### Daily Verification & Inner Loop

```bash
pnpm --filter portal type-check
pnpm --filter portal test -- --testPathPatterns="<suite>"
pnpm test:coverage:changed
pnpm audit:drift && pnpm audit:compliance
```

### Pre-Commit / Full Quality Gate

```bash
pnpm agent:verify   # Mandatory 28-gate verification suite
```

## Release & Deployment Gate

- **Do NOT push to `origin/main` or deploy to Vercel (`pnpm deploy:vercel:prod`) unless explicitly approved by the user.**
- In environments with IPv6 timeouts to `api.vercel.com` or `fonts.googleapis.com`, run push/Vercel commands with `NODE_OPTIONS="--dns-result-order=ipv4first"`.
