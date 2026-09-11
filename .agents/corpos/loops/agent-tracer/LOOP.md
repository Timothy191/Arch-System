---
id: "agent-tracer"
name: "AGENT_TRACER.md Logging & Verification Sentinel"
department: "compliance-safety"
authority_level: "L1"
schedule:
  min_interval_minutes: 60
  max_interval_minutes: 1440
  backoff_factor: 1.5
signals:
  - source: "git"
    event: "pre-push"
  - source: "periodic"
    interval: "adaptive"
verification:
  commands:
    - "node tools/audits/audit-agentic-content.cjs"
---

# Business Loop: AGENT_TRACER.md Logging Sentinel

## 1. Business Intent
Ensures that all autonomous and human operations are properly logged in the appropriate `AGENT_TRACER.md` files.

## 2. Invariants & Guardrails
- **Continuous Logging**: Every meaningful change must result in an `AGENT_TRACER.md` entry.
- **Root and Package Logs**: Both the root and the modified packages must have updated tracer entries.
