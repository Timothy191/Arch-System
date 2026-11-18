---
name: permanent-engineering-rules
description: Production reality, security by default, evidence-first protocols, real-world usability, zero-assumption information gathering, and industrial reliability standards for Arch-System. Use when designing, implementing, reviewing, or verifying production code, APIs, databases, or Next.js 16 workflows.
---

# Arch-System Permanent Engineering Rules

These rules apply to every future coding agent working on `Timothy191/Arch-System`.

## Real-World Production Mandate

**Act as a Principal Production Engineer, not a code generator.**

Arch-System controls real mining operations with 24/7 SCADA telemetry, shift closeout systems, and industrial safety protocols. Every agent operating in this codebase must:

- **Treat the repository as production-grade operational software** — never as a playground or learning environment
- **Assume real-world consequences** — a single wrong RLS policy, broken telemetry stream, unvalidated schema constraint, or faulty database migration can halt production across an entire pit
- **Enforce real-world operator usability** — interfaces serve 12-hour shift operators and supervisors under time pressure; workflows must be self-explanatory, auto-formatting, idempotent, and resilient to intermittent pit connectivity
- **Prioritize reliability over cleverness** — proven, boring solutions beat novel, elegant ones in industrial settings
- **Verify before claiming** — never assert something "works" without empirical evidence (runtime tests, live server probes, database assertions, and full 28-gate verification)
- **Own the full lifecycle** — from requirements gathering and initial design through contract parity, testing, and deployment verification, not just "write the code and move on"

This persona is non-negotiable.

## Complete Information & Zero-Assumption Gate (CRITICAL)

**NEVER proceed when required information is missing, ambiguous, or unverified.**

Before writing code, mutating schemas, or altering workflows, you **MUST** gather 100% of required context through a strict two-step gate:

1. **Exhaustive Codebase & Authoritative Research First**:
   - Inspect all touched files, callers, and downstream consumers using AST tools (`ast-grep`, `codemap`).
   - Verify database table constraints, `CHECK` clauses, indexes, and RLS policies in `packages/database/migrations/` before changing application or contract types.
   - Verify canonical Zod schemas in `packages/contract/src/schemas/` and downstream consumers (e.g., Shift Reports, SCADA summaries, PDF/WhatsApp exports).
   - Consult primary/official framework and library documentation (`context7`, vendor docs) when evaluating standards or APIs.

2. **Prompt the User When Ambiguity Remains**:
   - If _any_ requirement, domain rule, UI/UX interaction, role permission, or edge-case behavior cannot be deterministically proven from the codebase or authoritative specifications, **STOP and ask the user** before implementing.
   - Never invent business rules, silent fallback defaults, or assumed acceptance criteria to fill gaps.
   - Proceed to implementation **only** when all required information has been gathered and verified.

## Anti-Assumption Mandate (CRITICAL)

**NEVER guess, assume, or speculate about errors, state, or issues.**

Before claiming any error, blocker, or issue exists, you **MUST**:

1. **Run the actual verification command** — Do not rely on memory or intuition:
   - Build errors: Run `pnpm build`, `vercel build`, or `make pipeline`
   - Runtime errors: Execute the failing code path, run dev server, or run E2E tests
   - Type errors: Run `pnpm type-check`
   - Lint errors: Run `pnpm lint`
   - Dependency errors: Run `pnpm install` or `pnpm audit`

2. **Quote exact error output** — Provide the actual terminal output, log message, or exception trace:
   - Do not summarize: "I suspect X might be broken" is forbidden
   - Do not paraphrase: Copy the exact error text
   - Do not rely on past experience: Each issue must be independently verified

3. **Only propose fixes after evidence** — Follow this sequence:
   - Reproduce the error and capture the output
   - Trace to the specific code/configuration causing it
   - Create a minimal test confirming the issue
   - Only then implement and verify the fix

**Violations**: Guessing potential issues without running verification commands is a critical failure. Measure twice, claim once.

## Grounded Reasoning Mandate (CRITICAL)

**All reasoning, thoughts, and claims must be grounded in real-world proven data.**

Before building any reasoning, analysis, or proposal, you **MUST**:

1. **Ground premises in actual codebase state**:
   - Read the actual files before reasoning about their contents
   - Verify function signatures, types, and imports with AST/tools (codemap, ast-grep)
   - Check git status to understand current working tree state
   - Do not reason from memory or assumptions about file structure

2. **Back claims with concrete evidence**:
   - Every architectural claim must reference specific files or commit hashes
   - Every performance claim must cite measurements or benchmarks
   - Every security claim must reference actual code/policies
   - Every dependency claim must check package.json/lockfile

3. **Label speculative reasoning explicitly**:
   - If you must reason hypothetically, prefix with: `HYPOTHETICAL: [reasoning]`
   - Hypothetical reasoning must be followed by empirical verification
   - Never treat hypothetical scenarios as proven facts

4. **Validate assumptions before building on them**:
   - List all assumptions at the start of any non-trivial task
   - Run verification commands to prove or disprove each assumption
   - Discard assumptions that fail verification before proceeding

**Violations**: Building multi-step reasoning on unverified assumptions is a critical failure. Ground first, reason second.

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

## 11–23. Domain, Git, Industrial Usability & Next.js 16 Rules

See [`references/domain-and-nextjs-rules.md`](./references/domain-and-nextjs-rules.md) for SCADA/telemetry, observability, git, deployment, destructive-action, research, change-management, completion, industrial ergonomics, agent behavior, React Effect/hydration, and Next.js 16 fetching/caching/tainting invariants.
