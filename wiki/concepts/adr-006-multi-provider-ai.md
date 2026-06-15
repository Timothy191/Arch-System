---
title: "ADR-006: Multi-Provider AI with Failover"
created: 2026-05-15
updated: 2026-06-03
type: decision
status: superseded
tags: [adr, ai, architecture, decision]
sources: [wiki/comparisons/ai-providers.md, wiki/concepts/ai-service.md]
confidence: high
---

# ADR-006: Multi-Provider AI with Failover

> [!WARNING]
> This decision has been **superseded** by [[adr-009-local-ollama-ai]]. The AI service has transitioned to local Ollama running `gemma4:latest` and `nomic-embed-text` to ensure offline execution capabilities for remote mining locations.

## Status

**Superseded** by [[adr-009-local-ollama-ai]] (June 2026)

## Context

We needed an AI service for:

- Predictive maintenance insights
- Shift handoff summaries
- Safety compliance checking
- Equipment manual Q&A
- Translation for international sites

Requirements:

- High availability (mining operations can't wait)
- Cost efficiency
- Access to multiple model capabilities
- No single-vendor lock-in

## Decision

We will implement a **multi-provider AI service with automatic cascading failover**:

### Provider Priority

1. **Groq** — Primary (fastest, cost-effective)
2. **OpenRouter** — Secondary (broad model access)
3. **Together AI** — Tertiary (backup)

### Architecture

```
User Request
    ↓
Groq API (primary)
    ↓ (timeout / rate limit / error)
OpenRouter API (secondary)
    ↓ (failure)
Together AI API (tertiary)
    ↓
Response to User
```

## Consequences

### Positive

- **High availability** — Automatic failover if provider down
- **Best of each** — Groq for speed, OpenRouter for model variety
- **Cost optimization** — Use cheapest provider that meets needs
- **No vendor lock-in** — Can swap providers without code changes
- **Rate limit handling** — Automatic fallback when limits hit

### Negative

- **Complexity** — More code than single provider
- **Testing overhead** — Must test each provider
- **Latency variability** — Different providers have different speeds
- **API key management** — Multiple keys to secure

### Neutral

- **Cost tracking** — More complex but doable with usage metrics

## Implementation Details

```typescript
// apps/portal/lib/ai/ai-service.ts
const providers = [
  { name: "groq", client: groqClient, timeout: 5000 },
  { name: "openrouter", client: openRouterClient, timeout: 10000 },
  { name: "together", client: togetherClient, timeout: 15000 },
];

export async function generateWithFailover(prompt: string) {
  for (const provider of providers) {
    try {
      return await withTimeout(
        provider.client.generate(prompt),
        provider.timeout,
      );
    } catch (err) {
      console.warn(`${provider.name} failed, trying next...`);
      continue;
    }
  }
  throw new Error("All AI providers failed");
}
```

### Prompt Templates

Standardized prompts for operational contexts:

- `predictiveMaintenance` — Equipment health predictions
- `shiftHandoff` — Shift change summaries
- `safetyCompliance` — Regulation checking
- `equipmentManual` — Technical Q&A
- `translate` — Multi-language support

## Alternatives Considered

### Single Provider (OpenAI GPT-4) (REJECTED)

- Single point of failure
- Rate limits would block operations
- No failover if outage occurs
- Higher cost at scale

### Self-Hosted LLM (Llama via vLLM) (REJECTED)

- High infrastructure cost
- DevOps burden for GPU management
- Slower than API providers
- Would consider for air-gapped environments

### Azure OpenAI (REJECTED)

- Good enterprise option but
- Higher latency than Groq
- Less model variety than OpenRouter
- Vendor lock-in to Microsoft

## Monitoring

Track per-provider:

- Request count
- Success/failure rate
- Average response time
- Cost per 1K tokens
- Error types

## Related

- [[comparisons/ai-providers]] — Detailed comparison
- [[ai-service]] — Full service architecture
- [[monitoring-error-tracking]] — Observability
