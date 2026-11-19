# Federated Systems Architecture & Agent Infrastructure Specification

> **Canonical Document:** `.agents/SYSTEMS.md`  
> **Classification:** Systems Engineering, Agentic Toolchain, Swarm Topology & Memory SSoT  
> **Target Scope:** This repository (`Arch-System`), with optional federated sibling services  
> **Last Updated:** 2026-11-19

---

## Executive Summary & System Topology

This document details the complete autonomous software engineering and multi-agent operations infrastructure powering the Plantcor mining operations workspace. The ecosystem integrates **Agent Runtimes (Harness)**, **Multi-Tier RAG & Memory**, **DAG Workflow Pipelines**, **Agent-to-Agent (A2A) Protocols**, and **Governance Matrices** into a self-healing, zero-cost operational framework.

```mermaid
flowchart TD
    subgraph HumanLayer ["Human-in-the-Loop & Governance (L0-L3)"]
        User["Operator / Engineer / Executive"]
        AuthGate["Authority Matrix (L0 Observer ➔ L3 Executive)"]
        ApprovalQueue["Storage Approvals / Slack HITL Bridge"]
        User <--> AuthGate <--> ApprovalQueue
    end

    subgraph AgentHarness ["1. AGENT CODING HARNESS & RUNTIME"]
        Engine["Antigravity / Gemini Engine (Zero API Overhead)"]
        Directives["Global Rules (~/.gemini/config/rules)"]
        SyncMCP["Synchronized MCP Toolchain across IDEs & CLIs"]
        SelfHealing["Zero-Interruption Self-Healing Loop"]
        BrowserLoop["Autonomous Browser & DevTools Loop (CDP/Lighthouse)"]
        Engine --- Directives --- SyncMCP --- SelfHealing --- BrowserLoop
    end

    subgraph MemoryRAG ["2. MULTI-TIER RAG & MEMORY BASE"]
        RufloVector["Ruflo HNSW Vector Memory (Local transformers.js)"]
        KGMemory["Knowledge Graph Memory (Entities / Relations)"]
        AST_RAG["Codebase AST RAG (codemap / CodeGraph / ast-grep)"]
        DocRAG["Live Documentation RAG (context7 / deepwiki)"]
        ScrapeRAG["LAN Zero-Cost Web Scraper (Firecrawl @ 192.168.0.215:3002)"]
        RepoRetros["Project Memory Base (memory_base/retrospectives)"]
    end

    subgraph DAGWorkflows ["3. DAG PIPELINE & WORKFLOW ENGINES"]
        TurboDAG["Turborepo Monorepo Task DAG (^build, lint, test)"]
        VerifyDAG["28-Gate Verification DAG (pnpm agent:verify)"]
        InngestDAG["Inngest Durable Event Functions DAG (Step/Saga execution)"]
    end

    subgraph A2A_Swarm ["4. A2A PROTOCOL & AGENT SWARMS"]
        A2ABus[".agents/a2a/bus (Append-Only Event Ledger)"]
        A2ARegistry[".agents/a2a/registry (9-Pillar Agent Cards)"]
        MakerChecker["Maker-Checker Dual-Mind Pattern"]
        RufloSwarm["Ruflo Pheromone & Consensus Swarm (Claims/Handoffs)"]
        SubagentIPC["Antigravity Subagent IPC (invoke_subagent / send_message)"]
    end

    subgraph FederatedServices ["5. FEDERATED CODEBASE & SERVICES"]
        ArchPortal["Arch-System (Next.js 16, React 19 Portal)"]
        SkillsMCP["skills-mcp (Skill/Context/Persona Registry MCP)"]
        MemoryMCP["memory-gateway-mcp (Unified Memory MCP)"]
        SlimMCP["slim-tooling-mcp (Upstream Proxy & Compactor MCP)"]
        LangGraphMCP["langgraph-mcp (LangGraph Orchestration MCP, Python)"]
    end

    HumanLayer <===> AgentHarness
    AgentHarness <===> MemoryRAG
    AgentHarness <===> DAGWorkflows
    AgentHarness <===> A2A_Swarm
    DAGWorkflows <===> FederatedServices
    A2A_Swarm <===> FederatedServices
```

