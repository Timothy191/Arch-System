# Runtime Validation Requirements

## R1 — Authenticated Load Validation
WHEN the load test submits a valid authenticated shift-closeout request,
THE SYSTEM SHALL process it through the real authentication, contract validation, idempotency and business-logic path.

## R2 — Contract Correctness
WHEN the K6 test constructs a shift-closeout request,
THE REQUEST SHALL conform to the canonical `@repo/contract` schema (`shiftCloseoutPayloadSchema`).

## R3 — Idempotency
WHEN concurrent requests are generated,
THE SYSTEM SHALL apply the application's existing idempotency rules without bypassing them.

## R4 — Runtime Stability
WHEN the configured load is applied,
THE SYSTEM SHALL remain operational without unexpected authentication, validation, database-pool, Redis, or process failures.

## R5 — Measurable Performance
WHEN the load test completes,
THE TEST SHALL produce reproducible latency, throughput and error metrics. 

## R6 — Redis MCP
WHEN the actual Redis MCP runtime is invoked,
THE MCP SHALL communicate with the intended local Redis service (`127.0.0.1:6381`).

## R7 — Firecrawl MCP
WHEN the actual Firecrawl MCP runtime is invoked,
THE MCP SHALL successfully perform a harmless live operation using the existing secure environment configuration.

## R8 — Security
THE SYSTEM SHALL NOT expose credentials in source, specifications, logs or reports.

## R9 — Hardware Classification
THE SYSTEM SHALL distinguish software/mock verification from physical hardware verification.

## R10 — Session Closure
WHEN this engineering session ends,
THE SYSTEM SHALL leave no undocumented background task, temporary test process, unresolved task marked complete, or silently abandoned operation.
