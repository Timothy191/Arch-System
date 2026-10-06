# Offline Mutation Writes

## Requirements

### Requirement: Authenticated Department-Scoped Writes

The system SHALL accept an offline mutation batch only from an authenticated
employee with a department and a write-capable role. The HTTP endpoint SHALL
derive the tenant from the authenticated employee's primary department and
SHALL NOT accept a caller-selected tenant.

#### Scenario: unauthenticated request

- **WHEN** a request has no valid authenticated user
- **THEN** the endpoint returns HTTP 401 and does not call the mutation RPC

#### Scenario: employee record or primary department is missing

- **WHEN** the user has no employee record or no primary department
- **THEN** the endpoint returns HTTP 403 and does not call the mutation RPC

#### Scenario: viewer attempts to write

- **WHEN** the authenticated employee has the viewer role
- **THEN** the endpoint returns HTTP 403 and does not call the mutation RPC

#### Scenario: cross-department RPC invocation

- **WHEN** an authenticated non-admin invokes the RPC for a department that
  is neither the employee's primary nor accessible department
- **THEN** PostgreSQL rejects the call with insufficient privilege

### Requirement: Bounded, Validated Batches

The system SHALL accept only non-empty batches of at most 500 supported SMR
mutations. Clock values SHALL be non-negative integers, readings SHALL be
finite and non-negative, and identifiers SHALL be bounded non-empty strings.
Invalid or oversized batches SHALL be rejected without partial persistence.

#### Scenario: oversized or malformed batch

- **WHEN** a batch has more than 500 records or an invalid mutation field
- **THEN** validation rejects the complete request before the RPC is called

#### Scenario: duplicate replay

- **WHEN** the same mutation ID is replayed for the same department
- **THEN** the mutation log and SMR append-only store do not gain duplicate
  rows

### Requirement: Hardened Database RPC

The mutation RPC SHALL independently validate caller identity and department
authorization, use schema-qualified database objects with an empty search
path, and SHALL NOT be executable by `PUBLIC` or `anon`.

#### Scenario: direct anonymous execution

- **WHEN** a caller without an authenticated employee invokes the RPC
- **THEN** PostgreSQL rejects execution or the function rejects the caller

#### Scenario: request failure

- **WHEN** any mutation fails validation or persistence
- **THEN** the database rolls back all writes from that batch

### Requirement: Retryable Shift-Closeout SMR Persistence

The shift-closeout endpoint SHALL persist allocation SMR readings with
deterministic mutation IDs derived from the committed report and allocation.
If the SMR RPC fails after the closeout is committed, the endpoint SHALL return
a retryable HTTP response, and retrying with the same idempotency key and
payload SHALL reattempt the SMR write without creating duplicate readings.

#### Scenario: SMR persistence fails after closeout

- **WHEN** the closeout transaction succeeds but the SMR mutation RPC fails
- **THEN** the endpoint returns HTTP 503 with a retry instruction and does not
  report full success

#### Scenario: retry replays a committed closeout

- **WHEN** the caller retries the same closeout after an SMR failure
- **THEN** the route unwraps the stored closeout response and reuses the same
  SMR mutation IDs
