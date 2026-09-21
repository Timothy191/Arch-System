# Requirements (EARS Syntax) — Backend Review

## Ubiquitous Requirements

- **REQ-001**: WHEN any backend component is reviewed, THE SYSTEM SHALL verify RLS policy correctness against all 45+ access control tables.
- **REQ-002**: WHEN API routes are examined, THE SYSTEM SHALL validate contract schemas against Zod definitions in `packages/contract/src/schemas/`.
- **REQ-003**: WHEN security configurations are audited, THE SYSTEM SHALL verify service role key isolation, middleware JWT validation, and OWASP ZAP baseline compliance.
- **REQ-004**: WHEN performance characteristics are assessed, THE SYSTEM SHALL measure Redis cluster health, rate limiter effectiveness, cache hit ratios, and query execution plans.
- **REQ-005**: WHEN infrastructure is reviewed, THE SYSTEM SHALL validate Docker Compose configs, Kubernetes HPA thresholds, Nginx proxy rules, and systemd service units.

## Event-Driven Requirements

- **REQ-006**: WHEN a database migration is evaluated, THE SYSTEM SHALL verify rollback safety, index coverage, and FK integrity for all 113 migrations.
- **REQ-007**: WHEN a webhook or sync endpoint is tested, THE SYSTEM SHALL validate payload contracts, retry logic, and metadata consistency.
- **REQ-008**: WHEN RLS policies are modified, THE SYSTEM SHALL verify policy extension safety, privilege escalation prevention, and initplan optimization.
- **REQ-009**: WHEN cache invalidation is triggered, THE SYSTEM SHALL verify tag-based invalidation, read-replica consistency, and turbo cache coherence.
- **REQ-010**: WHEN monitoring alerts fire, THE SYSTEM SHALL validate alertmanager routing, Prometheus rule thresholds, and pagerduty escalation paths.

## State-Driven Requirements

- **REQ-011**: WHILE the system operates under load, THE SYSTEM SHALL maintain p95 latency < 1.0s, error rate < 1%, and database connection pool saturation < 80%.
- **REQ-012**: WHILE RLS policies are active, THE SYSTEM SHALL enforce row-level isolation for all tenant-department access patterns without privilege escalation.
- **REQ-013**: WHILE the deployment pipeline runs, THE SYSTEM SHALL enforce pre-flight checks, backup creation, health verification, and rollback capability.

## Security-Specific Requirements

- **REQ-014**: WHEN service role keys are accessed, THE SYSTEM SHALL verify they are never exposed to client-side code and are restricted to server-side operations only.
- **REQ-015**: WHEN authentication middleware processes requests, THE SYSTEM SHALL validate JWT signatures via `getClaims()` and never trust `getSession()` for authorization decisions.
- **REQ-016**: WHEN secrets rotation is performed, THE SYSTEM SHALL verify the `secrets_rotation_log` table and rotation procedure integrity.

## Compliance Requirements

- **REQ-017**: WHEN access control is reviewed, THE SYSTEM SHALL verify all `assertAccessControlRole`, `assertAccessCardActionsRole`, and `requireDepartment` functions enforce correct authorization.
- **REQ-018**: WHEN audit logs are examined, THE SYSTEM SHALL verify `audit_logs` table completeness, `logAuditEvent` function correctness, and PII data handling.

## Optional & Unwanted Feature Constraints

- **REQ-019**: IF any migration lacks a corresponding rollback script, THEN THE SYSTEM SHALL flag it as a rollback safety violation.
- **REQ-020**: IF any API route lacks rate limiting or CORS configuration, THEN THE SYSTEM SHALL flag it as a security gap.
- **REQ-021**: IF any Redis namespace lacks consistent-hashing strategy or health monitoring, THEN THE SYSTEM SHALL flag it as a reliability risk.
