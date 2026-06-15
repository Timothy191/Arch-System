---
title: "ADR-009: Local Ollama for AI Service"
created: 2026-06-03
updated: 2026-06-03
type: decision
status: accepted
tags: [adr, ai, architecture, decision]
sources: [apps/portal/lib/ai/, wiki/concepts/ai-service.md]
confidence: high
---

# ADR-009: Local Ollama for AI Service

## Status

**Accepted** — Implemented June 2026

## Context

Previously, the AI service relied on external API providers (Groq, OpenRouter, Together AI) as outlined in [[adr-006-multi-provider-ai]]. While this was initially flexible, several critical issues arose:

- **Offline / Air-Gapped Readiness**: Mining operations are often deployed in remote areas with poor or intermittent internet access. Relying on external APIs made the AI helper useless when offline.
- **Latency and Rate Limits**: External APIs introduced variable response times and rate-limiting thresholds that disrupted portal usability.
- **Vector Dimension Overhead**: Using OpenAI's 1536-dimensional embeddings for memory search increased database storage and retrieval costs.
- **Inaccurate Tool Dispatching**: Keyword/regex-based tool dispatching in the Kiro orchestrator was brittle, prone to false matches, and did not evaluate query intent correctly.

## Decision

We will migrate the AI service to run **locally via Ollama**, eliminating cloud dependencies and optimizing the orchestration pipeline.

### Key Components of this Decision

1. **Ollama Integration**: Run `gemma4:latest` locally for chat generation and `nomic-embed-text` for embeddings via direct fetch calls to `http://localhost:11434`.
2. **LLM-Driven Tool Dispatch**: Replace regex-based matching with proper LLM reasoning. Implement a confidence score (1-5 scale) using a two-tier approach (native tool calling first, JSON fallback second). Dispatches with confidence < 3 trigger a request for user clarification.
3. **Optimized Vector Dimensions**: Migrate the database embeddings from 1536 dimensions (OpenAI) to 768 dimensions (`nomic-embed-text`) in migration 058.
4. **Persistent Embedding Cache**: Create a database table (`embedding_cache`) mapping SHA-256 text hashes to 768-dim embeddings, isolating entries by user_id to prevent redundant computation.
5. **Tool Output Caching**: Introduce an in-memory LRU cache with a 5-second TTL in `tool-cache.ts` to deduplicate identical tool calls during a session.
6. **Simplified Memory Structure**: Drop the `procedural` memory type (migration 061) and consolidate instructions into `semantic` memory, leaving only `episodic` and `semantic` memory types.

## Consequences

### Positive

- **100% Offline Capability**: The portal's AI helper can function entirely in air-gapped site deployments.
- **Improved Security & Privacy**: Data never leaves the local network or server.
- **Higher Tool Dispatch Accuracy**: LLM-driven dispatch accurately determines if a query needs tool-supplied context (e.g. drilling status, breakdowns) and formats inputs properly.
- **Reduced Computational Load**: The persistent embedding cache and tool result cache eliminate redundant LLM and DB work.
- **Lower Latency**: Hard limits and local execution bypass WAN delays.

### Negative

- **Resource Demands**: The hosting server must have sufficient CPU/GPU capacity to run the local Ollama models.
- **Model Size Constraints**: Local models (like Gemma 4) have smaller parameter sizes compared to cloud models, requiring highly optimized prompts.

## Related

- [[ai-service]] — Updated AI architecture page
- [[adr-006-multi-provider-ai]] — Superseded decision record
- [[comparisons/ai-providers]] — Updated provider comparison
