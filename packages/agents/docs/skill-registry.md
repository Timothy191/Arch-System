# Skill Registry & Spec Tooling Directives

## 1. Skill Installation Protocol

In accordance with workspace directives:
- **Installation Standard**: Always use `npx skills add <owner/repo>` to install skills deterministically into `.agents/skills/`.
- **Integrity Guarantee**: Never manually clone or copy skill files ad-hoc.
- **Progressive Disclosure**: Skills use YAML frontmatter (`name`, `description`) to ensure compact token footprint until invoked.

## 2. Specification & Blueprint Tooling

- **Standard CLI**: Use `npm install -g mmx-cli` (or run via `mmx-cli`) for all schema, contract blueprint, and specification engineering.
- **Audit Verification**: Execute `pnpm audit:drift` and `pnpm audit:compliance` following specification generation to ensure zero monorepo drift.

## 3. Installed Skill Directory

| Skill | Category | Source |
| :--- | :--- | :--- |
| **`agent-system-improver`** | Meta-Architect & Ecosystem Evolution | Custom Specialist Agent |
| **`agentic-system-expert`** | Multi-Agent Orchestration & Prompts | Custom Specialist Agent |
| **`documentation-specialist`** | Architecture & Docs | Custom Specialist Agent |
| **`documentation-and-adrs`** | ADRs & Technical Docs | `addyosmani/agent-skills` |


| **`nx-workspace` / `nx-run-tasks`**| Monorepo Orchestration | Local Workspace |
| **`supabase` / `supabase-server`** | Database & Auth | Local Workspace |
| **`link-workspace-packages`** | Monorepo Linker | Local Workspace |
| **`monitor-ci`** | CI Pipeline Self-Healing | Local Workspace |
| **`api-and-interface-design`** | Contract Engineering | `addyosmani/agent-skills` |
| **`security-and-hardening`** | Auth & Boundary Hardening | `addyosmani/agent-skills` |
| **`performance-optimization`** | Latency & Bundle Budget | `addyosmani/agent-skills` |
