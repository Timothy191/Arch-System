# Phased Action Tasks — Backend Review

## Phase 1: Spec & Requirement Decomposition [COMPLETE]

- [x] EARS specification & 5-pillar score generated
- [x] Real-World Quality Score: 89.20/100 (below 90 gate — security and maintainability need improvement)
- [x] Swarm topology selected: Topology A (Tiered Context Hierarchy) + B (Writer-Critic) + C (Parallel Swarm)

## Phase 2: Database & RLS Audit [PENDING]

- [ ] **T2 Scout**: Index all 113 migrations by domain, RLS policy count, and rollback availability
- [ ] **T1 Specialist**: Audit RLS policy correctness across all 45+ access control tables
- [ ] **T1 Specialist**: Verify migration rollback safety (only 1 rollback script exists: `068_delay_entries_rollback.sql`)
- [ ] **T1 Specialist**: Check index coverage (`index_coverage.sql`), FK integrity, and query performance
- [ ] **Critic**: Challenge RLS policy edge cases — privilege escalation prevention, initplan optimization
- [ ] **Writer**: Document RLS policy findings with remediation recommendations

## Phase 3: API & Contract Audit [PENDING]

- [ ] **T2 Scout**: Map all 26 API route groups and their request/response patterns
- [ ] **T1 Specialist**: Validate all 20 Zod schemas against actual API usage
- [ ] **T1 Specialist**: Audit webhook infrastructure (payloads, retries, metadata consistency)
- [ ] **T1 Specialist**: Verify rate limiting and CORS configuration on all routes
- [ ] **Critic**: Test boundary conditions — unauthenticated access, malformed payloads, rate limit bypass
- [ ] **Writer**: Document contract compliance gaps and API security findings

## Phase 4: Security & Audit Deep-Dive [PENDING]

- [ ] **T1 Specialist**: Audit service role key management and isolation
- [ ] **T1 Specialist**: Review middleware auth flow (`getClaims()` vs `getSession()`)
- [ ] **T1 Specialist**: Verify access control functions (`assertAccessControlRole`, `requireDepartment`)
- [ ] **T1 Specialist**: Audit secrets rotation log and procedure
- [ ] **T2 Scout**: Run OWASP ZAP baseline scan against running instance
- [ ] **Critic**: Challenge security assumptions — RLS bypass vectors, service role exposure, JWT claim validation
- [ ] **Writer**: Document security vulnerabilities with severity ratings

## Phase 5: Performance & Caching Audit [PENDING]

- [ ] **T1 Specialist**: Audit Redis cluster health (3-node cluster, namespace distribution)
- [ ] **T1 Specialist**: Measure cache hit ratios, invalidation tag effectiveness
- [ ] **T1 Specialist**: Review pg_cron schedules and materialized view refresh optimization
- [ ] **T1 Specialist**: Analyze vector index performance (HNSW parameters, query latency)
- [ ] **T1 Specialist**: Profile database query plans (partition pruning, missing indexes)
- [ ] **T2 Scout**: Execute k6 stress test to measure p95 latency and error rates
- [ ] **Critic**: Challenge performance assumptions — cache stampede, redis failover, connection pool saturation
- [ ] **Writer**: Document performance bottlenecks with optimization recommendations

## Phase 6: DevOps & Infrastructure Audit [PENDING]

- [ ] **T1 Specialist**: Validate all 7 Docker Compose configurations
- [ ] **T1 Specialist**: Review Kubernetes HPA thresholds and scaling policies
- [ ] **T1 Specialist**: Audit Nginx proxy configuration and SSL termination
- [ ] **T1 Specialist**: Verify systemd service units and deployment scripts
- [ ] **T1 Specialist**: Review CI/CD pipeline configuration and secret management
- [ ] **T2 Scout**: Validate monitoring stack (Prometheus rules, Alertmanager routing, Grafana dashboards)
- [ ] **Critic**: Challenge infrastructure assumptions — single points of failure, resource limits, backup integrity
- [ ] **Writer**: Document infrastructure risks and hardening recommendations

## Phase 7: Testing & QA Verification [PENDING]

- [ ] **T1 Specialist**: Review database test suite (RLS safety, privilege escalation, migration rollback)
- [ ] **T1 Specialist**: Validate k6 stress test thresholds and coverage
- [ ] **T1 Specialist**: Check migration integrity tests and index coverage tests
- [ ] **Critic**: Verify test completeness — edge cases, negative tests, load tests
- [ ] **Writer**: Document test coverage gaps and recommended additions

## Phase 8: Integration & Quality Gate [PENDING]

- [ ] **T0 Orchestrator**: Consolidate all findings across 7 domains
- [ ] **T0 Orchestrator**: Re-evaluate Real-World Quality Score (target: >= 90/100)
- [ ] **Critic**: Final security review — cross-domain vulnerability chaining
- [ ] **Writer**: Generate comprehensive backend review report with prioritized remediation roadmap
- [ ] **T0 Orchestrator**: Log execution artifact to `.a2a/bus/event-log.jsonl`
- [ ] **Writer**: Update memory indices and task tracking

## Quality Gate Criteria

- All 7 domains must be reviewed with zero critical unpatched vulnerabilities
- RLS policy coverage must be verified for all 45+ tables
- API contract compliance must be >= 95%
- Performance metrics must meet p95 < 1.0s, error rate < 1%
- Security scan must pass OWASP ZAP baseline with no HIGH+ findings
- Real-World Quality Score must reach >= 90/100 before final sign-off
