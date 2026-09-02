---
title: "Requirements Plan: Adaptive Probabilistic Early Expiration (X-Fetch) for Redis Cache"
date: "2026-08-31"
artifact_contract: "ce-unified-plan/v1"
artifact_readiness: "implementation-ready"
execution: "knowledge-work"
---

# Unified Product & Requirements Plan: Adaptive Probabilistic Early Expiration (X-Fetch)

## Executive Summary
This requirements plan details the product scope, operational behavioral boundaries, and performance invariants for implementing the **X-Fetch (Probabilistic Early Expiration)** algorithm within `@repo/redis` (`packages/redis/src/cache.ts`).

During shift changes (06:00, 14:00, 22:00 SAST), hundreds of mining operators simultaneously access portal dashboards. When cached shift handover keys reach hard TTL expiration, traditional cache miss patterns cause thundering herd surges on PostgreSQL. X-Fetch calculates a probabilistic early recomputation trigger prior to hard key expiration, ensuring high-concurrency keys are refreshed asynchronously in the background with zero operator latency spikes.

---

## 1. Goal Capsule & Product Vision

- **Primary Product Goal**: Eliminate cache stampede spikes during high-concurrency shift changes by probabilistically refreshing keys in the background before hard TTL expiration.
- **Success Criteria**:
  - **Zero Shift-Change Latency Spikes**: 0% latency degradation ($P_{99} < 15\text{ ms}$) on shift-handover operational queries.
  - **Deterministic Background Recomputation**: At most 1 single-flight background recomputation triggered per key in the X-Fetch window.
  - **Fallback Safety**: Fallback gracefully to standard single-flight `cacheWrap` if Redis or background worker loops encounter errors.

---

## 2. Product Contract & Behavioral Boundaries

### Operational Behavior
1. **X-Fetch Probability Formula**:
   $$\text{Trigger Condition: } -\beta \times \delta \times \ln(\text{random}()) > \text{TTL}_{\text{remaining}}$$
   - $\beta > 0$: Aggressiveness factor (default $\beta = 1.0$).
   - $\delta$: Measured computation duration of `fn()` in milliseconds.
   - $\text{TTL}_{\text{remaining}}$: Remaining time-to-live of the cached entry in milliseconds.
2. **Metadata Wrapping**:
   - Cache values must encapsulate payload metadata: `{ value: T, ttl: number, delta: number, computedAt: number }`.
3. **Coalesced Background Execution**:
   - When early expiration triggers on a read hit, return the currently cached value immediately to the caller, while triggering an asynchronous `cacheWrap` background recomputation.
   - Single-flight deduplication (`activeFetches`) ensures only 1 background refresh process runs per key.

### Out of Scope (Non-Goals)
- Hard real-time streaming telemetry modifications (SCADA telemetry feeds remain on binary/WebSocket protocols).
- Global distributed lock negotiation across multi-region Redis instances (handled locally via single-flight per instance).

---

## 3. Verification & Compliance Contract

- **Unit Test Verification**: Assert 100 concurrent requests within the X-Fetch window return cached data in $< 5\text{ ms}$ while triggering `fn()` exactly once in the background.
- **Prometheus Metrics**: Expose `redis_cache_xfetch_triggers_total` and `redis_cache_xfetch_latency_ms` metrics in `/api/metrics/prometheus`.
- **Quality Gate Compliance**: `pnpm quality` and `pnpm audit:compliance` must pass with 100% compliance.

---

## 4. Implementation Units

### Unit 1: X-Fetch Wrapper Types and Math Utilities
**Target**: `packages/redis/src/cache.ts`
- Define `XFetchWrapper<T>` interface: `{ value: T, ttl: number, delta: number, computedAt: number }`.
- Implement `shouldEarlyExpire(wrapper: XFetchWrapper<any>, beta?: number): boolean`.
  - Calculate `ttlRemaining = (wrapper.computedAt + wrapper.ttl * 1000) - Date.now()`.
  - Trigger if `-(beta ?? 1.0) * wrapper.delta * Math.log(Math.random()) > ttlRemaining`.

### Unit 2: Core Cache Update (`cacheWrap` & `cacheGet`)
**Target**: `packages/redis/src/cache.ts`
- Update `cacheWrap` to intercept hits. If a hit is found, parse it as `XFetchWrapper`.
- Check `shouldEarlyExpire`. If true and no active background fetch exists for the key (check `activeFetches.has(key)`):
  - Launch `fn()` in the background (wrap in `activeFetches.set`).
  - Measure `delta = performance.now() - start` inside `fn()`.
  - Update cache with new `XFetchWrapper` containing the new `delta`.
  - Return the *stale* value immediately to the caller.
- If it's a miss, run `fn()`, measure `delta`, and store as `XFetchWrapper`.
- Update `cacheGet` to unwrap `XFetchWrapper.value` before returning, so downstream consumers are oblivious to the wrapper. (Note: memory cache will also store the wrapper to preserve `computedAt` and `delta`).

### Unit 3: Prometheus Metrics Integration
**Target**: `packages/redis/src/stats.ts`
- Add stats recording in `packages/redis/src/stats.ts`: `recordXFetchTrigger(latencyMs)`.
- Fire `recordXFetchTrigger` when early expiration triggers.

## 5. Test Scenarios

**Feature-bearing unit tests (`packages/redis/tests/cache.test.ts`):**
1. **Standard Miss & Set**: Calling `cacheWrap` on an empty key executes `fn()`, measures `delta`, and stores the `XFetchWrapper` correctly.
2. **Early Expiration Triggered (Stale Return)**: Mock `Math.random()` to return a value close to 0 (triggering early expiration). Verify `cacheWrap` returns the stale value immediately ($< 5\text{ ms}$) AND initiates a background `fn()` call.
3. **Single-Flight Coalescing**: Trigger early expiration with 100 concurrent `cacheWrap` calls. Verify `fn()` is only executed exactly once in the background.
4. **Early Expiration Not Triggered**: Mock `Math.random()` to return 0.99. Verify `cacheWrap` returns the cached value without triggering a background refresh.

## 6. Assumptions and Open Questions
- **Assumption**: A default $\beta = 1.0$ provides a good balance between background load and stampede prevention.
- **Assumption**: Error handling inside the background refresh will silently fail and clean up `activeFetches`, allowing a subsequent request to retry the background refresh.
