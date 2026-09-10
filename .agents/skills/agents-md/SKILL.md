---
name: agents-md
description: >-
  Standard guidelines, conventions, and operational runbooks for AI coding agents
  implementing tasks in the codebase based on the open AGENTS.md specification
  (https://github.com/agentsmd/agents.md). Use this skill when authoring, updating,
  interpreting, or auditing AGENTS.md guidelines and agent execution workflows.
---

# AGENTS.md Standard & Agent Execution Guide

This skill embeds the open **AGENTS.md** standard (from [agentsmd/agents.md](https://github.com/agentsmd/agents.md)) directly into the agent environment. It equips AI agents with official conventions, hierarchical discovery patterns, and operational guardrails while implementing tasks across monorepos and subpackages.

---

## 1. Core Philosophy of AGENTS.md

- **README for AI Agents**: A predictable, standardized location providing necessary context and instructions to help AI coding agents work safely and autonomously.
- **Zero Monorepo Intrusion**: Agentic instructions live in `.agents/` and dedicated markdown standard files (`AGENTS.md`), avoiding pollution of application source trees or build configs.
- **Hierarchical Discovery**: When an agent works on files within a subdirectory (e.g. `apps/portal` or `packages/database`), the nearest `AGENTS.md` file takes precedence for package-specific rules, while the root `AGENTS.md` defines workspace-wide invariants.

---

## 2. Standard Structure for AGENTS.md

A compliant `AGENTS.md` file must provide concise, non-obvious operational instructions:

1. **Project / Package Overview**: Brief architecture summary, tech stack, and primary purpose.
2. **Commands & Inner Loop**: Exact, fast commands to install, build, type-check, and run targeted tests.
3. **Coding & Architectural Conventions**: Design system constraints, module boundaries, error handling patterns.
4. **Agent Guardrails**:
   - Never run long blocking builds or production servers interactively when hot-reload is available.
   - Run sub-second targeted tests before invoking monorepo-wide test suites.
   - Preserve existing code comments and adhere to strict typing (no `any`, no `@ts-ignore`).
5. **Handoff & Tracing**: Document modifications in `AGENT_TRACER.md` with timestamps and handover context.

---

## 3. Monorepo Multi-Package Strategy

In large monorepos with diverse apps and libraries:

- **Root `AGENTS.md`**: Global monorepo guidelines, workspace scripts, toolchain versions (Node, pnpm, Turborepo), global architecture boundaries, and quality gate commands.
- **Subpackage Guidelines**: Specific subproject instructions can be placed in subdirectories or referenced via packages without duplication.
- **Agent Tracing (`AGENT_TRACER.md`)**: Maintained in each package root to record chronological changelogs for seamless handoffs between autonomous agents.

---

## 4. References & Bundled Standard Repository

The official upstream specification repository is mirrored locally in this skill:

- **Upstream Repository**: [`references/agents-md-repo`](./references/agents-md-repo)
- **Specification Documentation**: [`references/agents-md-repo/README.md`](./references/agents-md-repo/README.md)
- **Upstream Example**: [`references/agents-md-repo/AGENTS.md`](./references/agents-md-repo/AGENTS.md)
