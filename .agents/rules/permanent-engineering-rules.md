---
name: permanent-engineering-rules
description: Permanent repository-level engineering rules for production reality, security, data ownership, Redis, PostgreSQL, API, reliability, testing, observability, Git, deployment, and agent behavior.
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.js'
  - '**/*.cjs'
  - '**/*.mjs'
  - '**/*.json'
  - '**/*.yaml'
  - '**/*.yml'
---

# Arch-System Permanent Engineering Rules

These rules apply to every future coding agent working on `Timothy191/Arch-System`.

---

## 1. Production Reality

Treat this repository as a real operational business system.

Never use:

- fake production data
- placeholder security
- mocked infrastructure presented as production
- invented performance measurements
- fabricated deployment results
- fabricated test results

If something has not been verified, say:

```text
UNVERIFIED
```

---

## 2. Evidence First

Before changing architecture:

```text
inspect
→ understand
→ verify
→ compare against established practice
→ change
→ test
→ verify again
```

Never redesign based solely on assumptions.

---

## 3. Minimal Necessary Change

Prefer:

```text
smallest correct change
```

over:

```text
largest possible refactor
```

Do not rewrite working components simply because another implementation looks cleaner.

---

## 4. Security by Default

Every API must be evaluated for:

- authentication
- authorization
- validation
- rate limiting
- input handling
- error leakage
- secret handling
- auditability

UI visibility is never considered authorization.

Authorization must be enforced server-side.

---

## 5. Data Ownership

Every data store must have a clearly defined purpose.

Classify data as:

```text
SOURCE OF TRUTH
CACHE
DERIVED
TEMPORARY
QUEUE
TELEMETRY
AUDIT
```

Do not silently make a cache the source of truth.

---

## 6. Permanent Redis Rules

Redis usage must follow these rules unless a documented architecture decision explicitly overrides them.

### Connections

Prefer shared/reused Redis clients.

Do not create a new Redis connection per HTTP request unless there is a documented reason.

### Timeouts

Network operations must have bounded failure behavior.

Avoid requests that can hang indefinitely.

### Retries

Retries must be:

```text
bounded
observable
appropriate to the operation
```

Never create infinite retry loops.

### Keys

Use predictable namespaces.

Example:

```text
plantcor:telemetry:<site>:<asset>:<metric>
plantcor:session:<id>
plantcor:rate-limit:<identity>
```

Adapt the actual naming scheme to the application.

### TTL

Temporary/cache data must have an intentional TTL unless there is a documented reason not to.

Never allow accidental unbounded growth.

### Memory

Redis data must have an expected size and lifecycle.

Watch for:

- large keys
- hot keys
- unbounded lists
- unbounded sets
- unbounded streams
- unbounded telemetry history

### Failure

Every Redis-dependent feature must define what happens when Redis is unavailable.

Possible behavior:

```text
fail closed
fail open
serve stale cache
degrade gracefully
retry
return controlled error
```

Choose deliberately.

### Source of Truth

Do not store business-critical information only in Redis without an explicit durability architecture.

### Observability

Important Redis operations should be observable through appropriate metrics/logging.

---

## 7. PostgreSQL Rules

PostgreSQL is the preferred durable source of truth for business data unless an architecture decision states otherwise.

Use:

- constraints
- indexes
- transactions
- migrations
- appropriate isolation
- parameterized queries
- connection pooling

Do not use Redis to compensate for an incorrectly designed database.

---

## 8. API Rules

Every API route must have:

```text
input validation
authentication where required
authorization where required
controlled errors
bounded execution
appropriate logging
```

Never expose stack traces, secrets, credentials, or internal infrastructure details to clients.

---

## 9. Reliability Rules

External dependencies must have controlled failure behavior.

Avoid:

```text
infinite retry
unbounded queue
unbounded memory
unbounded request size
unbounded cache
unbounded log generation
```

Prefer explicit:

```text
timeouts
retry limits
backoff
idempotency
graceful degradation
health checks
```

---

## 10. Testing Rules

Tests must verify behavior, not merely implementation details.

For important infrastructure integrations, test:

```text
success
empty state
invalid input
dependency failure
timeout/failure path
authorization
```

Never weaken or delete a test merely because it exposes a real defect.

A tooling error is not an application failure.

For Jest diagnostics, invoke Jest correctly through the workspace.

Example:

```bash
pnpm --filter portal exec jest \
  --runInBand \
  --detectOpenHandles \
  <test-file>
```

---

## 11. SCADA / Telemetry Rules

SCADA and telemetry data must be treated as operational data.

Explicitly consider:

```text
freshness
staleness
source
timestamp
availability
typing
failure
security
auditability
```

Never present stale telemetry as current without an appropriate indication.

---

## 12. Observability Rules

Production-critical functionality should provide enough telemetry to answer:

```text
What failed?
When?
For whom?
Where?
How often?
What dependency failed?
What happened immediately before it?
```

Do not add meaningless metrics merely to increase metric count.

---

## 13. Git Rules

Never:

```text
force push
rewrite history
delete branches
discard user changes
reset --hard
clean untracked user files
```

without explicit approval.

Always inspect:

```bash
git status
git diff
```

before destructive operations.

---

## 14. Deployment Rules

The canonical production deployment for this repository is:

```text
Timothy191/Arch-System
        ↓
Vercel
        ↓
arch-system
        ↓
apps/portal
```

Do not create duplicate deployment projects unless there is a documented architectural requirement.

---

## 15. Destructive Action Rule

No destructive action may be inferred from general instructions.

Explicit approval is required immediately before:

```text
delete
drop
truncate
destroy
force push
history rewrite
production reset
credential removal
DNS changes
production infrastructure deletion
```

Approval applies only to the specific action disclosed.

---

## 16. Research Rule

When a task asks for:

```text
best practice
professional practice
production standard
current recommendation
security standard
Redis recommendation
framework recommendation
```

research current authoritative sources before changing architecture.

Prefer primary sources.

Do not treat a random blog post as authoritative when official documentation is available.

---

## 17. Change Management

For significant changes:

```text
audit
→ document finding
→ identify options
→ select justified approach
→ implement
→ test
→ verify
```

Record significant architectural decisions.

---

## 18. Completion Rule

Never say:

```text
complete
production ready
fixed
verified
deployed
secure
```

unless the relevant evidence has actually been checked.

A successful local build does not prove production deployment success.

A passing unit test does not prove integration correctness.

A successful deployment does not prove operational readiness.

Always distinguish:

```text
VERIFIED
PARTIALLY VERIFIED
UNVERIFIED
BLOCKED
```

---

## 19. Agent Behavior

Future agents should act as senior engineers, not code generators.

They should:

- inspect before modifying
- preserve existing functionality
- challenge unnecessary complexity
- identify real risks
- research when appropriate
- test failure paths
- explain tradeoffs
- protect production data
- request approval for destructive actions
- verify their own work

The objective is a maintainable, secure, observable, resilient real-world system.
