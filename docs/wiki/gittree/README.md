# Git Tree History

Complete git history map from project inception to present, showing all branches, merges, and major milestones.

## Current Branch Structure

```
* master (HEAD)
  |
  +-- origin/master (remote)
  |
  +-- worktree-feat-plantcor-os (stale worktree)
```

**Active Branches:**

- `master` — Main production branch (current HEAD, `011a577`)
- `fix/fix-bug` — Stale, fully merged into master at `a3d53b2`
- `worktree-feat-plantcor-os` — Stale, diverged from early project history

## Git Tree Timeline

### Current State (master)

```
* 011a577 (HEAD -> master)
  ├─ Phase 5.1: rendering performance, adaptive FPS, light-only theme consolidation
  └─ Latest: Consolidated portal overhaul and performance tuning
```

### Phase 5.1: Performance & Light Theme (Current)

```
011a577 feat: consolidated portal overhaul, design system, and tooling sync
```

### Phase 5: Multi-Agent Swarm & Portal Overhaul

```
c87f5f0 fix: add missing ESLint configs for cms/overview, fix lint errors, add turbo env vars
c25ac33 wip: sync portal AI, theme tokens, scripts and tooling
bfb627c chore: remove unnecessary dev infra files
304f0dc feat: access logs archival migration, theme token pipeline, deploy tooling
74d5ba2 feat: qr access control dashboard, audit logs, semantic status colors
b74ba6c feat: highlight + otel observability, inngest background jobs, novu notification infra
394941f Merge remote-tracking branch 'origin/master'
80c02b6 feat: pilot-shell workflow integration + session catch-up
9ded620 chore: add vercel deployment config and update lockfile
e92758b feat: light-theme migration, department layouts, and AI orchestrator
5e264e6 chore: expand .gitignore for generated and runtime artifacts
1ede69e feat: portal app — AI, departments, plugins, webhooks, and polish
332ffdc feat: packages — theme tokens, UI components, database, errors, and eval
49f0645 docs: wiki updates, entity docs, and project reporting
60f4bfd chore: devops scripts, tools, monitoring, and infrastructure
4e8bede chore: root tooling, CI, and workspace config updates
83121dd chore: update .gitignore for generated artifacts and IDE tools
185a867 chore: set up pro-workflow split memory architecture
830388c Phase 5: multi-agent swarm & advanced autonomy
```

### Phase 4: Production Hardening

```
a3d53b2 Phase 4: production hardening, observability & guardrails
```

### Phase 3: Advanced Agent Infrastructure

```
21ea2f3 Phase 3: vector memory, multi-agent orchestrator, MCP registry, evaluator-optimizer
3207fa2 Phase 2: safety system, agentic loop, advanced tooling
```

### Phase 2: Safety & Agentic Loop

```
3207fa2 Phase 2: safety system, agentic loop, advanced tooling
42cbbc6 fix: update n8n import script to use cookie-based auth
476a00b feat: add n8n startup script
```

### Phase 1: N8N Workflow Engine Integration

```
e81342d feat: n8n workflow engine integration with Kiro agents + 10 MCP workflow patterns
9fdf3a6 feat: version-control Kiro agent config + wire 12 hook scripts + Agent Teams pattern
```

### AI Memory & Infrastructure Layer

```
8ab70fa feat: excavator activity, shift coverage, AI memory layer, Redis cache, UI animations
2fa2740 chore: add scratch_test.ts with test export
a634218 docs: add docs/wiki directory
```

### Documentation & Architecture

```
788518c docs: update wiki index, log, and add docs package manifest
5300825 docs: add remaining wiki query and concept pages
8c667c0 docs: add wiki query templates
18114b0 docs: add architecture decision records (ADRs) for key technical choices
f963da1 docs: add ADR, incident response, and onboarding wiki pages
3470356 docs: add deployment and troubleshooting wiki pages
```

### Infrastructure & Automation Setup

```
0bc60ad chore: add Claude Code agents, commands, and hooks configuration
800e9cd docs: add and update wiki documentation for AI service, auth, departments, and architecture
6c829d2 chore: update root configs, eval tests, audit logs migration, and deploy script
```

