---
name: vercel-cli
description: Autonomous project management, environment orchestration, and deployment workflow execution utilizing the Vercel CLI and Vercel MCP integrations.
---

# Vercel CLI Skill Runbook

Use this skill to deploy Next.js (and other framework) applications to Vercel, manage environment variables, configure the Vercel MCP server, and inspect Vercel deployments autonomously.

## 1. Core Workflow & Best Practices
- **Non-Interactive Execution:** When executing commands autonomously, agents MUST always use `--yes` or `--non-interactive` flags to bypass interactive UI prompts which would otherwise cause the agent to hang.
- **Verification First:** Before executing mutations (deploying or altering env vars), run `vercel project inspect --non-interactive` to confirm the context (correct project, org, and environment).
- **Always use `.vercelignore`**: Before deploying, always verify or create a `.vercelignore` file to exclude heavy artifacts (`out/`, `.next/`, large zip files, test outputs) that are not needed for the build. This reduces upload size and speeds up deployment.
- **Build Filters**: Ensure that your `vercel.json` has the correct `buildCommand` (e.g., `pnpm build --filter=portal`) so Vercel knows exactly what to build in a monorepo.
- **Use npx**: Always prefix `vercel` commands with `npx` (or `pnpm exec`) if the CLI is not globally installed on the environment.

## 2. Common Agent Tasks
An AI agent should be proficient at executing these core Vercel CLI tasks:

### Project Linkage & Setup
- `npx vercel link --yes` - Link a local directory to a Vercel project.
- `npx vercel project inspect --non-interactive` - Gather metadata about the linked project.

### Environment Management
- `npx vercel env ls` - List environment variables.
- `npx vercel env pull --yes` - Synchronize remote environment variables locally to `.env.local`.
- `npx vercel env add/rm` - Programmatically modify environment variables across environments.

### Deployments
- **Deploy to Preview**: `npx vercel deploy --yes` - Create preview deployments.
- **Deploy to Production**: `npx vercel deploy --prod --yes` - Push production releases.
- **Dry Run**: Use `npx vercel deploy --dry` to see what files would be uploaded and the detected framework.
- **Prebuilt Deploy**: `npx vercel build` followed by `npx vercel deploy --prebuilt --yes` - Ideal for scenarios where a custom local or CI build step is required prior to deployment.

### Deployment Inspection
- `npx vercel ls` - List deployments.
- `npx vercel inspect <deployment-url>` - Inspect a deployment.
- `npx vercel logs <url>` - Query and retrieve logs for specific deployments for automated debugging.

## 3. MCP Server & AI Integrations
Vercel has an official MCP (Model Context Protocol) integration. This allows agents with MCP support to natively interact with a user's Vercel account.

- **Vercel MCP Setup:** The Vercel CLI (v60+) includes a native command to configure MCP servers for clients:
  - `npx vercel mcp --clients "Claude Code,Cursor,VS Code with Copilot" --non-interactive`
  - Agents can execute this to automate their own or other AI clients' access to Vercel.
- **Project Scoping:** Agents can configure project-specific access by utilizing the `--project` flag when running the `vercel mcp` command.
