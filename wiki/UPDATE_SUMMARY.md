# Wiki Update Summary - 2026-06-03 (Nx & Ollama Migration)

## Changes Made — 2026-06-03 10:25 UTC

Refreshed the wiki to document the completed Phase 5.2. This includes migrating build orchestration to Nx and transitioning the AI service to local, offline-capable Ollama models.

### ✅ Files Created (New)

1. **concepts/adr-008-nx-monorepo.md** — Documents the transition from Turborepo to Nx 22 to resolve test runner hangs and enable fine-grained cache rules.
2. **concepts/adr-009-local-ollama-ai.md** — Details the migration of chat/embeddings to local Ollama, introducing intent confidence scoring, 768-dim Nomics vector spaces, and user-isolated database embedding caches.

### ✅ Files Renamed & Updated

1. **concepts/nx-monorepo.md** (Renamed from `concepts/turborepo-monorepo.md`) — Updated to explain the Nx workspace layouts, commands, and target default pipelines.

### ✅ Files Updated

1. **STATUS.md** — Upgraded project status to Phase 5.2. Added details for Local AI execution, Nx pipelines, security hardening, 61 completed migrations, and the stabilized Jest testing gate.
2. **PROJECT_STATUS_SUMMARY.md** — Updated overall score, stats tables, cumulative accomplishments, and priorities.
3. **index.md** — Added new ADR links, renamed concept page reference, and bumped version to Phase 5.2.
4. **entities/arch-systems.md** — Refreshed technology stack, monorepo structure, current metrics, and status narrative.
5. **concepts/database-schema.md** — Updated schema status to cover migrations 017-061 and marked partitioning/views scaling roadmap items complete.
6. **concepts/ai-service.md** — Rewritten to document the local Ollama provider, agent graph state machine, LLM-driven tool dispatch, persistent embedding cache, and tool caching logic.
7. **concepts/adr-003-turborepo-monorepo.md** — Marked as superseded by ADR-008.
8. **concepts/adr-006-multi-provider-ai.md** — Marked as superseded by ADR-009.
9. **comparisons/monorepo-tools.md** — Updated tool dimension analysis and verdict in favor of Nx.
10. **log.md** — Appended activities log Turn.

---

# Wiki Update Summary - 2026-05-17 (Refresh: Recommended Next Steps)

## Changes Made — 2026-05-17 20:50 UTC

Implemented the 5 recommended next steps from `project-comprehensive-report.md` §9 across the entire wiki. Full refresh: 5 new concept pages + 7 existing pages updated.

### ✅ Files Created (New)

1. **concepts/on-premises-deployment.md** — CRITICAL priority. Linux server provisioning, Cockpit setup, Docker Compose deploy, offline/air-gapped update procedure, environment variable reference.

2. **concepts/testing-qa-strategy.md** — HIGH priority. Unit coverage 72%→90%+, E2E critical flows, Storybook visual regression, k6 load testing, OWASP ZAP security scan. Full command reference.

3. **concepts/database-optimization.md** — HIGH priority. Table partitioning (migrations 017–019), PgBouncer connection pooling, read replicas, slow-query optimization via `pg_stat_statements`, materialized views with `pg_cron`.

4. **concepts/mobile-pwa.md** — MEDIUM priority. Responsive layout audit, `next-pwa` service worker, offline write queue, touch-optimized forms, PWA manifest, device testing checklist.

5. **concepts/analytics-reporting.md** — MEDIUM priority. Executive KPI dashboard (`/hub/executive`), PDF/Excel export, n8n scheduled reports, rolling trend analysis + forecasting, data export REST API, ML predictive maintenance (XGBoost).

### ✅ Files Updated

1. **STATUS.md** — Replaced generic next-steps with 5 actionable items (checklists, priorities, estimates, timeline table). Timestamp updated.

2. **index.md** — Page count 54 → 59. Added 5 new quick-reference rows. Added 5 new concept links in correct sections. Added `on-premises-deployment` to Operational Guides.

3. **entities/arch-systems.md** — Added "Phase 4 Roadmap" section: priority table, timeline, current metrics. Updated `updated` timestamp.

4. **concepts/deployment.md** — Added "Method D: On-Premises Server (Cockpit)" with quick-deploy commands and air-gapped update procedure. Added link to new page.

5. **queries/how-to-deploy-production.md** — Added "Method D: On-Premises Linux Server via Cockpit" with 3-step quickstart. Updated related links.

6. **concepts/database-schema.md** — Appended "Scaling & Optimization Roadmap" section covering planned migrations 017–019, PgBouncer, materialized views, read replicas.

7. **UPDATE_SUMMARY.md** — This file (new entry prepended).

---

## Wiki Structure (After Refresh)