### Portal & Component Refactoring

```
6a76c95 refactor: update portal department pages, hub layout, overview, and @repo/ui components
cf9510f feat: add 3D components, AI service routes, instrumentation, and portal enhancements
582c48e feat: add Payload CMS v3 app with Postgres adapter and admin panel
604182a feat: add @repo/theme package with design tokens, CSS variables, and Tailwind preset
```

### Control Room & Evaluation Suite

```
97f923e feat: finish control room, update CLAUDE.md, fix build errors
fea9d31 feat: add skills, shared components, DeepEval evaluation suite, and refactor pages
1caf461 docs: add DeepEval integration design spec
```

### Monitoring & Dashboard Overhaul

```
93cf498 chore: improve CLAUDE.md docs, fix audit issues, relocate overview app, clean up zips
a727cc3 feat: add breakdowns module, productivity tools, middleware auth, and cleanup gitignore
b90c1ca feat(monitoring): full standards overhaul — fix tile URLs, GeoJSON layers, velocity charts, AMD risk, stockpile estimator
e9d2c8f feat: add Advanced Satellite Monitoring module (SAR/InSAR, Hyperspectral, High-Res)
```

### Core AI Service & Portal Features

```
78d81b6 feat: add AI service, control room tables, engineering notes, excavator activity, hourly loads,
         machine operations, operational delays, roll-over modules, weather API, UI components, and portal refactors
```

### Portal UI/UX Phase

```
d42e7ed feat(portal): intro video background with fade-in login
e9ffa53 feat(portal): PlayStation wave video background + fix test script
ca8531d feat(portal): login aesthetics + rebrand to Arch-Systems
```

### Portal Phase 6-10: Foundation

```
d15d766 feat(portal): Phases 6–10 — error boundaries, DB schema, machine CRUD, admin, polish
053bb6a feat(portal): restore auth/hub routes, add Control Room components, remove broken files
```

### MCP & Initial Automation

```
114f41b docs(mcp): add Supabase MCP activation notes
a7ec7a0 chore(lockfile): normalize pnpm-lock.yaml quote style
95a673f chore(automation): enable plugins, add PreToolUse hooks, fix MCP config
21fba71 chore(automation): add Claude quality gates, design-system reviewer, MCP servers, and initial tests
```

### Code Review & Cleanup

```
09de3fe fix(simplify): address code review findings
8073380 fix: address code review — design system, security, monorepo boundaries
a3ed72d chore(post-review): clean up deps, lint-staged, and add CLAUDE.md
```

### Plantcor OS Foundation

```
49bc622 feat(plantcor): full Plantcor OS multi-department portal
4cbc080 Update README.md
```

## Branch Divergence Points

### Stale: fix/fix-bug

The `fix/fix-bug` branch is a historical label on commit `a3d53b2` (Phase 4), which is fully contained in master's history. It has no commits not in master.

**Status:** Stale — fully merged, delete-safe.

### Worktree: feat-plantcor-os

Branched from the Plantcor OS feature but diverged at commit `4614529`:

```
0d0e4a9 (worktree-feat-plantcor-os) docs(mcp): add Supabase MCP activation notes
4e030af chore(lockfile): normalize pnpm-lock.yaml quote style
b8c232b chore(automation): enable plugins, add PreToolUse hooks, fix MCP config
05f6e4a chore(automation): add Claude quality gates, design-system reviewer, MCP servers, and initial tests
538a644 fix(simplify): address code review findings
454ad9d fix: address code review — design system, security, monorepo boundaries
15e6cf8 chore(post-review): clean up deps, lint-staged, and add CLAUDE.md
8c39a59 feat(plantcor): full Plantcor OS multi-department portal
4614529 Update README.md
```

**Status:** Stale — superseded by master history

### Origin/Master (Remote)

Latest remote state at commit `011a577`:

```
011a577 (origin/master, origin/HEAD) Consolidated portal overhaul
```

**Status:** Remote tracking master (011a577)

## Full Git Graph

