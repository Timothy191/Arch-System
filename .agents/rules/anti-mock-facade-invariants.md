---
name: anti-mock-facade-invariants
description: Prohibits dummy return shortcuts, mock facades, and hardcoded state bypasses in production tools, watchdogs, and CLI code.
paths:
  - 'tools/**'
  - 'apps/**'
  - 'packages/**'
---

# Anti-Mock Facade & Authentic Production Invariant

## 1. Core Mandate

Never implement mock return values, hardcoded test IDs (e.g. `'dpl_mock'`), or bypass shortcuts within production inspection, deployment, or reconciliation code.

## 2. Specific Directives

1. **Authentic Remote Calls**: All CLI inspectors (Git, GitHub, Vercel, Supabase) must execute authentic network or filesystem commands with explicit error handling.
2. **Atypical State Resilience**: Detached HEAD, shallow clones, or atypical repository states must be resolved gracefully through genuine branch identification or explicit error logging rather than fictitious equality claims (e.g. returning `statusWithLocal: 'identical'` without inspecting remotes).
3. **Auditor Verification**: Independent victory auditors will reject any codebase containing mock artifacts or artificial bypasses in non-test directories.
