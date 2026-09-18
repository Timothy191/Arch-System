# Autonomous Agent CLI Tool Autonomy Matrix

This document defines when and how autonomous agents across the Arch-System monorepo must invoke local CLI tools to maximize engineering velocity, safety, and code quality.

---

## 1. Tool Invocations Trigger Matrix

| CLI Tool | Invocation Trigger / Scenario | Command Pattern | Beneficial Phase |
| :--- | :--- | :--- | :--- |
| **`nexus`** | Scaffolding new modules, pre-commit catalog audit, Turborepo builds | `nexus audit --json`<br>`nexus scaffold package @repo/<name>`<br>`nexus build <target>` | Architectural Setup & Pre-Commit |
| **`fresh`** | Continuous watch during active code edits & refactoring | `fresh watch <dir> --exec "pnpm --filter <target> type-check"`<br>`fresh test` | Active Development & TDD |
| **`sidekick`** | Post-refactor deployment check & multi-port health verification | `sidekick health --json`<br>`sidekick deploy staging` | Verification & Staging Delivery |
| **`palabre`** | Before high-impact schema/auth changes; requesting multi-agent debate | `palabre ask "<question>" --agents codex claude`<br>`palabre "<subject>" -t 4` | Design & Pre-Write Gate |
| **`openspec`** | API endpoint modifications; checking contract drift against `@repo/contract` | `openspec validate`<br>`openspec change propose` | API Contract Design |
| **`clihub`** | Converting custom helpers in `~/.local/bin/` into agent manifests | `clihub convert <binary>`<br>`clihub search "<query>"` | Tooling Discovery & Registry |
| **`dexter`** | Shift closeout financial audits, OEE cost variance calculations | `dexter analyze <domain> --json`<br>`dexter report <shift-id>` | Operational & Shift Audits |
| **`metabase`** | Querying analytics telemetry without browser automation | `metabase query "<sql>"`<br>`metabase dashboards export <id>` | Telemetry & Data Analysis |
| **`trailblazer`** | Graphing task dependencies before starting multi-agent parallel waves | `trailblazer plan temp/tasks.md`<br>`trailblazer graph` | Multi-Wave Planning |
| **`quartermaster`** | Synthesizing wave achievements into retrospective telemetry archives | `quartermaster generate --json`<br>`quartermaster align docs/okrs.md` | Post-Task Retrospective |
| **`agent-ready`** | Verifying web portal endpoints expose agentic metadata (MCP/JSON-LD) | `agent-ready scan http://localhost:3000 --json` | Pre-Deploy Readability Audit |
| **`scholar`** | Verifying scientific references, DOIs, and checking for retractions | `scholar resolve <doi>`<br>`scholar check <doi>` | Research & Scientific Audit |

---

## 2. Autonomous Invocation Directives

1. **Zero External API Cost**: All CLI tools run locally without external cloud API dependencies.
2. **JSON Machine Output**: When subagents programmatically consume CLI results, append `--json` where available.
3. **Fail-Fast Safety Gate**: If `nexus audit` or `openspec validate` exits with non-zero code, halt implementation and fix structural issues before committing.
