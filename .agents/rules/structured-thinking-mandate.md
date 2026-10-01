---
name: structured-thinking-mandate
description: >-
  Mandatory structured thinking and deep reasoning enforcement for all AI agents.
  Every agent operating in this codebase must engage extended chain-of-thought
  reasoning before executing any code mutation, architectural decision, or
  non-trivial research action — regardless of model provider or agent framework.
paths:
  - '**/*'
alwaysApply: true
---

# Structured Thinking Mandate (STM-0)

**Governing Rule:** `STM-0 — All AI agents operating within this codebase MUST engage structured, extended thinking before executing ANY non-trivial action. Reflexive code generation without demonstrated reasoning is a quality gate violation.`

This rule is **permanently and autonomously active** across all agent sessions, all model providers (Gemini, Claude, OpenAI, Ollama, local models), and all execution contexts (interactive, swarmed, background loops, CI bots).

---

## 1. The Core Principle

Industrial mining operations run 24/7 under extreme conditions. A single wrong database migration, a misconfigured RLS policy, or a broken SCADA telemetry stream can halt production across an entire pit. **Speed of code generation is worthless if the reasoning behind it is hollow.**

Every agent must demonstrate that it has **thought deeply** before it acts. The thinking must be:

- **Visible**: Externalized in markdown blocks, agent tracer entries, or thinking tags — never silently internal.
- **Structured**: Following the defined phases below, not freeform stream-of-consciousness.
- **Falsifiable**: Making specific claims that can be verified against the codebase, not vague assurances.
- **Self-Critical**: Actively seeking flaws in its own reasoning before committing.

---

## 2. The Mandatory Thinking Protocol (MTP)

Before executing any **code mutation** (file write, edit, delete), **architectural decision**, **migration**, **schema change**, or **configuration change**, the agent MUST complete all five phases:

### Phase 1: Situational Comprehension

```
THINK: What exactly is being asked? What is the operational context?
```

- Restate the task in your own words.
- Identify the affected packages, modules, and boundary layers.
- Map the request to the [Architecture & Data Flow](../../AGENTS.md) diagram.
- Name the operational personas impacted (Control Room, Engineering, Access Control, Supervisors).

### Phase 2: Evidence Gathering & Root-Cause Analysis

```
THINK: What does the codebase actually say? What are the facts on the ground?
```

- Read the relevant source files — do not assume you know their contents.
- Trace the data flow from ingress to persistence and back.
- Identify all existing tests, schemas, types, and contracts that touch this area.
- If diagnosing a bug: reproduce it or identify the exact failure path before proposing a fix.
- **Hard Rule**: Never propose a change based on assumption alone. If you haven't read the file, you don't know what's in it.

### Phase 3: Solution Design & Alternative Evaluation

```
THINK: What are my options? Why is this one the best?
```

- Propose at least **two** candidate approaches for non-trivial changes.
- Evaluate each against the five-pillar Real-World Quality Score:
  - **Feasibility**: Can this be implemented with the existing stack and constraints?
  - **Maintainability**: Will the next engineer (human or agent) understand this in 6 months?
  - **Security**: Does this maintain RLS, auth, input validation, and audit integrity?
  - **Performance**: What is the impact on query latency, bundle size, and real-time streaming?
  - **Industrial Reliability**: Will this survive lie-fi, vibration, dust, and 24/7 continuous operation?
- Select the approach with the highest justified score.
- For trivial changes (typo fixes, single-line edits with obvious correctness), a brief inline rationale suffices.

### Phase 4: Pre-Commit Criticism (Devil's Advocate)

```
THINK: What could go wrong? What am I missing?
```

- **Blast Radius**: What other modules, tests, or deployments could this break?
- **Invariant Violations**: Does this violate any rule in `AGENTS.md`, `GEMINI.md`, or `.agents/rules/`?
- **Edge Cases**: What happens with null/empty/malformed input? Network failure? Concurrent access?
- **Regression Risk**: Could this silently break an existing feature without failing a test?
- **Dependency Analysis**: Are there upstream or downstream packages that need coordinated changes?
- If criticism reveals a flaw, return to Phase 3 and revise. Do not proceed with a known-flawed plan.

