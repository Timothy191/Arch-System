---
name: todo-completion-and-detailed-reporting
description: Mandatory TODO completion protocol requiring 100% item execution followed immediately by an exhaustive, evidence-backed detailed report.
globs: ['**/*']
alwaysApply: true
---

# Mandatory TODO Completion & Detailed Reporting Protocol

**Governing Rule:** `TODO-1 — All initialized TODO phases and checklist items must be executed to completion (5/5) with zero dangling tasks. Immediately following TODO completion, the agent MUST produce the Report in detail.`

---

## 1. Canonical Investigation Phase Structure

Whenever an investigation, audit, or exploration workflow is initiated, the agent must define and execute the complete phased sequence without truncating or skipping items:

```text
|-- investigate · 5/5
|  |-- [x] Inspect git status and uncommitted working changes
|  |-- [x] Examine untracked files and local directories
|  |-- [x] Audit local and remote branch tracking details
|  |-- [x] Identify unpushed commits and upstream sync differences
'-- [x] Synthesize comprehensive uncommitted and branch report
`----- must be complete; then after the TODO produce the Report in detail
```

---

## 2. Invariants for TODO Lifecycle

1. **100% Item Execution (No Premature Stops)**:
   - Every initialized task in the TODO list must be actively investigated, executed, and marked completed (`[x]`).
   - The agent MUST NOT stop at a phase boundary or yield while active or pending tasks remain.
   - Tasks cannot be closed out-of-order or marked done without verifiable tool execution.

2. **Sequential Phase Integrity**:
   - Each checklist item maps directly to concrete reality checks (e.g. `git status`, `git diff`, `git ls-remote`, `gh pr list`).
   - Progress must remain observable via the state tracker (`todo done` called with next action).

3. **Zero Dangling Items Before Report Generation**:
   - The final synthesis step cannot be completed until all preceding diagnostic and analytical tasks have satisfied their acceptance criteria.

---

## 3. Mandatory Post-TODO Detailed Report Requirements

Immediately upon completing the TODO checklist (`5/5`), the agent **MUST produce the Report in detail**. A shallow summary or generic conclusion is strictly prohibited. The report must contain:

### A. Working Tree & Uncommitted Modifications

- **Tracked Changes Table**: Exact paths of all modified tracked files, specific changes applied (line edits, dependencies, configs), and technical justification.
- **Untracked Entities Breakdown**: Detailed list of all untracked files and directories, file types, and their operational purpose in the system.

### B. Local & Upstream Sync Status

- **Local Branch Identity**: Current local branch name, tip commit SHA, and commit message.
- **Upstream Tracking State**: Explicit tracking branch (`@{u}`), ahead/behind commit delta, and unpushed commit count.
- **Git Stash & Index State**: Verification of whether staged changes or stashes exist.

### C. Remote Branch & Pull Request Audit

- **Full Branch Accounting**: Comprehensive enumeration of every remote branch on `origin` (not just `origin/main`).
- **PR Association**: Direct mapping of each remote branch to its GitHub Pull Request number (e.g. `PR #136`, `PR #135`, `PR #121`).
- **PR Lifecycle Status**: Explicit state of each PR (`OPEN/DRAFT`, `MERGED`, `CLOSED/STALE`).
- **Divergence Metrics**: Quantitative divergence from `main` (`main +X, branch +Y`) and timestamp of the latest commit.

### D. Evidence-Backed Verification

- **Empirical Proof**: Every assertion must be grounded in tool output (e.g. `git status`, `git diff --stat`, `git branch -a -v`, `gh pr list`).
- **Zero Fabrication**: Adhere to `permanent-engineering-rules.md` Section 1 (Production Reality) and Section 18 (Completion Rule). Mark unobserved properties as `UNVERIFIED`.

---

## 4. Relationship to Other Rules

- **`permanent-engineering-rules.md`**:
  - Section 1 (Production Reality)
  - Section 2 (Evidence First)
  - Section 18 (Completion Rule: never declare complete without verified evidence)
  - Section 19 (Agent Behavior: inspect before modifying, verify own work)
- **`execution-guardrails.md`**:
  - Section 1 (Automated Compliance & Drift Mandate)
  - Section 5 (Agent Tracing & Context Handover)
