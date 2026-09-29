# Advanced Methods for Maximizing Agent `.md` Files

To guarantee LLM agents process instructions deeply and retain strict alignment with real-world goals, this monorepo utilizes the following state-of-the-art `.md` context injection strategies:

## 1. Dynamic Context Bundling (`repomix`)

**Method:** Never feed raw directories to agents. Before delegating a task to a specialist subagent, the `autonomous-orchestrator` must run `repomix --include "packages/domain-name/**/*" --include "AGENTS.md"`.
**Why it works:** Compresses token usage while forcing the LLM to ingest the repository guidelines alongside the specific code, bridging the gap between "Rules" and "Implementation".

## 2. Multi-Tiered Prompt Architecture (The "Matryoshka" Pattern)

**Method:** Break massive prompts into cascading layers:

- **Global Constraints (L0):** `GEMINI.md` (Strict "Thou Shalt Not" rules, tool mandates).
- **Domain Context (L1):** `AGENTS.md` (System architecture, monorepo boundaries).
- **Persona Context (L2):** Inject the specific `<Job Role>` and `<Soul>` (e.g., `database-architect`).
- **Task Specifics (L3):** The immediate user prompt.
  **Why it works:** Prevents "Lost in the Middle" syndrome. The LLM focuses on its highly-specialized Persona and applies the global rules strictly to its domain.

## 3. The "Compile Before Speak" XML Guardrail

**Method:** Enforce execution checkpoints by injecting `<checkpoints>` into `GEMINI.md`.
**Why it works:** By requiring agents to produce specific markdown outputs (e.g., `<!-- GOAL_COMPLETE -->`) only _after_ running CLI commands (like `pnpm type-check` or `k6 run`), the text format itself acts as a state machine. The LLM physically cannot declare victory without parsing the output of the CLI tool.

## 4. AST-Driven Agent Hinting

**Method:** Couple `.md` guidelines with `ast-grep` rules.
**Why it works:** Instead of just telling an agent "Use the new RateLimiter", write an `ast-grep` rule that automatically flags legacy code and outputs a direct quote from `AGENTS.md` into the agent's CLI context. The agent receives real-time, context-aware reminders exactly when it makes a mistake.
