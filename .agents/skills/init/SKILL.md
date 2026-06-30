---
name: init
description: Run environmental verification and onboarding for the Arch-Systems monorepo. Configures and checks dependencies, database status, and coding standards.
---

# Arch-Systems Onboarding & Workspace Initialization

Welcome to the Arch-Systems monorepo! This skill is executed when `/init` is invoked to verify the development environment, review project architectures, and outline the workspace rules.

## 🏗️ Execution Flow

When this skill is triggered, you must perform the following actions:

1. **Greet the Developer**: Present a brief welcome message introducing the Arch-Systems Portal architecture (Next.js portal, Payload CMS, React Flow visualizer).
2. **Execute Environmental Verifications**: Run the health check script [verify-env.sh](file:///home/tim/Arch/.agents/skills/init/scripts/verify-env.sh) using `run_command` in `/home/tim/Arch`. Output the results in a clean code block.
3. **Handle Missing Prerequisites**:
    - If `node_modules` is missing, recommend running `pnpm install`.
    - If Docker is stopped, prompt the user to start the Docker daemon.
    - If Supabase/Redis is offline, explain how to spin them up (`pnpm dev`, `pnpm --filter @repo/database supabase:dev`, `pnpm redis:dev`).
4. **Remind of Critical Standards**:
    - **Themes & Colors**: Only OKLCH tokens from `@repo/theme` (no raw/hardcoded hex or oklch colors). Light theme only is enforced.
    - **Class Merging**: Always use [cn()](file:///home/tim/Arch/01_platform_packages/ui/src/lib/utils.ts#L4) from `@repo/ui/lib/utils` (do not use raw template strings).
    - **Icons**: Named imports only (e.g. `import { Drill } from "lucide-react"`). Never do `import * as Icons`.
    - **Security & RLS**: Every new table must have Row-Level Security (RLS) enabled. Use `pnpm audit:rls` to verify.
    - **Database Migrations**: Add zero-padded SQL files to [01_platform_packages/database/migrations/](file:///home/tim/Arch/01_platform_packages/database/migrations/) (e.g. `062_add_table.sql`) and commit them along with the regenerated types in [01_platform_packages/supabase/src/database.types.ts](file:///home/tim/Arch/01_platform_packages/supabase/src/database.types.ts).
    - **Policy Compiler**: Run `pnpm policy:gen` after changes to [08_developer_tooling/policy-compiler.cjs](file:///home/tim/Arch/08_developer_tooling/policy-compiler.cjs).
    - **Jest Testing**: When importing `@repo/*` packages in Next.js portal unit tests, update `moduleNameMapper` in [00_applications/portal/jest.config.js](file:///home/tim/Arch/00_applications/portal/jest.config.js).
5. **Next Steps**: Advise running `pnpm dev` to start the local dev server or `pnpm quality` to run the full quality gate checks.

## 📖 Key Reference Files

- [AGENTS.md](file:///home/tim/Arch/AGENTS.md) — Source of truth for CI gates, commands, and schemas.
- [README.md](file:///home/tim/Arch/README.md) — High-level quickstart and project overview.
- [MONOREPO.md](file:///home/tim/Arch/MONOREPO.md) — Workspace packages map and static analysis details.
- [HOW.md](file:///home/tim/Arch/HOW.md) — Active implementation spec and TodoWrite checklist.
- [PROGRESSIVE_DISCLOSURE.md](file:///home/tim/Arch/PROGRESSIVE_DISCLOSURE.md) — Selective context loading guide.
