---
title: AI Provider Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [ai, providers, architecture, decision]
sources:
  [
    raw/codebase/ai-service.md,
    apps/portal/package.json,
    wiki/concepts/ai-service.md,
  ]
confidence: high
---

# AI Provider Comparison: Groq vs OpenRouter vs Together AI

## What is Being Compared

Evaluation of three AI inference providers for the portal's multi-provider AI chat service with automatic failover.

## Dimensions of Comparison

| Dimension                | Groq                                         | OpenRouter                                  | Together AI              |
| ------------------------ | -------------------------------------------- | ------------------------------------------- | ------------------------ |
| **Speed**                | Extremely fast (<100ms TTFT) via LPU         | Variable (depends on upstream)              | Moderate                 |
| **Cost**                 | Low per-token pricing                        | Market-rate aggregator                      | Competitive              |
| **Model Variety**        | Limited (Llama, Mixtral, Gemma)              | Broad (100+ models from multiple providers) | Good (open source focus) |
| **API Compatibility**    | OpenAI-compatible                            | OpenAI-compatible                           | OpenAI-compatible        |
| **Rate Limits**          | 30 req/min (free tier)                       | Varies by upstream                          | Generous                 |
| **Streaming**            | Yes                                          | Yes                                         | Yes                      |
| **SDK Support**          | `@ai-sdk/groq`                               | `@openrouter/ai-sdk-provider`               | Native via `ai` SDK      |
| **Failover Reliability** | Primary — fast but occasionally rate-limited | Secondary — broad coverage                  | Tertiary — backup option |

## Project Implementation

The portal uses a **cascading failover** pattern:

```
Request → Groq (primary)
    ↓ (fail/rate-limit)
Request → OpenRouter (secondary)
    ↓ (fail)
Request → Together AI (tertiary)
```

Implementation in `apps/portal/lib/ai/ai-service.ts` uses the `ai` SDK's `generateText` with provider fallthrough logic.

## Verdict

**Multi-provider approach is optimal.** No single provider offers both the speed of Groq and the model variety of OpenRouter. The failover pattern ensures operational continuity for critical mining operations queries (predictive maintenance alerts, safety compliance checks).

- **Groq**: Primary for speed-sensitive operational queries
- **OpenRouter**: Fallback for access to specialized models (Claude, GPT-4)
- **Together AI**: Tertiary for cost-sensitive batch operations

## Related

- [[ai-service]] — Full AI service architecture
- [[portal-app-architecture]] — Where AI service fits in the stack
