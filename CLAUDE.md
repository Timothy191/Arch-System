# Claude Agent Guide

You are operating within the Arch-System enterprise mining-operations portal monorepo.

> **⚠️ Unified Agent System**: All agent behavioral rules, operational guides, skills, and governance are canonically consolidated into `.agents/`. Read [`.agents/GUIDE.md`](./.agents/GUIDE.md) for the authoritative operational reference and root [`AGENTS.md`](./AGENTS.md) for architecture.

## Directives & Ground Rules

- **SSoT**: Canonical architecture SSoT is [`AGENTS.md`](./AGENTS.md).
- **Operations & Tooling**: Unified operational guide is [`.agents/GUIDE.md`](./.agents/GUIDE.md).
- **Rules**: Permanent agent rules live in `.agents/rules/` (including `autonomous-browser-devtools-loop.md`).
- **Package Manager**: Use `pnpm` exclusively within Turborepo. Never invoke npm or yarn.
- **Verification**: Run `pnpm agent:verify` and `pnpm audit:browser` before completing any frontend task.
