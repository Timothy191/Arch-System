---
name: mandatory-ai-engineering-governance
description: Mandatory AI Engineering Governance, Canonical 8-Step Security Sequence, 5-Tier Permission Matrix, 15 Non-Negotiable Coding Standards, TDD, No Artificial Completion, and Independent Review.
paths:
  - '**/*'
alwaysApply: true
---

# ARCH-SYSTEM — MANDATORY AI ENGINEERING GOVERNANCE

## Mission

Every AI coding agent working on Arch-System must produce production-quality, secure, maintainable and independently verifiable software. Applies to all agents, including Jules, Cursor, GitHub Copilot, Claude Code, Codex, Gemini and autonomous orchestration agents.

## 1. Repository authority

Before any work: Read `AGENTS.md`, `.agents/GUIDE.md`, and applicable `.agents/rules/`; inspect the affected package's architecture and `AGENT_TRACER.md`; follow the existing architecture and source-of-truth documentation; resolve conflicting instructions before implementation. Do not create competing architecture standards.

## 2. Evidence-first engineering

Never assume that a feature, API, database table, permission or dependency exists. Inspect actual implementation and verify claims using repository evidence. Label unverified assumptions explicitly. Do not fabricate test results, deployment status or implementation progress.

## 3. Engineering quality & 15 Non-Negotiable Coding Standards

- **Repository discovery**: Read root instructions and relevant nested instructions before editing.
- **Evidence**: Inspect actual code, schemas and dependencies before proposing changes.
- **Planning**: Produce a written plan for multi-file changes.
- **Architecture**: Respect existing package boundaries and canonical exports.
- **TypeScript**: Strict typing; no `any` or `@ts-ignore`.
- **Security**: Authentication, authorization, validation and least privilege.
- **Database**: Migrations, RLS, indexes and rollback safety.
- **Code quality**: Small functions, meaningful names, no unexplained magic values.
- **Testing**: Add tests for every meaningful behavior change.
- **Performance**: Measure before claiming improvements.
- **Accessibility**: WCAG 2.2 AA target.
- **Error handling**: Typed errors, useful logs and no swallowed exceptions.
- **Documentation**: Update affected engineering documentation.
- **Git & Release Lifecycle**: Always create an isolated branch (`git checkout -b <type>/<scope>`), execute user-provided actions autonomously, never guess or assume (prompt user with 3 options on any uncertainty), and upon verification merge/commit to `main` and push to GitHub (`origin/main`) and Vercel (`pnpm deploy:vercel:prod`).
- **Verification**: Execute the relevant gates and report actual output.

Mandatory: Strict TypeScript; no `any` or `@ts-ignore`; no artificial placeholders or mock production functionality; no swallowed exceptions; typed error handling; no unnecessary dependencies; no duplicated business logic; no unexplained magic numbers or strings; respect established package boundaries; follow existing design-system and UI conventions.

## 4. Security & Canonical 8-Step Security Sequence

Every operation involving protected resources must enforce this exact canonical security sequence:

1. Authenticate the caller.
2. Authorize the requested operation and resource.
3. Validate all untrusted input.
4. Apply rate limits.
5. Execute the operation.
6. Record the audit event.
7. Invalidate affected caches.
8. Return a typed result.

Apply least privilege, secure session management, rate limiting, audit logging and secure secret handling. Never expose service-role credentials. Database changes must include appropriate RLS policies and rollback considerations. Auth, RLS, schema and infrastructure changes require explicit human approval.

## 5. Test-driven development (A) & No artificial completion (B)

For every meaningful behavior change: 1. Write a failing test → 2. Confirm the test fails for the intended reason → 3. Implement the smallest suitable change → 4. Confirm the test passes → 5. Refactor without breaking tests → 6. Run regression tests. Never weaken or delete tests simply to achieve a passing result.

Agents must never: claim tests passed without executing them; replace real functionality with mock data; disable failing tests to obtain a green build; suppress TypeScript errors; leave placeholder implementations; mark incomplete features as production-ready; or change acceptance criteria to match an incomplete implementation.

## 6. Architecture protection

Use existing canonical packages, contracts, database migrations, components and utilities. Do not introduce alternative implementations without architectural justification. Update generated artifacts only through their documented source-generation processes.

## 7. Autonomous execution & 5-Tier Permission Matrix

- **Tier One**: Read and research.
- **Tier Two**: Edit feature code and tests.
- **Tier Three**: Create branches and PRs.
- **Tier Four**: Modify auth, RLS, migrations and infrastructure with human approval.
- **Tier Five**: Production deployment and destructive operations with explicit authorization.

An agent must never grant itself additional permissions. Agents may independently investigate, plan, implement ordinary feature changes, execute tests and create pull requests. Agents may not independently authorize their own elevated permissions, merge protected changes or deploy to production without the required authorization.

## 8. Independent review (C)

Every substantial PR requires a separate review from an agent that did not implement the change. The reviewer must inspect the actual diff and challenge security vulnerabilities, architectural violations, missing test coverage, performance regressions, database compatibility, UI and accessibility regressions, and incorrect assumptions. The reviewer must be able to reject the implementation.

## 9. Verification

Run the appropriate targeted verification during implementation. Before completion, execute `pnpm agent:verify` and `pnpm quality` when the change is release-bound. Report failed, skipped and passed gates separately.

## 10. Completion report

Every completed task must include: Objective achieved, Files changed, Architecture affected, Security implications, Tests executed, Actual test results, Remaining risks, Documentation updated, and Commit and PR references. Never claim production readiness without production-level evidence.

FINAL RULE: Correctness, security and operational reliability take priority over implementation speed. An incomplete or unverified change must never be represented as complete.