---

## 1. Agent Coding Harness & Runtime Layer

The harness governs how AI models receive instructions, discover tools, execute code, and verify modifications without human friction.

### 1.1 Multi-IDE / Runtime Synchronized Configuration

The environment unifies agent configuration across all runtimes on the developer machine via identical MCP configurations and behavioral rules:

- **Google Antigravity CLI & Subagents:** `~/.gemini/antigravity-cli/mcp/mcp.json`
- **Cursor IDE:** `~/.cursor/mcp.json`
- **Orca IDE / Codex Runtime:** `~/.config/orca/codex-runtime-home/home/config.toml`
- **Codex CLI:** `~/.codex/config.toml`
- **OpenCode:** `~/.config/opencode/opencode.json`
- **VS Code:** `~/.config/Code/User/mcp.json`
- **Global Shell & Daemon Environment:** `~/.config/mcp-env`

### 1.2 Global Behavioral Directives (`~/.gemini/config/rules/`)

1. **Zero-Interruption Self-Healing (`global-self-healing.md`):**
   - Mandate: Run native project verification (`pnpm agent:verify`, `npm run build`, `turbo run test`) before speaking.
   - Non-zero exit code: Strictly prohibited from halting to ask the user for assistance. Autonomous self-correction is executed iteratively until tests pass.
2. **Autonomous Browser & DevTools Loop (`autonomous-browser-devtools-loop.md`):**
   - Implements closed-loop loop-engineering (`cobusgreyling/loop-engineering`):
     $$\text{Sense (Perception)} \longrightarrow \text{Plan (Diagnosis)} \longrightarrow \text{Act (Remediation)} \longrightarrow \text{Evaluate (Critic)} \longrightarrow \text{Self-Correct}$$
   - Uses CDP, Puppeteer, Lighthouse CLI, and Playwright (`@axe-core/playwright`) to verify Speed Index, contrast ratios ($\ge 4.5:1$), touch targets ($\ge 44\times 44\text{px}$), and ARIA compliance.
3. **Global Toolchain Mandate:**
   - Prioritizes AST structural search (`ast-grep` / `sg`) over regex `grep`.
   - Uses syntax-aware diffing (`difft` — the binary is `difft`, not `difftastic`) over standard `git diff`.
   - Packages codebase context for LLM multi-agents via `repomix`.
   - Formats configuration using `jq` and `yq`.
   - Toolchain availability is verified by gate 7 (`pnpm mcp:verify`) and gate 28; `ast-grep`/`sg` is installed via mise and `which sg` must resolve before any AST mandate is claimed.
4. **Ruflo & Gemini Orchestration (`ruflo-gemini-orchestration.md`):**
   - Multi-agent coordination and vector memory ledger powered by `@claude-flow/cli`.
   - Zero third-party API costs: Models are executed via Google Gemini / Antigravity; embeddings run locally via `transformers.js`.
5. **Local Firecrawl Scraping (`local-firecrawl-scraping.md`):**
   - Zero-cost, unauthenticated LAN scraping on `192.168.0.215:3002`. Strict boundary: Agent research only, never injected into application code.

---

## 2. Multi-Tier Retrieval-Augmented Generation (RAG) & Memory Systems

The memory infrastructure spans from instant AST lookup to cross-session vector search and persistent knowledge graphs.

