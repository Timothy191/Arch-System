# Auto-Recall System Plan

## Goal
Build automatic memory retrieval that suggests relevant past context when starting new tasks.

## Phase 1: Core Infrastructure

### 1.1 Session Index Enhancement
- Extend `index.jsonl` schema with `embedding_vector` field (optional JSON array)
- Add `embedding_model` and `embedding_date` metadata
- Keep backward compatible — vectors are optional

### 1.2 Embedding Generation
Create `scripts/memory/generate-embeddings.py`:
```python
# Uses sentence-transformers or cached local model
# Reads sessions/*.md → generates embeddings → updates index.jsonl
# Run: pnpm memory:embed (or python3 directly)
```

### 1.3 Semantic Search Engine
Create `scripts/memory/semantic-search.py`:
```python
# Inputs: query string
# Outputs: ranked session matches from index.jsonl
# Usage: stdin/stdout for agent consumption
```

## Phase 2: Integration Points

### 2.1 Hook Integration
Add to `.cursor/hooks.json`:
```json
{
  "sessionStart": {
    "script": "scripts/memory/hooks/auto-recall.sh",
    "role": "Generate recall suggestions on new chat"
  }
}
```

### 2.2 Auto-Recall Script
Create `scripts/memory/hooks/auto-recall.sh`:
- Reads last 2 commits from user's branch
- Runs semantic search on recent topics
- Writes `.memory/.recall-suggestions.md`
- Parent agent reads suggestions on next turn

### 2.3 Query Expansion
On `/compact` operations:
- Extract key entities (component names, file paths, decisions)
- Add to `tags` array in index.jsonl
- Enable regex + semantic hybrid search

## Phase 3: Recall Optimization

### 3.1 Progressive Disclosure
- Load only top-3 matches initially
- Background fetch full context on demand
- Follow existing `PROGRESSIVE_DISCLOSURE.md` pattern

### 3.2 Confidence Scoring
Combine:
- Semantic similarity (0-1)
- Recency decay (newer = higher weight)
- Tag overlap boost
- Explicit references (file paths, IDs) extra weight

### 3.3 Lending Library Pattern
Add skill to catalog:
```json
{
  "auto-recall": {
    "type": "local",
    "search": "auto-recall",
    "description": "Semantic memory retrieval for context suggestions"
  }
}
```

## Phase 4: Implementation Sequence

| Step | File | Action |
|------|------|--------|
| 1 | `scripts/memory/generate-embeddings.py` | Basic embedding generation |
| 2 | `scripts/memory/semantic-search.py` | Search API |
| 3 | `.cursor/hooks.json` | Add sessionStart hook |
| 4 | `scripts/memory/hooks/auto-recall.sh` | Hook script |
| 5 | `.memory/index-schema.json` | Extended schema |
| 6 | `scripts/lending-library/catalog.json` | Add auto-recall skill |

## Constraints (from MEMORY.md)
- No RAG/vector DB scaffolding
- Search, don't index (use existing `.memory/` structure)
- Offline-first compatible
- Gitignored ephemeral files in `.memory/`