```
wiki/
├── index.md                                (131 lines) — Navigation hub
├── STATUS.md                               (~330 lines) — Project status + 5 next steps
├── UPDATE_SUMMARY.md                       (this file) — Change log
├── SCHEMA.md                               — Database schema reference
├── SCHEMA_IMPROVEMENTS.md                  — Schema enhancement history
├── log.md                                  — Activity log
├── concepts/                               (17 pages)
│   ├── on-premises-deployment.md          (NEW) — Server setup & Cockpit
│   ├── testing-qa-strategy.md             (NEW) — QA coverage & tools
│   ├── database-optimization.md           (NEW) — Partitioning & scaling
│   ├── mobile-pwa.md                      (NEW) — PWA + offline
│   ├── analytics-reporting.md             (NEW) — Executive dash + ML
│   ├── deployment.md                      (UPDATED) — +Method D Cockpit
│   ├── database-schema.md                 (UPDATED) — +Scaling roadmap
│   └── ... (12 existing concept pages)
├── entities/                               (9 pages)
│   ├── arch-systems.md                    (UPDATED) — +Phase 4 roadmap
│   └── ... (8 department entity pages)
├── queries/                                (6 pages)
│   ├── how-to-deploy-production.md        (UPDATED) — +Method D
│   └── ... (5 query pages)
├── comparisons/                            (10 pages)
├── gittree/                                (4 pages)
└── raw/, _archive/

Total: 59 pages
```

---

# Wiki Update Summary - 2026-05-17

## Changes Made

### ✅ Files Updated

1. **index.md** — Updated project metadata and navigation
   - Changed version: "1.5.1" → "Phase 3 (Latest)"
   - Updated timestamp: 2026-05-16 → 2026-05-17
   - Added git tree resources to quick reference
   - Updated page count: 49 → 52 pages

2. **SCHEMA_IMPROVEMENTS.md** — Marked all schema work complete
   - Moved completed enhancements from "Future Improvements" to "Completed Issues"
   - Documented all 7 completed schema phases
   - Migration 016_schema_enhancements.sql work fully documented
   - Reorganized remaining work to "Post-Phase 3" sections

3. **log.md** — Added latest activity records
   - [2026-05-17] enhancement: Git tree & graph documentation
   - [2026-05-17] update: Schema improvements completion

### ✅ Files Created (New)

1. **STATUS.md** — Comprehensive project status report (285 lines)
   - Project overview & technology stack
   - All 3 phases marked complete with commit ranges
   - Database schema status with quality scores
   - Documentation coverage (52 pages total)
   - Git repository status
   - Current state & recommended next steps
   - Known limitations & technical debt

2. **gittree/README.md** — Git history visualization (279 lines)
   - Complete git graph from project inception to Phase 3
   - All branches shown (fix/fix-bug, master, worktree-feat-plantcor-os)
   - Branch divergence points documented
   - 55+ commits organized by feature area
   - Key milestones with commit hashes

3. **gittree/visual-graphs-reporting.md** — Data visualization guide (217 lines)
   - Bar & Column Charts for comparisons
   - Line Charts for trend analysis
   - Gantt Charts for timelines
   - Scatter Plots for correlations
   - Heatmaps for density/patterns
   - Implementation recommendations for React 19/Next.js 15

4. **gittree/conceptual-code-graphs.md** — Program analysis (258 lines)
   - Abstract Syntax Trees (ASTs)
   - Control-Flow Graphs (CFGs)
   - Call Graphs
   - Code Property Graphs (CPGs)
   - Practical analysis examples
   - Applications to Arch-Mk2 architecture

5. **gittree/graph-data-structures.md** — Graph algorithms (401 lines)
   - Nodes, edges, and graph properties
   - Adjacency Matrix vs. Adjacency List representations
   - BFS, DFS, Dijkstra, Topological Sort algorithms
   - TypeScript implementation examples
   - Real-world applications in project
   - Performance comparison table

---

## Status Changes

### ✅ Schema: All Complete

**Before:** 7 future improvement items, 3 pending application updates
**After:** 7 items marked COMPLETED (Migrations 010-016)

**Specific Completions:**

- Foreign key indexes → COMPLETED
- updated_at timestamps → COMPLETED
- Native enum types → COMPLETED
- Composite indexes → COMPLETED
- Soft delete pattern → COMPLETED
- Audit trail (created_by) → COMPLETED
- Generated columns → COMPLETED

### ✅ Project Phases: All Complete

**Before:** Phase 3 ongoing, some ambiguity on completion status
**After:** All 3 phases clearly marked COMPLETE

- Phase 1: Foundation (template → login rebrand)
- Phase 2: Enterprise Features (features → Phase 2 marker)
- Phase 3: AI & Orchestration (Phase 2 marker → Phase 3 marker)

### ✅ Documentation: Enhanced

**Before:** 49 pages
**After:** 52 pages (+3 git tree resources)

**New Resources:**

- Git tree history visualization
- Visual graphs for reporting metrics
- Conceptual code graphs for program analysis
- Graph algorithms & data structures

---

## Wiki Structure (Current)

