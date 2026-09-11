---
name: "security-compliance-skill"
description: "Adaptive operational runbook for RLS policy auditing, SQL security scanning, and human approval generation for Level 3 mutations."
department: "compliance-safety"
authority_level: "L3"
---

# Security & RLS Governance Sentinel — Agent Skill Runbook

## 1. Input Context
- **Signal**: Migration commit, pull request trigger, or scheduled security audit.
- **Brief**: Read `.agents/corpos/storage/briefs/<tick_id>.md`.

## 2. Execution Phases

### Phase 1: Static Policy Audit
1. Execute `node tools/audits/audit-rls.cjs`.
2. Inspect output for any missing RLS definitions or overly permissive policies.
3. Execute `node tools/audits/enforce-security-checks.cjs`.

### Phase 2: Vulnerability Analysis
1. If zero critical defects are found, mark tick status as `SUCCESS` and calculate adaptive backoff.
2. If critical defects or missing RLS policies are identified:
   - Identify offending migration file and table name.
   - Formulate a precise SQL remediation snippet with explicit `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` and restrictive `CREATE POLICY` statements.

### Phase 3: Authority Gate (CorpOS Level 3)
1. Since SQL migrations directly affect database security, do NOT apply mutations automatically.
2. Generate an approval card in `.agents/corpos/storage/approvals/<tick_id>.md`.
3. Include the full proposed SQL patch and risk evaluation.
4. Notify the system operator to review and execute `corpos approve <tick_id>`.

## 3. Negative Constraints
- NEVER apply live schema migrations without human sign-off.
- NEVER delete or suppress security audit warning files.