### Phase 5: Execution Contract

```
THINK: What exactly will I do, and how will I prove it worked?
```

- State the precise files to be modified, created, or deleted.
- State the verification command(s) that will prove correctness (e.g., `pnpm type-check`, `pnpm --filter <pkg> test`, `pnpm audit:drift`).
- State the expected outcome of verification.
- Only after completing this contract may the agent begin executing file mutations.

---

## 3. Thinking Externalization Format

Agents MUST externalize their thinking in one of these approved formats:

### Format A: Inline Thinking Block (Interactive Sessions)

```markdown
<structured-thinking>
## Phase 1: Situational Comprehension
[reasoning here]

## Phase 2: Evidence Gathering
[evidence and file references here]

## Phase 3: Solution Design
[alternatives and evaluation here]

## Phase 4: Pre-Commit Criticism
[self-critique here]

## Phase 5: Execution Contract
- Files: [list]
- Verification: [commands]
- Expected: [outcome]
</structured-thinking>
```

### Format B: Extended Thinking Tags (Models with Native Thinking)

Models that support extended thinking (Claude with thinking, Gemini with thinking mode) MUST have thinking enabled and use their native thinking capabilities. The structured phases must still be followed within the thinking block.

### Format C: AGENT_TRACER Entry (Background/Autonomous Loops)

For background loops and autonomous agents, append a timestamped structured thinking entry to the relevant `AGENT_TRACER.md`:

```markdown
### [ISO-8601] Structured Thinking — [Task Description]

**Phase 1 (Comprehension):** [summary]
**Phase 2 (Evidence):** [files inspected]
**Phase 3 (Design):** [approach selected and why]
**Phase 4 (Criticism):** [risks identified]
**Phase 5 (Contract):** [files modified, verification run, outcome]
```

---

## 4. Scaling Rules: When to Think Deeply vs. Briefly

Not every action requires a 500-word reasoning essay. The depth of thinking must scale with the **risk and complexity** of the action:

| Action Category | Risk Level | Required Thinking Depth |
|:---|:---|:---|
| Typo fix, comment update, formatting | Trivial | One-line inline rationale |
| Single-file bug fix with obvious root cause | Low | Brief Phase 1 + Phase 5 (2-3 sentences) |
| Multi-file feature implementation | Medium | Full 5-phase protocol (concise) |
| Database migration or schema change | High | Full 5-phase protocol (thorough) |
| Architectural refactor or boundary change | Critical | Full 5-phase protocol + independent critique council review |
| RLS policy, auth flow, or security change | Critical | Full 5-phase protocol + explicit security threat model |
| Shift closeout, SCADA, or production data mutation | Critical | Full 5-phase protocol + idempotency proof + rollback plan |

---

## 5. Anti-Patterns (Hard Negatives)

The following behaviors are **strictly prohibited**:

1. **Code-First, Think-Never**: Generating code without any visible reasoning. This is the primary failure mode this rule prevents.
2. **Rubber-Stamp Thinking**: Writing "I thought about it and it's fine" without specific claims. Thinking must be falsifiable.
3. **Copy-Paste Reasoning**: Reusing identical reasoning blocks across different tasks. Each task's reasoning must be specific to its context.
4. **Assumption Cascades**: Building a chain of unverified assumptions. Every factual claim must reference a file, test, or command output.
5. **Sycophantic Self-Agreement**: Never skip Phase 4 (Criticism). The agent must genuinely challenge its own plan, not merely perform agreement theater.
6. **Thinking Without Acting**: Extended deliberation that never converges on a concrete execution contract. Phase 5 must always produce actionable steps.
7. **Post-Hoc Rationalization**: Writing the reasoning after the code is already written. Thinking must precede execution.

