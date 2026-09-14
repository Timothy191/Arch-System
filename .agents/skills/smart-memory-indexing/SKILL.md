---
name: smart-memory-indexing
description: Autonomous memory indexing and auto-recall system managing .memory_base/ error retrospectives, knowledge graphs, and codebase insights.
---

# Smart Memory Indexing & Auto-Recall Skill

## Overview

This skill manages the `.memory_base/` system, an immutable knowledge base storing error retrospectives, solution patterns, architectural decisions, and hardware quirks. It provides automated indexing and query capabilities to prevent repeat mistakes across autonomous agent runs.

---

## 1. Directory Structure

```
.memory_base/
├── README.md                  # Index registry and memory summary
├── schema.json                # JSON schema for retrospective entries
├── retrospectives/            # Discrete immutable error retrospectives
│   ├── err-001-*.json
│   └── err-002-*.json
└── index.json                 # Fast lookup index mapped by error signature
```

---

## 2. Procedural Runbook

### Recording a Retrospective

When an agent encounters and resolves an error (e.g. Postgres RLS violation, missing mock, type mismatch):

1. Create a new entry in `.memory_base/retrospectives/err-<timestamp>-<slug>.json`.
2. Format the payload adhering to `schema.json`:
   ```json
   {
     "id": "err-20260914-auth-id-constraint",
     "timestamp": "2026-09-14T11:45:00Z",
     "taskTag": "--task-246",
     "category": "DATABASE_RLS",
     "errorSignature": "null value in column \"auth_id\" violates not-null constraint",
     "affectedFiles": [
       "apps/portal/app/(departments)/access-control/actions/comprehensive-actions.ts"
     ],
     "rootCause": "Direct upsert into public.employees lacked mandatory auth_id field.",
     "resolution": "Updated issuance logic to target public.personnel and public.badges directly.",
     "preventionRule": "Always verify required auth_id fields before querying or inserting into employees table."
   }
   ```
3. Run `node tools/scripts/smart-indexer.cjs` to update `index.json`.

### Auto-Recall Pre-Flight Check

Before modifying code in a specific domain:

1. Run `node tools/scripts/smart-indexer.cjs --query "<domain-or-error>"` to scan for existing retrospectives.
2. Inject matching prevention patterns into the agent's pre-flight reasoning loop.