```
* 011a577 (HEAD -> master) feat: consolidated portal overhaul, design system, and tooling sync
* c87f5f0 fix: add missing ESLint configs for cms/overview, fix lint errors, add turbo env vars
* c25ac33 wip: sync portal AI, theme tokens, scripts and tooling
* bfb627c chore: remove unnecessary dev infra files
* 304f0dc feat: access logs archival migration, theme token pipeline, deploy tooling
* 74d5ba2 feat: qr access control dashboard, audit logs, semantic status colors
* b74ba6c feat: highlight + otel observability, inngest background jobs, novu notification infra
*   394941f Merge remote-tracking branch 'origin/master'
|\
| * 7bd3674 Update README.md
* | 80c02b6 feat: pilot-shell workflow integration + session catch-up
* | 9ded620 chore: add vercel deployment config and update lockfile
* | e92758b feat: light-theme migration, department layouts, and AI orchestrator
* | 5e264e6 chore: expand .gitignore for generated and runtime artifacts
* | 1ede69e feat: portal app — AI, departments, plugins, webhooks, and polish
* | 332ffdc feat: packages — theme tokens, UI components, database, errors, and eval
* | 49f0645 docs: wiki updates, entity docs, and project reporting
* | 60f4bfd chore: devops scripts, tools, monitoring, and infrastructure
* | 4e8bede chore: root tooling, CI, and workspace config updates
* | 83121dd chore: update .gitignore for generated artifacts and IDE tools
* | 185a867 chore: set up pro-workflow split memory architecture
* | 830388c Phase 5: multi-agent swarm & advanced autonomy
* | a3d53b2 Phase 4: production hardening, observability & guardrails
* | 21ea2f3 Phase 3: vector memory, multi-agent orchestrator, MCP registry, evaluator-optimizer
* | 3207fa2 Phase 2: safety system, agentic loop, advanced tooling
* | 42cbbc6 fix: update n8n import script to use cookie-based auth
* | 476a00b feat: add n8n startup script
* | e81342d feat: n8n workflow engine integration with Kiro agents + 10 MCP workflow patterns
* | 9fdf3a6 feat: version-control Kiro agent config + wire 12 hook scripts + Agent Teams pattern
* | 8ab70fa feat: excavator activity, shift coverage, AI memory layer, Redis cache, UI animations
* | 2fa2740 chore: add scratch_test.ts with test export
* | a634218 docs: add docs/wiki directory
* | 788518c docs: update wiki index, log, and add docs package manifest
* | 5300825 docs: add remaining wiki query and concept pages
* | 8c667c0 docs: add wiki query templates
* | 18114b0 docs: add architecture decision records (ADRs) for key technical choices
* | f963da1 docs: add ADR, incident response, and onboarding wiki pages
* | 3470356 docs: add deployment and troubleshooting wiki pages
* | 0bc60ad chore: add Claude Code agents, commands, and hooks configuration
* | 800e9cd docs: add and update wiki documentation for AI service, auth, departments, and architecture
* | 6c829d2 chore: update root configs, eval tests, audit logs migration, and deploy script
* | 6a76c95 refactor: update portal department pages, hub layout, overview, and @repo/ui components
* | cf9510f feat: add 3D components, AI service routes, instrumentation, and portal enhancements
* | 582c48e feat: add Payload CMS v3 app with Postgres adapter and admin panel
* | 604182a feat: add @repo/theme package with design tokens, CSS variables, and Tailwind preset
* | 97f923e feat: finish control room, update CLAUDE.md, fix build errors
* | fea9d31 feat: add skills, shared components, DeepEval evaluation suite, and refactor pages
* | 1caf461 docs: add DeepEval integration design spec
* | 93cf498 chore: improve CLAUDE.md docs, fix audit issues, relocate overview app, clean up zips
* | a727cc3 feat: add breakdowns module, productivity tools, middleware auth, and cleanup gitignore
* | b90c1ca feat(monitoring): full standards overhaul — fix tile URLs, GeoJSON layers, velocity charts, AMD risk, stockpile estimator
* | e9d2c8f feat: add Advanced Satellite Monitoring module (SAR/InSAR, Hyperspectral, High-Res)
* | 78d81b6 feat: add AI service, control room tables, engineering notes, excavator activity, hourly loads,
| |         machine operations, operational delays, roll-over modules, weather API, UI components, and portal refactors
* | d42e7ed feat(portal): intro video background with fade-in login
* | e9ffa53 feat(portal): PlayStation wave video background + fix test script
* | ca8531d feat(portal): login aesthetics + rebrand to Arch-Systems
* | d15d766 feat(portal): Phases 6–10 — error boundaries, DB schema, machine CRUD, admin, polish
* | 053bb6a feat(portal): restore auth/hub routes, add Control Room components, remove broken files
* | 114f41b docs(mcp): add Supabase MCP activation notes
* | a7ec7a0 chore(lockfile): normalize pnpm-lock.yaml quote style
* | 95a673f chore(automation): enable plugins, add PreToolUse hooks, fix MCP config
* | 21fba71 chore(automation): add Claude quality gates, design-system reviewer, MCP servers, and initial tests
* | 09de3fe fix(simplify): address code review findings
* | 8073380 fix: address code review — design system, security, monorepo boundaries
* | a3ed72d chore(post-review): clean up deps, lint-staged, and add CLAUDE.md
* | 49bc622 feat(plantcor): full Plantcor OS multi-department portal
* | 4cbc080 Update README.md
|/
* 63c9eef Update README.md
* 2993e44 Update README.md
* b676e25 Update README.md
* 6e17a8f Update README.md
* 1432bf5 Update repository clone instructions in README
* 053242f update license
* 582ffe1 ready to use template
```

