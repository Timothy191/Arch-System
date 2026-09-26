---
title: Monorepo Tool Comparison
created: 2026-05-15
updated: 2026-06-03
type: comparison
tags: [architecture, build, decision]
sources: [turbo.json, docs/wiki/concepts/turbo-monorepo.md, pnpm-workspace.yaml]
confidence: high
---

# Monorepo Tool Comparison: Turborepo vs Nx vs pnpm Workspaces

## What is Being Compared

Selection of monorepo orchestration tool for a multi-package TypeScript codebase with a Next.js portal, CMS, and shared UI library.

## Dimensions of Comparison

| Dimension              | Turborepo 2.1                       | Nx (Current Choice)                    | pnpm Workspaces (alone) |
| ---------------------- | ----------------------------------- | -------------------------------------- | ----------------------- |
| **Build Cache**        | Remote + local (Vercel integration) | Remote + local (Turborepo Cloud/Local) | None (manual)           |
| **Task Pipeline**      | Graph-based, configurable           | Graph-based, very configurable         | Script-based            |
| **Affected Detection** | Via `turbo.json` deps               | Git-based affected graph               | Manual                  |
| **Bundle Analysis**    | Built-in                            | Bundle analyzer plugins                | None                    |
| **TypeScript**         | First-class                         | First-class                            | Package-level only      |
| **Incremental Builds** | Yes                                 | Yes                                    | No                      |
| **IDE Support**        | Good                                | Excellent (Turborepo Console)          | None                    |
| **Migration Path**     | Easy from CRA/Vite                  | Steeper learning curve                 | N/A                     |
| **CI/CD Integration**  | Vercel-native                       | Broad CI support                       | Manual scripting        |
| **Cost**               | Free (remote cache on Vercel)       | Free (local cache / Turborepo Cloud)   | Free                    |

## Project Implementation

Arch-Systems uses **Turborepo 2.10.12 + pnpm 9.15.9 workspaces**:

```json
// turbo.json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build", "^codegen"],
      "outputs": [
        "{projectRoot}/.next/**",
        "!{projectRoot}/.next/cache/**",
        "{projectRoot}/dist/**"
      ],
      "cache": true
    },
    "codegen": {
      "inputs": [
        "{projectRoot}/src/css/variables.css",
        "{projectRoot}/scripts/generate-tokens.mjs"
      ],
      "outputs": ["{projectRoot}/src/tokens/generated.ts"],
      "cache": true
    }
  }
}
```

With pnpm workspace catalogs for shared dependency versions:

```yaml
# pnpm-workspace.yaml
catalog:
  framer-motion: ^12.4.0
  tailwindcss: ^3.4.17
```

## Why Turborepo Was Chosen

Initially, Turborepo was selected for its simplicity and close integration with Vercel. However, as the workspace grew to include more packages, strict security configurations (like admin data lockdown), and a comprehensive DeepEval AI compliance testing suite, we encountered limitations. Turborepo was chosen to replace Turborepo because:

1. **Test Environment Stability**: Turborepo had issues stabilizing concurrent Jest/jsdom test executions. Turborepo handles parallel test execution and cache partitioning more robustly, eliminating test-runner hangs.
2. **Fine-Grained Caching**: Turborepo allows defining project-specific inputs and outputs for custom tasks (like `codegen`, `lint:tokens`, `lint:css`), preventing cache invalidation on unrelated styling changes.
3. **Affected Code Analysis**: Turborepo has a superior git-based analysis engine (`turbo run`) to accurately pinpoint which packages need linting, testing, or building.
4. **Tooling & Command Execution**: Turborepo's `run-many` task executor has superior visualization and error reporting compared to Turborepo.

## Why Not Turborepo (Superseded)

While Turborepo served us well in early phases, its task scheduling system lacked the features needed to manage a multi-department codebase with real-time SCADA inputs, localized AI model dispatching, and high-frequency testing gates.

## Why Not pnpm Workspaces Alone

pnpm workspaces handle installation and linking, but lack:

- Build orchestration across dependency graph
- Task caching (critical for CI speed)
- Incremental rebuilds
- Affected package calculation

## Verdict

**Turborepo + pnpm is optimal** for the current scale of Arch-Systems. It provides the package linking performance of pnpm with the enterprise-grade task pipeline and test runner stability of Turborepo.

## Related

- [[turbo-monorepo]] — Workspace layout and conventions
- [[arch-systems]] — How the monorepo structure supports the product
- [[adr-008-turbo-monorepo]] — Architecture Decision Record