```
wiki/
├── index.md                          (109 lines) — Navigation hub
├── STATUS.md                         (285 lines) — Project completion report
├── log.md                            (219 lines) — Activity log
├── SCHEMA.md                         (540 lines) — Database schema
├── SCHEMA_IMPROVEMENTS.md            (238 lines) — Schema enhancement status
├── gittree/                          (NEW FOLDER)
│   ├── README.md                    (279 lines) — Git history & branches
│   ├── visual-graphs-reporting.md   (217 lines) — Data visualization
│   ├── conceptual-code-graphs.md    (258 lines) — Program analysis
│   └── graph-data-structures.md     (401 lines) — Algorithms & structures
├── concepts/                         (12 pages) — Core architecture
├── entities/                         (9 pages) — Business domains
├── comparisons/                      (10 pages) — Technical decisions
├── queries/                          (6 pages) — FAQ & guides
├── _archive/                         (superseded pages)
└── raw/                              (source materials)

Total: 52 pages, 2,546 lines of documentation
```

---

## Completed Tasks Removed

### From SCHEMA_IMPROVEMENTS.md

✅ **Removed from "Future Improvements" (now complete):**

- [x] Native Enum Types (moved to COMPLETED)
- [x] Composite Indexes (moved to COMPLETED)
- [x] Soft Delete Pattern (moved to COMPLETED)
- [x] Audit Trail (moved to COMPLETED)
- [x] Generated Columns (moved to COMPLETED)

### Marked as Complete

**Status Changes:**

- Migration 010: Schema Optimization → COMPLETED
- Migration 014: Schema Refinement → COMPLETED
- Migration 016: Schema Enhancements → COMPLETED

---

## Quality Metrics

### Documentation Coverage

- Entities: 9/9 (100%)
- Concepts: 12/12 (100%)
- ADRs: 7/7 (100%)
- Operational Guides: 4/4 (100%)
- Comparisons: 10/10 (100%)
- Query Pages: 6/6 (100%)
- Git Resources: 3/3 (100%)

### Code-to-Documentation Ratio

- **Total Wiki:** 2,546 lines
- **Estimated Codebase:** ~15,000 lines (portal + packages + migrations)
- **Ratio:** 1 doc line per ~6 code lines (good coverage)

### Database Schema Coverage

- **Tables Documented:** 25+
- **Columns with Comments:** ~95%
- **RLS Policies:** Comprehensive
- **Migration Status:** 16/16 complete

---

## Recommendations

### Immediate (This Week)

1. ✅ Push local changes to remote (master is 1 commit ahead)
2. ✅ Review schema completion status
3. ✅ Validate git tree visualization accuracy
4. Next: Run full test suite, security audit

### Short-term (Weeks 2-4)

1. Merge or close worktree-feat-plantcor-os
2. Performance testing on Phase 3 features
3. Agent orchestrator stress testing
4. Update CI/CD for new migrations

### Medium-term (Month 2)

1. Consider hourly_loads normalization options
2. Add performance monitoring dashboard
3. Extend MCP patterns catalog
4. Database partitioning strategy

---

## Files to Review

1. **wiki/STATUS.md** — Read for project completion overview
2. **wiki/gittree/README.md** — For git history & branch structure
3. **wiki/SCHEMA_IMPROVEMENTS.md** — For schema completion status
4. **wiki/log.md** — Latest activity record

---

---

## Performance Optimization — 2026-06-01

**Session:** Root-caused and fixed blurry rendering across the entire portal.

### Changes

| File                                              | Change                                                         | Impact                               |
| ------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| `apps/portal/components/SmoothScrollProvider.tsx` | Lenis `duration: 1.2` → `0.6`                                  | Half the scroll animation lag        |
| `apps/portal/components/SmoothScrollProvider.tsx` | Added `visibilitychange` listener to pause rAF when tab hidden | Saves GPU cycles when not visible    |
| `packages/theme/src/css/glass.css`                | `.glass` blur(16px)→blur(10px), saturate(160%)→saturate(130%)  | ~40% cheaper backdrop-filter         |
| `packages/theme/src/css/glass.css`                | `.glass-card` blur(12px)→blur(10px), 130%→120%                 | Consistent with base glass           |
| `packages/theme/src/css/variables.css`            | `--glass-video-backdrop` blur(24px)→blur(16px)                 | Heaviest variant reduced             |
| `packages/theme/src/css/variables.css`            | `--glass-premium-backdrop` blur(24px)→blur(16px)               | Premium surfaces reduced             |
| `apps/portal/hooks/useAdaptivePerformance.ts`     | Fallback threshold 45→50 FPS, window 3s→1.5s                   | Degrades sooner, before user notices |

### Verification

- 51 test suites / 480 tests pass
- Lint: 0 errors
- TypeScript: 0 errors

**Summary:** Wiki has been updated to reflect current project status (Phase 3 complete), schema enhancements finalized, and new resources added for git history visualization and graph-based analysis. All completed tasks have been marked and removed from pending lists. Total documentation now covers 52 pages across all project areas.
