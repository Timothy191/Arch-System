---
title: AI Service
created: 2026-05-15
updated: 2026-06-03
type: concept
tags: [system, api, integration, concept]
sources: [apps/portal/lib/ai/]
confidence: high
---

# AI Service

The portal features a fully local AI service orchestrated via an explicit state machine (Agent Graph), utilizing a locally running Ollama server for chat completion and embedding generation. This ensures 100% offline capability for remote mining sites.

## Core Files & Responsibility

The AI layer is located in [apps/portal/lib/ai/](file:///home/timothy/Project/Arch-Mk2/apps/portal/lib/ai/):

| File               | Responsibility                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ollama.ts`        | Simple fetch client to local Ollama (`/api/chat`, `/api/embed`) with hard timeouts.                                                                            |
| `providers.ts`     | Conveniences for chat completion, streaming, and embedding queries.                                                                                            |
| `agent-graph.ts`   | Explicit state machine nodes routing requests (auth → rateLimit → resolveContext → loadMemory → gatherContext → executeTools → callLLM → output → saveMemory). |
| `agent-state.ts`   | Workspace state structure and reducers.                                                                                                                        |
| `tool-dispatch.ts` | LLM-driven tool dispatch with confidence scoring and JSON fallback.                                                                                            |
| `tool-cache.ts`    | LRU-based tool output cache with 5s TTL to prevent redundant database hits.                                                                                    |
| `cost-tracker.ts`  | Tracks local token consumption and records stats.                                                                                                              |
| `rate-limiter.ts`  | IP and category-based rate limiting.                                                                                                                           |
| `memory.ts`        | Vector memory management (episodic & semantic storage).                                                                                                        |
| `tools.ts`         | Zod-typed schemas for mining/operational tools.                                                                                                                |
| `prompts.ts`       | System prompts and templates (including tool dispatch rules).                                                                                                  |

## Local AI Provider

All calls route to the local Ollama endpoint (`http://localhost:11434` or as configured by `OLLAMA_URL`):

- **Chat Model**: `gemma4:latest` (or `DEFAULT_MODEL`)
- **Embedding Model**: `nomic-embed-text` (generates 768-dimension vectors)
- **Timeouts**: Configurable via `OLLAMA_TIMEOUT_MS` (default `30s`) to prevent hanging in serverless environments.

## Agent Graph State Machine

The AI request cycle runs through a strict state machine implemented in [agent-graph.ts](file:///home/timothy/Project/Arch-Mk2/apps/portal/lib/ai/agent-graph.ts):

```
authenticate ➔ rateLimit ➔ resolveContext ➔ loadMemory ➔ gatherContext ➔ executeTools ➔ callLLM ➔ output ➔ saveMemory
```

1. **authenticate**: Verifies the Supabase JWT.
2. **rateLimit**: Enforces sliding/fixed-window limits.
3. **resolveContext**: Resolves the target department name and UUID.
4. **loadMemory**: Retrieves user episodic memory (past chats) and semantic memory (facts).
5. **gatherContext**: Uses LLM-driven tool dispatch to decide which tool to call with a confidence score.
6. **executeTools**: Invokes the chosen tool (uses `tool-cache` to check for cached results).
7. **callLLM**: Generates the streamed response from Ollama (with automatic backoff retry on transient errors).
8. **output**: Streams chunks back to the client and sets headers for serverless handshakes.
9. **saveMemory**: Stores the new conversation turn back into episodic memory.

## LLM-Driven Tool Dispatch

The service replaces old regex keyword matching with an LLM-driven decision process:

- **Two-tier Approach**: Uses Ollama's native tool-calling API first. If unsupported/fails, it queries the model for a JSON block defining `tool`, `args`, `confidence`, and `reason`.
- **Confidence Scoring**: 1 to 5 scale. If confidence is 1–2, the tool does not fire, and the graph routes to a clarifying flow to ask the user for details. If confidence is 3–5, the tool executes.
- **Available Tools**:
  - `machineStatus`: Queries machine inventory and statuses for a department.
  - `shiftLogs`: Fetch `daily_logs` context.
  - `delays`: Retrieves `operational_delays`.

## Memory & Embedding Cache System

- **Vector Memory (pgvector)**:
  - Stored in the `memories` table with a 768-dimension HNSW index.
  - **Memory Types**: Consolidated into `episodic` (chat session turns) and `semantic` (facts/configurations). The old `procedural` type has been dropped (migration 061) and merged into semantic.
- **Embedding Cache**:
  - Located in the `embedding_cache` table.
  - Caches 768-dimension vector embeddings generated from `nomic-embed-text`, keyed by the SHA-256 hash of the text.
  - Isolated by `user_id` for data security and privacy.
  - Significantly reduces local CPU/GPU consumption by bypassing Ollama embeddings for repetitive query phrases.

## Related

- [[nx-monorepo]] — How packages like `@repo/rate-limiter` are structured
- [[database-schema]] — Embeddings, memories, and embedding_cache tables
- [[adr-009-local-ollama-ai]] — Architecture Decision Record for local Ollama
