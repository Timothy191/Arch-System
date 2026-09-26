# Agent Orchestration & Swarming Framework

## 1. Hierarchy Agents Setup

The agent fleet operates autonomously using a dynamically scaled hierarchy to handle complex tasks:

*   **T0 Orchestrator (Core Coordinator):** 
    *   *Role:* Primary entry point for non-trivial prompts. 
    *   *Method:* Breaks down goals using `spec-breakdown-architect`, allocates token budget, evaluates plans, and delegates to specialist subagents via the A2A (Agent-to-Agent) protocol.
*   **T1 Specialists (Swarm Nodes):** 
    *   *Role:* Domain experts (e.g., `ui-engineer`, `database-architect`, `security-quality-gatekeeper`).
    *   *Method:* Executing atomic jobs concurrently on isolated `gitbutler` virtual branches.
*   **T2 Verifiers (Critics / Council):** 
    *   *Role:* Independent reviewers.
    *   *Method:* Invoked pre-merge (via `critique-council-reviewer` or `llm-council-chairman`) to evaluate feasibility and security.

## 2. Autonomous Swarming Methods

When the T0 Orchestrator detects a multi-domain or highly complex task, it autonomously selects and applies the best swarming topology:

### A. Sequential Swarming
*   **Trigger:** Linear dependencies (e.g., DB Schema -> Backend API -> Frontend UI).
*   **Execution:** Subagents are invoked sequentially. The handoff context is synthesized and passed to the next agent down the chain.

### B. Parallel (DAG) Swarming
*   **Trigger:** Independent domains (e.g., generating 5 separate utility functions).
*   **Execution:** `dag-orchestrator` is invoked to map the critical path. Multiple T1 specialists are launched concurrently. The T0 orchestrator awaits all callbacks before synthesizing.

### C. Contradictory Deliberation
*   **Trigger:** Ambiguous architecture decisions, high-risk migrations, or RLS policy changes.
*   **Execution:** `palabre` debate orchestrator is engaged. Two T1 specialists argue different approaches, and the `llm-council-chairman` synthesizes the final authoritative specification.

## 3. Best Method Application
The orchestration model automatically switches between single-agent (for trivial tasks) and swarms based on the AST complexity of the user's prompt. No manual configuration is required.
