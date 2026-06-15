---
description: Phase 3 implementation plan — vector memory, multi-agent orchestration, MCP ecosystem, evaluator-optimizer. Target: ~90% Claude Code parity.
inclusion: auto
---

# Phase 3: Advanced Agentic Capabilities

## Step 3.1: Long-Term Agent Memory with Vector Search

Goal: Add embedding-based semantic search to existing LTM JSONL stores.

### Architecture

```
ltm/bin/
├── ltm.py              → existing (957 lines, stdlib JSONL management)
└── vector.py            → NEW: embeddings + semantic search (sentence-transformers)
```

File: `ltm/bin/vector.py`

Features:

- Embed events from `ltm/store/events.jsonl` using `sentence-transformers/all-MiniLM-L6-v2`
- Store embeddings in `ltm/store/vectors.jsonl` (JSONL with id + embedding + text + metadata)
- Search: cosine similarity against query embedding, return top-k
- CLI: `python3 ltm/bin/vector.py index` (re-index), `search "query"`, `status`
- Integration: n8n Pattern 4 (Vector Memory) and Pattern 5 (Hybrid Memory) webhooks call this script

### Dependencies

- `sentence-transformers` (PyPI) — 30MB model, no GPU needed, runs in <2s for typical project memories
- `numpy` — for cosine similarity

### Integration with n8n

- Pattern 4 webhook (`/webhook/vector-memory`) already exists
- Update its Code node to call `python3 ltm/bin/vector.py search "..."` instead of grep-based search
- Pattern 5 webhook (`/webhook/hybrid-memory`) combines vector search + recent events

---

## Step 3.2: Multi-Agent Orchestration

Goal: Real subprocess-based subagent spawning with worktree isolation.

### Architecture

```
.kiro/orchestrator/
├── index.js            → Orchestrator: decompose → spawn → aggregate
├── spawner.js          → Subprocess agent launcher (wraps harness pattern)
├── worktree.js         → Git worktree management
└── aggregator.js       → Result merging, conflict resolution
```

### Subagent Spawning

Follow `twaldin/harness` pattern: invoke agents as subprocesses with:

- `RunSpec`: harness type, model, prompt, workdir, instructions, timeout
- `RunResult`: exit code, cost, tokens, stdout, stderr

For this project:

- Primary subagent: `npx opencode` or `node /opt/Kiro/src/cli.js` with `--print` mode
- Worktree isolation: `git worktree add` per subagent
- System prompt injection via `.kiro/worktrees/<unit-id>/AGENTS.md`

### Worktree Lifecycle

1. `worktree.create(unitId)` → `git worktree add ../Arch-Mk2-{unitId} HEAD`
2. `worktree.injectConfig(unitId, instructions)` → write AGENTS.md
3. `spawner.run(harness, prompt, workdir)` → returns RunResult
4. `worktree.mergeChanges(unitId)` → cherry-pick or diff apply
5. `worktree.remove(unitId)` → `git worktree remove`

---

## Step 3.3: MCP Ecosystem Expansion

Goal: Unified MCP tool registry with health monitoring.

### Architecture

```
.kiro/mcp/
├── index.js            → MCP orchestrator: route tools, health check, discover
├── registry.json       → Known MCP servers and their capabilities
└── servers/
    └── (symlinks or configs)
```

### New MCP Servers to Add

| Server     | Purpose                    | Install                           |
| ---------- | -------------------------- | --------------------------------- |
| GitHub MCP | Issues, PRs, repos, search | `npx @anthropic-ai/mcp-github`    |
| Playwright | Browser automation         | Already configured in `.mcp.json` |
| DevDocs    | Documentation search       | Already configured                |

### Unified Tool Registry

Create a dynamic tool discovery system:

1. On session start, list all MCP servers from `.mcp.json`
2. Call `tools/list` on each to get available tools
3. Cache the tool catalog in `.kiro/mcp/registry.json`
4. Provide unified `call_tool(name, args)` that routes to the right server

---

## Step 3.4: Evaluator-Optimizer Deep Workflow

Goal: End-to-end PR generation for issue fixes.

### Architecture

```
.kiro/evaluator-optimizer/
├── index.js            → Main workflow orchestrator
├── analyze.js          → Issue analysis and reproduction
├── generate.js         → Code generation with worktree isolation
├── evaluate.js         → Test running, linting, review
├── optimize.js         → Iterative refinement loop
└── pr.js               → PR creation via GitHub MCP
```

### Workflow

```
Input: GitHub issue URL or description

1. ANALYZE: Read issue, reproduce bug, identify files to change
2. GENERATE: Create fix in isolated worktree
3. EVALUATE: Run tests, lint, typecheck
4. OPTIMIZE: If evaluation fails, refine and repeat (max 3 iterations)
5. PR: Create branch, commit, push, open PR with description

Iteration limit: 3 cycles
Fallback: Report failure with reproduction steps
```

### n8n Integration

Pattern 7 (Evaluator-Optimizer) webhook `/webhook/eval-optimizer` calls:

```bash
node .kiro/evaluator-optimizer/index.js --issue "$ISSUE_URL" --workdir /tmp/eval-work
```

---

## Implementation Order

1. **Vector memory** — `ltm/bin/vector.py` + n8n webhook updates
2. **Multi-agent orchestrator** — `.kiro/orchestrator/` with spawner + worktree
3. **MCP expansion** — GitHub MCP + unified registry
4. **Evaluator-optimizer** — Full PR generation workflow

## Files Summary

### Create

```
ltm/bin/vector.py
.kiro/orchestrator/index.js
.kiro/orchestrator/spawner.js
.kiro/orchestrator/worktree.js
.kiro/orchestrator/aggregator.js
.kiro/mcp/index.js
.kiro/mcp/registry.json
.kiro/evaluator-optimizer/index.js
.kiro/evaluator-optimizer/analyze.js
.kiro/evaluator-optimizer/generate.js
.kiro/evaluator-optimizer/evaluate.js
.kiro/evaluator-optimizer/optimize.js
.kiro/evaluator-optimizer/pr.js
.kiro/steering/phase3-plan.md
```

### Modify

```
.kiro/agents/digital-twin.md (add Phase 3 capabilities)
.kiro/agents/team-lead.md (orchestrator integration)
.mcp.json (GitHub MCP server)
.kiro/steering/n8n-integration.md (vector/hybrid memory updates)
.kiro/settings.json (orchestrator hooks)
```