| Tier                          | Component                     | Technology                                                        | Storage / Endpoint                    | Scope & Function                                                                                                                                            |
| :---------------------------- | :---------------------------- | :---------------------------------------------------------------- | :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vector RAG**                | Ruflo HNSW Memory             | `@claude-flow/cli`, `transformers.js` (`Xenova/all-MiniLM-L6-v2`) | Local SQLite / Vector DB              | Semantics-based search over architectural patterns, solutions, and subagent trajectory logs. Zero cloud embedding cost.                                     |
| **Graph RAG**                 | Knowledge Graph Memory        | `@modelcontextprotocol/server-memory`                             | Stdio MCP                             | Entity-relation knowledge graph (`create_entities`, `create_relations`, `search_nodes`) mapping cross-project concepts.                                     |
| **Codebase AST RAG**          | Codemap, CodeGraph & ast-grep | `codemap mcp`, `sg`, `ci:reindex`                                 | `Arch-System` source tree             | Deep AST code intelligence, symbol definitions, circular dependency detection, and TDAD impact analysis.                                                    |
| **Library Docs RAG**          | Context7                      | `@upstash/context7-mcp`                                           | Upstash Remote / Local MCP            | Real-time version-pinned documentation and type definitions for libraries (React 19, Next.js 16, Tailwind).                                                 |
| **Ephemeral Skill & Context** | Skills & Context Registry     | `skills-mcp` (`dist/index.js`)                                    | Stdio MCP                             | Anti-bloat on-demand skill, context, and persona registry (`acquire_skill`, `acquire_context`, `list_available_personas`). Leased and returned per subtask. |
| **Public Git RAG**            | DeepWiki                      | `https://mcp.deepwiki.com/mcp`                                    | Remote MCP                            | Instant access to public GitHub repository documentation and open-source implementation guides.                                                             |
| **Web & LAN RAG**             | Firecrawl Local Scraper       | `firecrawl-mcp` wrapper                                           | `http://192.168.0.215:3002/v2/scrape` | High-speed markdown conversion of public documentation, RFCs, and API references without cloud tokens or rate limits.                                       |
| **Retrospective SSoT**        | Project Memory Base           | JSON / Markdown Files                                             | `.agents/memory_base/`                | Cross-session retrospective logbook, incident post-mortems, and architectural lessons learned.                                                              |

---

## 3. Directed Acyclic Graph (DAG) Workflows & Pipeline Orchestration

The platform executes complex, asynchronous operations through specialized DAG engines rather than ad-hoc scripts.

```mermaid
graph TD
    subgraph TurboBuildDAG ["Turborepo Build DAG"]
        T_Types["@repo/typescript-config"] --> T_Contract["@repo/contract"]
        T_Contract --> T_DB["@repo/database"]
        T_DB --> T_Redis["@repo/redis"]
        T_Redis --> T_Portal["apps/portal (Next.js 16 Build)"]
    end

    subgraph VerifyGateDAG ["28-Gate Verification & Ralph Loop DAG"]
        V_Policy["1. Policy & Boundary Check"] --> V_Types["2. TypeScript & Contract Drift"]
        V_Types --> V_Lint["3. Biome, Stylelint & Token Audits"]
        V_Lint --> V_Test["4. Jest & Migration RLS Tests"]
        V_Test --> V_Evidence["5. Emit .ci-local/agent-verify-evidence.json"]
    end

    subgraph InngestEventDAG ["Inngest Durable Function DAG"]
        I_Trigger["shift.closed Event"] --> I_Step1["step.run('compile_scada')"]
        I_Step1 --> I_Step2["step.run('verify_smr_hours')"]
        I_Step2 --> I_Step3["step.run('generate_audit_hash')"]
        I_Step3 --> I_Step4["step.run('notify_dispatch_supervisors')"]
    end
```

### 3.1 Turborepo Monorepo Pipeline DAG

- Configured in `Arch-System/turbo.json`.
- Enforces topological execution order (`^build`, `^lint`, `^test`).
- Hashes source inputs, environment variables, and downstream package dependencies for deterministic caching.

### 3.2 Autonomous Verification & Ralph Loop DAG (`pnpm agent:verify` / `.agents/bin/ralph.cjs`)