## Commit Statistics

- **Total commits in main lineage:** 73
- **Major phases:** 6 (Foundation → 1 → 2 → 3 → 4 → 5 → 5.1)
- **Active branches:** 1 (master)
- **Stale branches:** 2 (fix/fix-bug, worktree-feat-plantcor-os)
- **Commit types:** feat, fix, chore, docs, refactor
- **Primary focus areas:**
  - AI/ML infrastructure (agents, MCP, evaluation)
  - Portal/UI development
  - Monitoring & satellite data
  - Documentation & architecture

## Key Milestones

| Milestone                  | Commit  | Description                                            |
| -------------------------- | ------- | ------------------------------------------------------ |
| **Phase 5.1**              | 011a577 | Rendering performance, adaptive FPS, light-only theme  |
| **Phase 5**                | 830388c | Multi-agent swarm & portal overhaul                    |
| **Phase 4**                | a3d53b2 | Production hardening, observability & guardrails       |
| **Phase 3**                | 21ea2f3 | Vector memory, multi-agent orchestrator, MCP registry  |
| **Phase 2**                | 3207fa2 | Safety system, agentic loop, advanced tooling          |
| **N8N Integration**        | e81342d | Workflow engine with Kiro agents + 10 MCP patterns     |
| **Documentation Overhaul** | 18114b0 | Architecture decision records & comprehensive wiki     |
| **Monitoring Rewrite**     | b90c1ca | Full standards overhaul with velocity charts, AMD risk |
| **Plantcor OS**            | 49bc622 | Multi-department portal foundation                     |
| **Project Init**           | 582ffe1 | Ready-to-use template                                  |

## Branch Status Summary

### Local vs Remote

- **Local master** (011a577): Phase 5.1, latest developments
- **Remote origin/master** (011a577): Synced with local
- **fix/fix-bug** (a3d53b2): Stale, fully merged into master
- **worktree-feat-plantcor-os** (0d0e4a9): Stale, superseded

### Recommended Actions

1. Delete `fix/fix-bug` branch (fully merged into master at a3d53b2)
2. Review and archive/delete `worktree-feat-plantcor-os` (stale)
3. Keep master as the single active branch

## Notes

- The project started from a template (`582ffe1 ready to use template`)
- Rapid feature expansion through Phases 1-3 with major infrastructure additions
- Phases 4-5 added observability, production hardening, and multi-agent orchestration
- Phase 5.1: light-only theme migration and rendering performance optimization
- Origin/master was merged into master at `394941f`; both are now in sync at `011a577`
- Project follows conventional commits pattern (feat:, fix:, chore:, docs:, refactor:)
