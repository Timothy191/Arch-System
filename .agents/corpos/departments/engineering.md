---
department_id: "engineering"
tier: "tier_1"
lead_role: "Principal Systems Engineer"
authority_ceiling: "L2"
purpose: "Monorepo architectural health, TypeScript strictness, dependency hygiene, and automated refactoring."
allowed_tools: ["read_file", "list_dir", "modify_code", "run_tests", "create_worktree", "git_commit_branch"]
---

# Department Blueprint: Software Engineering & Architecture (Tier 1)

## 1. Department Mandate
The Engineering department is responsible for maintaining the structural integrity, code quality, and architectural boundaries of the Arch-System monorepo. It manages the `codebase-health` business loop and enforces Turborepo, TypeScript, ESLint, and package boundary compliance.

## 2. Core Responsibilities
1. **TypeScript & Build Health**: Eliminates type errors, deprecated function signatures, and circular dependencies across all packages.
2. **Architectural Boundary Enforcement**: Ensures modules conform to `tools/repo/policy-compiler.cjs` (e.g., packages cannot import restricted internals).
3. **Dependency Hygiene**: Audits package dependencies, detects outdated or conflicting versions across catalogs, and runs dead-code audits (`knip`).
4. **Automated Refactoring**: Safely executes bounded refactoring tasks inside isolated git worktrees.

## 3. Standard Operating Procedures (SOPs)

### SOP-ENG-01: TypeScript Drift Remediation
- **Trigger**: `pnpm type-check` fails or emits type errors following a merge or commit.
- **Action**:
  1. Spin up an isolated worktree under `.agents/worktrees/tick-<id>`.
  2. Inspect failing compiler diagnostic lines.
  3. Apply type-safe fixes adhering to strict TS (no `any`, no `// @ts-ignore`).
  4. Run `pnpm type-check` to verify resolution.
  5. Commit changes to loop branch and formulate pull request brief.

### SOP-ENG-02: Package Boundary Violation
- **Trigger**: `pnpm policy:check` flags an unauthorized cross-package import.
- **Action**:
  1. Identify offending import path.
  2. Extract shared type/function into an appropriate shared library (`libs/shared/*` or `packages/contract`).
  3. Update package exports in `src/index.ts`.
  4. Verify boundary resolution with `pnpm policy:check`.

## 4. Hard Guardrails & Constraints
- **NEVER** use `any`, `unknown` casts without type narrowing, or `// @ts-ignore`.
- **NEVER** introduce dark mode styles (`dark:`) or edit `/usr/share/omarchy/`.
- **ALWAYS** isolate mutations inside dedicated `.agents/worktrees/` instances.
- **ALWAYS** enforce maximum 2 repair attempts before rolling back with `git checkout -- .`.
