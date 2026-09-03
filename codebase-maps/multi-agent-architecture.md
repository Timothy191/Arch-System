# 🤖 Multi-Agent Architecture & Pre-Flight Research Gate Map

**Generated:** 9/2/2026, 11:13:16 AM UTC  
**Package:** `@repo/agents`  
**Orchestration:** Multi-Agent Specialist Hierarchy + Langfuse Tracing

---

## 🏛️ Autonomous Specialist Persona Roster

```mermaid
flowchart TD
    USER["User Request / Goal"] --> MGR["Engineering Manager"]
    MGR --> COUNCIL["LLM Critique Council (5-Layer Gates)"]
    COUNCIL --> COORD["SubagentCoordinator (@repo/agents)"]

    subgraph PreFlight ["Mandatory Pre-Flight Research Gate"]
        RS["researchSpecialist (Frontier Systems & SOTA Benchmarks)"]
        BENCH["Evaluates SOTA: Netflix, Uber AST, Shopify, Airbnb, Meta"]
        RS --> BENCH
    end

    COORD -->|Non-Trivial Architectural Refactor| RS
    BENCH -->|Approved JSON Assessment| HOD["Head of Department (HoD)"]

    subgraph Specialists ["Domain Execution Specialists"]
        DBA["databaseArchitect (PostgreSQL & RLS)"]
        UIE["uiEngineer (React 19 & OKLCH Theme)"]
        SECG["securityAndQualityGate (ESLint & Playwright)"]
        RTE["realtimeEngineer (Supabase CDC & WS)"]
        RESE["resilienceEngineer (Harsh Pit Network & HUD)"]
        SIMP["systemSimplifier (Debloat & Bundlesize)"]
        TELA["telemetryArchitect (Codebase Maps & Drift)"]
    end

    HOD --> DBA
    HOD --> UIE
    HOD --> SECG
    HOD --> RTE
    HOD --> RESE
    HOD --> SIMP
    HOD --> TELA
```

---

## 🔬 Architectural Pre-Flight Research Gate Mandate
- **Rule Source**: Codified in `docs/GEMINI.md` and `docs/AGENTS.md`.
- **Implementation**: `SubagentCoordinator.evaluateArchitecturalPreFlight(proposal, scope)`.
- **Benchmark Evaluation Surface**:
  - **Airbnb / PayPal**: Semantic Data Contracts (Zero database-to-contract drift).
  - **Netflix / ThoughtWorks**: Architecture-as-Code Fitness Functions (Drift Health Index $ge 90\%$).
  - **Uber / Sourcegraph**: AST Codebase Maps & Topology Graphs.
  - **Meta / Google**: Perceptual visual diffing & synthetic navigation canaries.
