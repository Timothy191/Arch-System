# Available Models and Capabilities Report (Goal-3)

## 1. Executive Overview
This report details the available LLM models, subagent tiers, thinking budgets, and routing heuristics within the Antigravity agent environment.

---

## 2. Interactive & Agent Model Family

The agent system operates with Google DeepMind's Gemini frontier models across multiple performance and thinking budget tiers:

| Model Tier / Name | Thinking Budget | Primary Strengths & Optimization | Recommended Use Cases |
| :--- | :--- | :--- | :--- |
| **Gemini 3.8 Flash (Low)** *(Active Session Model)* | Low (~2k tokens) | Ultra-low latency, maximum token conservation, fast tool calling | Interactive pair-programming, fast-feedback execution, single-file edits, CLI diagnostics |
| **Gemini 3.7 Flash (High)** | Adaptive / High (~24k tokens) | Adaptive hybrid reasoning, deep tool calling, fast complex code generation | Refactoring, AST-level boundary audits, full quality gate orchestration |
| **Gemini 3.5 / 3.6 Flash** | Low - Medium (~4k-8k tokens) | High throughput, efficient structured output, high prefix-cache reuse | Realtime state management, automated test execution, unit test generation |
| **Gemini 3.5 Flash-Lite** | Minimal (~1k-2k tokens) | Lightweight, minimal latency, lowest cost | Quick greps, simple file lookups, log classification |
| **Gemini 3.1 Pro (High / Low)** | Deep (~24k-64k tokens) | Frontier architectural synthesis, complex multi-step reasoning, mathematical proofs | System re-architecture, formal security analysis, cross-package boundary redesign |

---

## 3. Subagent Model Tiers (via \`invoke_subagent\`)

When delegating tasks to autonomous subagents, the \`Model\` property can be explicitly specified:

- **\`inherit\` (Default)**:
  Inherits the parent agent's active model (\`Gemini 3.8 Flash (Low)\`), preserving prompt cache alignment and execution continuity.
- **\`flash_lite\`**:
  Utilizes the lightest and fastest model. Optimal for background workers executing basic file greps, simple syntax lookups, or file status polls.
- **\`flash\`**:
  Balanced high-speed model suited for targeted unit tests, localized feature implementations, or API schema validation.
- **\`pro\`**:
  Frontier reasoning model suited for deep architectural reviews, multi-repository migration planning, root cause analysis on ambiguous failures, or complex state machine synthesis.

---

## 4. Effort-Tier & Thinking Budget Matrix

Based on \`~/.gemini/config/skills/effort-routing\`:

| Tier | Thinking Budget | Cost Multiplier | Recommended Tasks |
| :--- | :--- | :--- | :--- |
| **\`low\`** | ~2,048 tokens | 0.35x | Syntax fixes, single-line edits, file lookups, lint checks |
| **\`medium\`** | ~8,192 tokens | 1.0x | Default interactive pairing, component creation, feature development |
| **\`high\`** | ~24,576 tokens | 1.8x | Multi-file refactors, deep root cause analysis, test suite generation |
| **\`xhigh\` / \`max\`** | ~65,536 tokens | 2.5x | Autonomous research, whole-monorepo migrations, formal verification |

---

## 5. Summary & Model Routing Guidelines

1. **Default to \`inherit\`**: Unless explicit multi-layer reasoning or high-volume background data processing is required, maintain \`inherit\` to optimize system prefix cache hit rates.
2. **Delegate Broad Exploration to \`flash\` / \`flash_lite\`**: For wide multi-file AST scans, delegate to subagents with \`flash\` or \`flash_lite\` to keep the primary agent context cache-dense.
3. **Escalate to \`pro\` for Deep RCA**: When 3+ iterations fail on complex architecture problems, trigger circuit breaker escalation to \`pro\`.
