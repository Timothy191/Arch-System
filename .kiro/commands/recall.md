---
name: recall
description: Semantic search over project memory using TF-IDF vector search. Search past decisions, patterns, and learnings across all sessions.
---

# /recall

Semantic memory search across LTM events and checkpoints.

## Usage

```
/recall <query> [--top-k <number>]
```

## Examples

```
/recall safety system layers
/recall n8n webhook patterns --top-k 10
/recall how to set up permissions
```

## Implementation

Calls `python3 ltm/bin/vector.py search <query>` using TF-IDF vector similarity.
Results show matching memory entries with relevance scores (0-1).

For re-indexing after adding memory:

```bash
python3 ltm/bin/vector.py index
```
