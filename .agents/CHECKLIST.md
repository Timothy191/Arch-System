# Federated Systems Implementation & Readiness Checklist

> **Canonical Document:** `.agents/CHECKLIST.md`  
> **Target Scope:** Autonomous Agent Toolchain, Federated Projects, and Quality Gates  
> **Status:** Operational

---

## 1. Toolchain & Runtime Verification

Before executing autonomous coding or orchestration tasks, verify that the local toolchain is operational:

| Tool                     | Expected Path / Command                     | Test Command                   | Verification Criteria                   | Status          |
| :----------------------- | :------------------------------------------ | :----------------------------- | :-------------------------------------- | :-------------- |
| **Node.js**              | Mise-managed v26.8.1                        | `node -v`                      | Outputs `v26.8.1`                       | [x] Operational |
| **pnpm**                 | Pinned v9.15.9                              | `pnpm -v`                      | Outputs `9.15.9` (instant, no hang)     | [x] Operational |
| **ast-grep (`sg`)**      | `/home/tim/.local/share/mise/shims/sg`      | `sg --version`                 | Structural AST search functional        | [x] Operational |
| **difftastic (`difft`)** | `/usr/bin/difft`                            | `difft --version`              | Syntax-aware diffing functional         | [x] Operational |
| **repomix**              | `/home/tim/.local/share/mise/shims/repomix` | `repomix --version`            | Multi-agent context bundling functional | [x] Operational |
| **jq / yq**              | `/usr/bin/jq`, `/usr/bin/yq`                | `jq --version && yq --version` | JSON and YAML parsers functional        | [x] Operational |
| **k6**                   | `/home/tim/.local/share/mise/shims/k6`      | `k6 version`                   | API stress & load testing functional    | [x] Operational |
| **ruflo CLI**            | `/home/tim/.local/bin/ruflo`                | `which ruflo`                  | Wrapper for `@claude-flow/cli`          | [x] Operational |
| **firecrawl-mcp**        | `/home/tim/.local/bin/firecrawl-mcp`        | `which firecrawl-mcp`          | Local stdio scraper wrapper             | [x] Operational |

---

## 2. MCP Server Connectivity Matrix

Verify that core MCP servers respond correctly:

- [x] **Local Firecrawl Scraper (`192.168.0.215:3002`):**
  ```bash
  curl -s http://192.168.0.215:3002/ | jq .
  # Must return {"message": "Firecrawl API", ...}
  ```
- [x] **Repowise AST Codebase Intelligence:**
  ```bash
  /home/tim/.local/bin/repowise mcp /home/tim/Fork/Arch-System
  ```
- [x] **Persistent Knowledge Graph (`memory`):**
      Registered in `~/.gemini/antigravity-cli/mcp/mcp.json` and `~/.cursor/mcp.json`.
- [x] **Chrome DevTools & Puppeteer:**
      Browser DevTools MCP active for CDP layout, Speed Index, and ARIA audits.

---

## 3. Federated Services Verification

Always run commands **inside each specific project directory**, never at `/home/tim/Fork`:

- [ ] **Portal Monorepo (`Arch-System/`):**
  ```bash
  cd /home/tim/Fork/Arch-System
  pnpm dev:quick      # Quick headless boot check
  pnpm agent:verify   # Lint, type-check, and unit tests
  ```
- [ ] **NestJS Proxy (`arch-system-nest-proxy/`):**
  ```bash
  cd /home/tim/Fork/arch-system-nest-proxy
  npm run test        # Runs vitest test suite
  ```
- [ ] **Serverless Redis REST Engine (`redis/`):**
  ```bash
  cd /home/tim/Fork/redis
  npm run build       # Next.js 15 serverless build
  ```
- [ ] **Cross-Project Drift Audit:**
  ```bash
  node /home/tim/Fork/Arch-System/tools/zero-drift-watchdog/bin/federated-audit.mjs
  ```

---

## 4. Human-in-the-Loop (HITL) Gate Checks

- [ ] **L0 (Observer):** Autonomous read-only inspection.
- [ ] **L1 (Advisor):** Autonomous brief/audit creation.
- [ ] **L2 (Operator):** Code changes verified in worktree with quality gate score $\ge 90$.
- [ ] **L3 (Executive):** Production deploy / DB schema migration approved via signed card in `.agents/corpos/storage/approvals/`.
