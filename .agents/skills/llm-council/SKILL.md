---
name: llm-council
description: Karpathy LLM Council 3-Stage Multi-Agent Deliberation and Blind Peer-Review Runbook
version: 1.0.0
---

# Karpathy LLM Council Multi-Agent Deliberation Skill

## 1. Overview

The `llm-council` skill provides a structured 3-stage deliberation framework (inspired by Andrej Karpathy's open-source `llm-council` architecture) for high-stakes technical, architectural, and security decisions.

It eliminates single-agent confirmation bias and hallucinations through **blind anonymous peer review** and synthesized Chairman verdicts.

---

## 2. 3-Stage Deliberation Lifecycle

```
[Query / Architectural Problem]
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Stage 1: Individual Opinions (Parallel Proposals)      │
│ • Systems Architect                                    │
│ • Lead Security & Compliance Auditor                   │
│ • Hardware & SRE Operations Specialist                 │
│ • Quality & Verification Lead                          │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Stage 2: Anonymous Cross Peer-Review (Blind Grading)   │
│ • Identities masked as Candidate A, Candidate B, etc.  │
│ • Quantitative grading: Accuracy, Security,            │
│   Feasibility, Completeness (1-10)                     │
│ • Cross-critique without author bias                   │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Stage 3: Chairman Synthesis & Actionable Verdict       │
│ • Rank candidate proposals                             │
│ • Extract consensus points & key disagreements         │
│ • Issue final authoritative specification & action plan│
└────────────────────────────────────────────────────────┘
```

---

## 3. Usage & CLI Invocations

### Direct CLI Invocation

```bash
pnpm council "<architectural_or_security_question>"
```

Or directly:

```bash
node tools/scripts/llm-council.cjs "<question>"
```

### Auto-Dispatch via Spec Breakdown

When prompts contain keywords like `council`, `deliberation`, `consensus`, or `blind review`, the `spec-breakdown-engine.cjs` automatically selects the `council_deliberation` swarm topology.

### Programmatic Invocation

```javascript
const { runCouncil } = require("./tools/scripts/llm-council.cjs");

const { transcript, transcriptPath } = runCouncil(
  "Should we use Redis L1 in-memory map or Redis Cluster for edge proxy?",
);
console.log(transcript.stage3_synthesis.finalVerdict);
```

Deliberation transcripts are automatically archived in `.a2a/bus/council-transcripts/`.