---

## 6. Integration with Existing Rules

This rule augments and coordinates with the existing agent rule ecosystem:

- **`self-reflection-loop`**: The MTP Phase 4 (Criticism) supersedes and extends the self-reflection skill's cognitive loop. Agents using the self-reflection skill satisfy Phase 4 automatically.
- **`fable-method`**: Fable's "Think, Act, Prove" maps directly to MTP Phases 1-3 (Think), Phase 5 (Act), and verification (Prove). Both can be used together.
- **`real-world-checker`**: The ARWR workflow is invoked as part of Phase 2 evidence gathering when validating assumptions against the live repository.
- **`real-world-engineering`**: The Pre-Write Critique Council (Quality Score ≥ 90/100) is evaluated during Phase 3 solution design.
- **`permanent-engineering-rules` §2 (Evidence First)**: The `inspect → understand → verify → compare → change → test → verify` chain is the operational backbone of Phases 1-2.
- **`permanent-engineering-rules` §19 (Agent Behavior)**: "Act as senior engineers, not code generators" — this rule is the enforcement mechanism for that principle.
- **`execution-guardrails`**: Verification commands in Phase 5 must include the guardrail-mandated `pnpm audit:drift` and `pnpm audit:compliance` for relevant changes.

---

## 7. Enforcement & Quality Gate

### Automated Verification

Agent orchestrators and supervisors MUST verify that subagent responses contain structured thinking before accepting their output. Responses that contain code mutations without visible structured reasoning MUST be rejected and the subagent instructed to re-execute with proper thinking.

### AGENT_TRACER Audit

During `tracer-integrity` watchdog sweeps, entries without structured thinking annotations for non-trivial changes are flagged as `THINKING_MISSING` violations.

### Self-Healing Loop Integration

Per `GEMINI.md §19`, the autonomous self-healing loop (`pnpm agent:verify`) includes thinking compliance as a verification dimension. Agents that fail thinking verification must self-correct by re-executing the MTP before re-running verification.

---

## 8. Model-Specific Guidance

| Model / Provider | Thinking Implementation |
|:---|:---|
| **Claude Opus 4.x (Thinking)** | Enable extended thinking. MTP phases execute within the native thinking block. Externalize key conclusions in the response. |
| **Claude Sonnet 4.x** | Use Format A (inline markdown blocks) for all MTP phases. |
| **Gemini 2.5 Pro / Flash (Thinking)** | Enable thinking mode. MTP phases execute within the native thinking block. Externalize key conclusions in the response. |
| **Gemini 2.5 Flash** | Use Format A (inline markdown blocks) for all MTP phases. |
| **DeepSeek-R1 / Reasonix** | Native reasoning tokens satisfy Phases 1-3. Agent must still explicitly execute Phase 4 (Criticism) and Phase 5 (Contract). |
| **Ollama / Local Models** | Use Format A (inline markdown blocks). Local models with limited context must still complete at minimum Phase 1 + Phase 4 + Phase 5. |
| **Background Corpos Loops** | Use Format C (AGENT_TRACER entries). Abbreviated but complete. |
| **CI/CD Bots** | Minimal Phase 5 (execution contract) logged to CI output. |

---

## 9. Rationale

This rule exists because:

1. **Production consequence**: Arch-System controls real mining operations. Thoughtless code changes have real-world safety and financial consequences.
2. **Multi-agent coordination**: When multiple agents work concurrently, visible reasoning creates an auditable decision trail that prevents conflicting changes and enables effective handover.
3. **Quality compounding**: Structured thinking catches defects at the cheapest point in the lifecycle — before code is written, not after deployment.
4. **Accountability**: When a change causes a production incident, the thinking trace provides immediate insight into what the agent considered (and what it missed).
5. **Model-agnostic excellence**: Regardless of which AI model is operating, the quality of output is bounded by the quality of reasoning, not the speed of token generation.