- Enforces fail-fast 28-gate verification (`tools/scripts/agent-verify.sh`) and cryptographic evidence generation (`.ci-local/agent-verify-evidence.json`).
- **Workflow:**
  1. **Preflight & Policy:** Runs `pnpm policy:check`, `pnpm audit:drift`, and `pnpm audit:compliance`.
  2. **Static & Token Audits:** Validates Biome formatting, Stylelint, OKLCH tokens, Tailwind composition, and RSC/caching invariants.
  3. **Tests & RLS:** Executes Jest unit tests and `@repo/database` migration/RLS safety checks.
  4. **Evidence Receipt:** Writes signed gate timings and SHA-256 hashes to `.ci-local/agent-verify-evidence.json`.

### 3.3 Inngest Durable Execution DAG (`packages/utils/inngest`)

- Used for high-reliability background business workflows (e.g., atomic shift closeouts, SCADA aggregation).
- Provides durable step functions, automatic exponential retries, compensation steps (Saga pattern), and state memoization across serverless invocations.

---

## 4. Agent-to-Agent (A2A) Protocol & Swarm Coordination

Autonomous agent collaboration operates under the **A2A-v1.0** protocol, eliminating non-deterministic conversational drift and unverified code mutations.

### 4.1 The 9 Core Agent Setup Pillars

Every agent registered under `.agents/a2a/registry/` must define:

1. **Identity & Dispatch Routing:** Unique kebab-case name, primary role, and task intake filters.
2. **Model & Runtime Envelope:** Target model tier, deterministic temperature ($0.0 - 0.2$), and max turn limits.
3. **Capability & Tool Sandboxing:** Whitelist of allowed MCP tools and blacklisted dangerous operations.
4. **Scope & Path Isolation:** Globs restricting which directories the agent may read and write.
5. **Stateful Lifecycle Runbook:** Explicit stage progression: `Ingest ➔ Audit ➔ Mutate ➔ Verify`.
6. **Hard Negative Constraints:** Non-negotiable boundaries (e.g., "NEVER mock production telemetry", "NEVER use external paid LLMs").
7. **Input Contract:** Strictly validated JSON task payload schema.
8. **Output Contract:** Machine-parseable JSON exit verdict schema.
9. **Error & Recovery Protocol:** Standardized exit codes and atomic rollback commands.

### 4.2 Swarm Topologies

#### 1. Maker-Checker Dual-Mind Pattern

Before any sensitive database, security, or architecture change is merged:

```mermaid
sequenceDiagram
    autonumber
    participant Maker as Maker Agent (e.g. databaseArchitect)
    participant Bus as A2A Event Bus (.agents/a2a/bus)
    participant Checker as Checker Agent (e.g. securityGate)
    participant Worktree as Git Isolated Worktree

    Maker->>Worktree: Generate proposed diff & migration
    Maker->>Bus: Publish Task Handoff Payload (diff_hash, scope)
    Bus->>Checker: Dispatch Review Request
    Checker->>Worktree: Run static analysis, AST lint & security scan
    alt Quality Score >= 90
        Checker->>Bus: Emit review-verdict: PASS (signature)
        Bus->>Worktree: Approve for merge
    else Quality Score < 90
        Checker->>Bus: Emit review-verdict: FAIL (violation_list)
        Bus->>Maker: Return remediation payload for self-correction
    end
```

#### 2. Ruflo Consensus & Distributed Claims

- Coordinated via `@claude-flow/cli`.
- Uses distributed claims (`claims_claim`, `claims_release`, `claims_handoff`) to guarantee that only one agent modifies a given package, route, or schema at a time.
- Employs swarm consensus (`hive-mind_consensus`) to resolve architectural conflicts between specialist subagents.

### 4.3 Canonical Monorepo Agent Registry (`Arch-System/.agents/a2a/registry/`)

`Arch-System/.agents/a2a/registry/` registers 18 specialist agent cards following the 9-pillar A2A schema (`core-coordinator.json`, `autonomous-orchestrator.json`, `autonomous-watchdog-supervisor.json`, `critique-council-reviewer.json`, `database-architect.json`, `ui-engineer.json`, `realtime-telemetry-engineer.json`, `resilience-field-engineer.json`, `security-quality-gatekeeper.json`, `system-simplifier.json`, `telemetry-codebase-architect.json`, `spec-breakdown-architect.json`, `spec-driven-implementer.json`, `ai-memory-curator.json`, `smart-indexer-agent.json`, `research-specialist.json`, `github-workflow-specialist.json`, `responder-orchestrator.json`). In a federated checkout, parent workspace cards live in the parent workspace's `.agents/a2a/registry/index.json`.

