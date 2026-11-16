---
name: deep-audit
description: DeepAudit multi-agent security, vulnerability, and architectural auditing workflow (Reconnaissance, AST/RAG Analysis, Empirical Sandbox Verification, Orchestrated Report). Activate automatically whenever the user prompt includes the word "Audit" or "audit".
---

# DeepAudit Multi-Agent Security & Architecture Workflow

Adapted from `lintsinghua/DeepAudit` for **Arch-System (Plantcor OS)** as a 4-phase collaborative security and architectural auditing pipeline.

## When to Activate

- **Mandatory Prompt Trigger**: Activate this skill **automatically** whenever the user prompt contains the word **`Audit`**, **`audit`**, or **`auditing`**.
- Also invoke prior to release sign-off, schema/RLS changes, or cross-department security reviews.

## 4-Phase DeepAudit Execution Protocol

### Phase 1 — Reconnaissance Agent (Asset & Entry-Point Mapping)

1. Execute the automated orchestrator in read-only mode:

   ```bash
   pnpm audit:deep
   ```

2. Inspect structural impact and symbol boundaries using the CodeGraph substrate (`pnpm audit:code-intelligence`, `pnpm ci:context <symbol>`, `pnpm ci:impact <file>`) so all API route entry points, Server Actions, migrations, and Zod contract surfaces are mapped before making claims.

### Phase 2 — Analysis Agent (AST, Security, RLS & React 19 Inspection)

Inspect targeted modules and analyzer results across all Arch-System security and architecture layers:

- **Server Actions & Route Handlers**: Enforce the Canonical 8-Step Security Sequence (`Authenticate -> Authorize -> Validate @repo/contract -> Rate-Limit -> Execute -> Audit Log -> Invalidate Tags -> Return`).
- **Database & RLS**: Confirm every `public` table enables Row Level Security with `(SELECT auth.uid())` InitPlan subqueries and zero SQL string concatenation.
- **React 19 & Next.js 16 Boundaries**: Run `pnpm audit:react-doctor` and verify zero server-only imports in `'use client'` modules, zero `async` client components, zero `eval()`, and light-mode OKLCH token compliance (`pnpm audit:tokens`).
- **Side Effects, Limits & TOCTOU**: Apply `REVIEW.md` checklists (explicit `.limit()`, bounds, pure functions, no sequential `await` waterfalls, edge-case negative tests).

### Phase 3 — Verification Agent (Empirical Cross-Validation)

Never report theoretical vulnerabilities without empirical proof:

- Cross-verify analyzer findings against live test assertions (`pnpm --filter portal test -- --testPathPatterns="<target>"`), `pnpm audit:compliance`, and `pnpm audit:ssot-duplicates`.
- Filter out false positives disproven by verification runs and assign Evidence Levels (`E1` static, `E2` automated test/audit, `E3` runtime probe, `E4` cross-validated across independent checks) along with SHA-256 output digests.

### Phase 4 — Orchestrator Report

Present findings in a structured table including:

- **File & Line** (`file:line`)
- **Severity** (`P0`–`P3`)
- **Domain** (`Security`, `Auth & Mutations`, `RBAC`, `Database`, `React 19 & RSC`, `Contracts`, `Supply Chain`)
- **Evidence Level & Digest** (`E1`–`E4`, SHA-256 or exact command output)
- **Concrete Remediation**

Pass `--write` (`node tools/audits/deep-audit.cjs --write`) only when the user explicitly asks to persist `documentation/03-audit-reports/deep-audit-report.md`.