---

## 5. Human-in-the-Loop (HITL) & Corporate Authority Matrix

To balance high-velocity autonomy with industrial plant safety, actions are strictly partitioned into 4 authority tiers:

| Tier   | Level     | Role Scope         | Capabilities & Permissions                                       | Sign-Off Requirements                                                                             |
| :----- | :-------- | :----------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| **L0** | Observer  | Telemetry & Audit  | Read-only inspection of logs, SCADA streams, and codebases.      | None. Fully autonomous.                                                                           |
| **L1** | Advisor   | Architecture & QA  | Generates documentation, analysis briefs, and suggested patches. | None. Cannot mutate repo files.                                                                   |
| **L2** | Operator  | Code & Feature Dev | Mutates code in isolated worktrees, runs Jest/Playwright tests.  | Automated quality gates must score $\ge 90$ points.                                               |
| **L3** | Executive | Production & DB    | Database migrations, production deployments, secret rotation.    | Explicit user approval (or authorized release CI trigger) before merge to `main`, push, or deploy |

---

## 6. Federated Workspace Wiring & Service Map

This repository is the canonical Arch-System monorepo. It is self-contained; a parent workspace with sibling services is optional, not assumed:

```
repository root/
├── apps/portal/               # Plantcor Mining Portal (Next.js 16 app, Vercel: arch-system)
├── packages/                  # Shared @repo/* libraries (contract, supabase, database, redis, ...)
├── libs/                      # Feature slices (auth, departments, hub) and shared hooks
├── tools/                     # Governance audits, policy compiler, and verification gates
└── .agents/                   # Repository-level Agent Operating System
    ├── a2a/                   # Agent-to-Agent protocol bus, registry, and schemas
    ├── context/               # Injectable architecture context slices
    ├── hooks/                 # Pre/post tool guards, budget checks, and tracing
    ├── memory_base/           # Retrospectives and context index
    ├── rules/                 # Permanent engineering mandates
    ├── skills/                # Leasable skills
    └── SYSTEMS.md             # This canonical architecture specification
```

Optional federated siblings (outside this repository): `skills-mcp/`, `memory-gateway-mcp/`, `slim-tooling-mcp/`, `langgraph-mcp/`.

### Wiring Contracts

1. **Redis:** `Arch-System/packages/redis` connects to local TCP Redis in development and serverless REST-compatible Redis in production.
2. **MCP Registration:** root `.mcp.json` registers workspace utilities; sibling MCP servers are registered only when the federated checkout exists.
3. **Cross-Project Auditing:** `tools/zero-drift-watchdog/bin/federated-audit.mjs` executes automated drift assertions between TypeScript contracts across all siblings.
4. **Local Web Scraping:** `http://192.168.0.215:3002/v2/scrape` provides free, unauthenticated markdown extraction exclusively for agent intelligence.

---

## 7. Developer & Agent Cheat Sheet

```bash
# === 1. Repository Operations (from repository root) ===
pnpm dev:quick                 # Headless quick boot (no Docker)
pnpm dev:turbo                 # Portal dev server on 0.0.0.0:3000
pnpm agent:verify              # Monorepo full verification (lint, typecheck, test)

# === 2. Cross-Project Federation Auditing ===
node tools/zero-drift-watchdog/bin/federated-audit.mjs

# === 3. Local Scraper Health Check ===
curl -s http://192.168.0.215:3002/ | jq .
curl -s -X POST http://192.168.0.215:3002/v2/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://httpbin.org/get","formats":["markdown"]}' | jq '.data.markdown'

# === 4. Ruflo Multi-Agent Swarm Health ===
ruflo swarm status
ruflo memory stats
```
