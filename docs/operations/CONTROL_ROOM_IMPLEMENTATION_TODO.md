# Control Room Department - Implementation TODO List

**Created:** 2026-06-15  
**Purpose:** Detailed TODO list for Control Room production hardening  
**Status:** 📋 Ready for Review - No Implementation Yet

---

## 🚨 **IMPORTANT: Implementation Hold**

This document is for **planning and review only**. Do NOT implement any changes until:

- [ ] This TODO list is reviewed and approved
- [ ] Priority and dependencies are confirmed
- [ ] Resource allocation is confirmed
- [ ] Timeline is agreed upon

---

## 📊 **Overview**

**Total Tasks:** 45 tasks across 7 categories  
**Estimated Total Time:** 100-143 hours  
**Phases:** 3 phases (Essential, Important, Enhanced)

---

## 🔧 **Phase 1: Essential (Pre-Production)**

### **Category 1: Environment Configuration**

- [ ] **TASK-1.1:** Set `NEXT_PUBLIC_FUXA_URL` in production `.env`
  - **File:** `00_applications/portal/.env`
  - **Current Value:** `http://localhost:1881`
  - **Required:** Production FUXA URL
  - **Time:** 1 hour
  - **Owner:** DevOps Team
  - **Dependencies:** FUXA server deployment
  - **Acceptance Criteria:** FUXA iframe loads successfully in staging

### **Category 2: Database Setup**

- [ ] **TASK-2.1:** Verify `control_room_operator` role exists in database
  - **SQL:** Run verification query from production readiness doc
  - **Remediation:** Create role if missing
  - **Time:** 30 minutes
  - **Owner:** DBA Team
  - **Acceptance Criteria:** Role exists, at least 2-3 operators assigned

- [ ] **TASK-2.2:** Verify supervisor PINs are set
  - **SQL:** Run PIN verification query
  - **Remediation:** Use setPin() function for missing PINs
  - **Time:** 1 hour
  - **Owner:** DBA Team + HR/IT
  - **Acceptance Criteria:** All active supervisors/admins have PINs set

- [ ] **TASK-2.3:** Verify control room machine registration
  - **SQL:** Run machine verification query
  - **Expected:** DT-101, DT-102 with bin_factor ~40.5
  - **Time:** 30 minutes
  - **Owner:** DBA Team
  - **Acceptance Criteria:** At least 2 dump trucks registered with correct bin_factor

- [ ] **TASK-2.4:** Verify department configuration
  - **SQL:** Check department type and config
  - **Time:** 30 minutes
  - **Owner:** DBA Team
  - **Acceptance Criteria:** Department type matches enum expectations

### **Category 3: Error Handling**

- [ ] **TASK-3.1:** Create ErrorBoundary component
  - **File:** `00_applications/portal/components/ErrorBoundary.tsx` (new file)
  - **Features:** Fallback UI, error reporting, retry mechanism
  - **Time:** 3-4 hours
  - **Owner:** Frontend Developer
  - **Dependencies:** Sentry configuration
  - **Acceptance Criteria:** Catches errors, shows fallback, reports to Sentry

- [ ] **TASK-3.2:** Wrap dashboard in ErrorBoundary
  - **File:** `00_applications/portal/app/(departments)/[department]/page.tsx`
  - **Time:** 1 hour
  - **Owner:** Frontend Developer
  - **Acceptance Criteria:** Dashboard errors don't crash entire app

- [ ] **TASK-3.3:** Implement FUXA degraded mode
  - **File:** `features/departments/components/control-room/FuxaFrame.tsx`
  - **Features:** Cache fallback, retry logic, connection status
  - **Time:** 6-8 hours
  - **Owner:** Frontend Developer
  - **Dependencies:** Redis cache infrastructure
  - **Acceptance Criteria:** Shows cached data when FUXA unavailable, auto-retry

### **Category 4: Monitoring**

- [ ] **TASK-4.1:** Create FUXA health check endpoint
  - **File:** `00_applications/portal/app/api/health/fuxa/route.ts` (new file)
  - **Checks:** HTTP response, CORS, iframe loadability
  - **Time:** 2 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Returns health status with latency metric

- [ ] **TASK-4.2:** Create Supabase realtime health check
  - **File:** `00_applications/portal/app/api/health/supabase-realtime/route.ts` (new file)
  - **Checks:** Connection status, subscription count, latency
  - **Time:** 2 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Returns subscription health metrics

- [ ] **TASK-4.3:** Create Redis health check endpoint
  - **File:** `00_applications/portal/app/api/health/12_distributed_cache_runtime/route.ts` (new file)
  - **Checks:** Connection status, cache hit rate, memory usage
  - **Time:** 2 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Returns Redis health metrics

- [ ] **TASK-4.4:** Create unified health check endpoint
  - **File:** `00_applications/portal/app/api/health/route.ts` (new file)
  - **Features:** Aggregates all health checks
  - **Time:** 1 hour
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Single endpoint returns overall system health

### **Category 5: Documentation**

- [ ] **TASK-5.1:** Create shift closeout runbook
  - **File:** `06_technical_documentation/control-room/shift-closeout-runbook.md` (new file)
  - **Content:** Step-by-step procedures, error resolution, emergency procedures
  - **Time:** 2-3 hours
  - **Owner:** Technical Writer + Operations Lead
  - **Acceptance Criteria:** Reviewed by operations team, procedures tested

---

## 📈 **Phase 2: Important (Week 1 Post-Production)**

### **Category 6: Observability**

- [ ] **TASK-6.1:** Add OpenTelemetry to shift closeout
  - **File:** `lib/shift-closeout.ts`
  - **Spans:** validation, PIN verify, shift close events
  - **Time:** 3-4 hours
  - **Owner:** Backend Developer
  - **Dependencies:** OpenTelemetry exporter configured
  - **Acceptance Criteria:** Traces appear in monitoring dashboard

- [ ] **TASK-6.2:** Add OpenTelemetry to SCADA panel
  - **File:** `features/departments/components/control-room/ScadaPanel.tsx`
  - **Spans:** machine fetch, realtime subscription
  - **Time:** 2-3 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Machine fetch operations traced

- [ ] **TASK-6.3:** Add OpenTelemetry to AlertPanel
  - **File:** `features/departments/components/control-room/AlertPanel.tsx`
  - **Spans:** status check, alert generation
  - **Time:** 2-3 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Alert generation operations traced

- [ ] **TASK-6.4:** Add OpenTelemetry to hourly loads
  - **File:** `app/(departments)/[department]/hourly-loads/page.tsx`
  - **Spans:** load updates, auto-save, cache updates
  - **Time:** 2-3 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Load update operations traced

### **Category 7: Security**

- [ ] **TASK-7.1:** Add rate limiting to shift closeout
  - **File:** `lib/shift-closeout.ts`
  - **Limit:** 5 attempts per minute per user
  - **Time:** 2-3 hours
  - **Owner:** Backend Developer
  - **Dependencies:** Rate limiter infrastructure
  - **Acceptance Criteria:** Rate limits enforced, excess requests rejected

- [ ] **TASK-7.2:** Add rate limiting to machine status updates
  - **File:** Machine status update endpoints
  - **Limit:** 10 updates per minute per machine
  - **Time:** 2-3 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Rapid status toggling prevented

- [ ] **TASK-7.3:** Add CAPTCHA after failed PIN attempts
  - **File:** `lib/shift-closeout.ts` verifyPin function
  - **Trigger:** 3 failed attempts within 5 minutes
  - **Time:** 1-2 hours
  - **Owner:** Backend Developer
  - **Dependencies:** CAPTCHA system integration
  - **Acceptance Criteria:** CAPTCHA triggers after threshold, lockout enforced

### **Category 8: Testing**

- [ ] **TASK-8.1:** Create shift closeout integration tests
  - **File:** `lib/shift-closeout.test.ts` (new file)
  - **Scenarios:** Success, failure, validation, PIN verify
  - **Time:** 6-8 hours
  - **Owner:** QA Developer
  - **Dependencies:** Test database environment
  - **Acceptance Criteria:** All scenarios pass, coverage >80%

### **Category 9: Documentation**

- [ ] **TASK-9.1:** Create operator onboarding guide
  - **File:** `06_technical_documentation/control-room/operator-onboarding.md` (new file)
  - **Content:** System overview, daily workflows, procedures
  - **Time:** 4-6 hours
  - **Owner:** Technical Writer + Training Lead
  - **Acceptance Criteria:** Reviewed by training team, user tested

- [ ] **TASK-9.2:** Create FUXA troubleshooting guide
  - **File:** `06_technical_documentation/control-room/fuxa-troubleshooting.md` (new file)
  - **Content:** Common issues, resolution procedures
  - **Time:** 3-4 hours
  - **Owner:** Technical Writer + SCADA Engineer
  - **Acceptance Criteria:** Reviewed by SCADA team, procedures tested

---

## 🚀 **Phase 3: Enhanced (Month 1 Post-Production)**

### **Category 10: Advanced Testing**

- [ ] **TASK-10.1:** Create CloseShiftModal unit tests
  - **File:** `features/departments/components/control-room/CloseShiftModal.test.tsx` (new file)
  - **States:** 8 modal states, transitions, error handling
  - **Time:** 4-6 hours
  - **Owner:** QA Developer
  - **Acceptance Criteria:** All state transitions tested

- [ ] **TASK-10.2:** Create MachineControl unit tests
  - **File:** `features/departments/components/control-room/MachineControl.test.tsx` (new file)
  - **Scenarios:** Input validation, button actions
  - **Time:** 2-3 hours
  - **Owner:** QA Developer
  - **Acceptance Criteria:** All user interactions tested

- [ ] **TASK-10.3:** Create DozerRollForm unit tests
  - **File:** `features/departments/components/control-room/DozerRollForm.test.tsx` (new file)
  - **Scenarios:** Validation, calculation, submission
  - **Time:** 3-4 hours
  - **Owner:** QA Developer
  - **Acceptance Criteria:** Form validation and calculation tested

- [ ] **TASK-10.4:** Create shift completeness logic tests
  - **File:** `lib/shift-completeness.test.ts` (new file)
  - **Scenarios:** Completeness checks, mapping, validation
  - **Time:** 3-4 hours
  - **Owner:** QA Developer
  - **Acceptance Criteria:** Business logic thoroughly tested

- [ ] **TASK-10.5:** Create machine operations E2E test
  - **File:** `09_end_to_end_verification/control-room-machine-operations.spec.ts` (new file)
  - **Journey:** Login → Log operation → Verify in list
  - **Time:** 3-4 hours
  - **Owner:** QA Developer
  - **Dependencies:** Playwright environment
  - **Acceptance Criteria:** End-to-end flow passes in CI/CD

- [ ] **TASK-10.6:** Create shift closeout E2E test
  - **File:** `09_end_to_end_verification/control-room-shift-closeout.spec.ts` (new file)
  - **Journey:** Login → Close shift → Verify closed
  - **Time:** 3-4 hours
  - **Owner:** QA Developer
  - **Acceptance Criteria:** Complete shift closeout flow passes

- [ ] **TASK-10.7:** Create alert acknowledgment E2E test
  - **File:** `09_end_to_end_verification/control-room-alerts.spec.ts` (new file)
  - **Journey:** View alerts → Acknowledge → Verify
  - **Time:** 2-3 hours
  - **Owner:** QA Developer
  - **Acceptance Criteria:** Alert acknowledgment flow passes

- [ ] **TASK-10.8:** Create SCADA panel E2E test
  - **File:** `09_end_to_end_verification/control-room-scada.spec.ts` (new file)
  - **Journey:** Load SCADA → Test view toggle → Verify fallback
  - **Time:** 2-3 hours
  - **Owner:** QA Developer
  - **Acceptance Criteria:** SCADA interaction flow passes

### **Category 11: Data Integrity**

- [ ] **TASK-11.1:** Create shift completeness check job
  - **File:** `lib/jobs/shift-completeness-check.ts` (new file)
  - **Schedule:** Every 15 minutes during shift hours
  - **Time:** 4-6 hours
  - **Owner:** Backend Developer
  - **Dependencies:** Inngest infrastructure
  - **Acceptance Criteria:** Job runs, alerts on missing entries

- [ ] **TASK-11.2:** Create orphaned record detection job
  - **File:** `lib/jobs/orphaned-record-detection.ts` (new file)
  - **Schedule:** Daily at 02:00
  - **Time:** 3-4 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Job runs, flags orphaned records

- [ ] **TASK-11.3:** Create data integrity report
  - **File:** `lib/reports/shift-integrity.ts` (new file)
  - **Schedule:** Weekly
  - **Time:** 3-4 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** Report generates, emails sent

- [ ] **TASK-11.4:** Add server-side validation enhancements
  - **File:** Multiple files (shift-completeness.ts, machine operations)
  - **Features:** Hour limits, bin_factor validation, cross-field validation
  - **Time:** 4-6 hours
  - **Owner:** Backend Developer
  - **Acceptance Criteria:** All validations enforced server-side

### **Category 12: Advanced Monitoring**

- [ ] **TASK-12.1:** Create performance metrics
  - **File:** Instrumentation throughout codebase
  - **Metrics:** Dashboard load, SCADA load, realtime latency
  - **Time:** 4-6 hours
  - **Owner:** DevOps Engineer
  - **Acceptance Criteria:** Metrics collected, dashboards created

- [ ] **TASK-12.2:** Create monitoring dashboards
  - **File:** Grafana/monitoring system configuration
  - **Dashboards:** Control room specific views
  - **Time:** 4-6 hours
  - **Owner:** DevOps Engineer
  - **Acceptance Criteria:** Dashboards display key metrics

- [ ] **TASK-12.3:** Configure alerting rules
  - **File:** Monitoring system alert configuration
  - **Alerts:** Health check failures, performance degradation
  - **Time:** 2-3 hours
  - **Owner:** DevOps Engineer
  - **Acceptance Criteria:** Alerts trigger on threshold violations

### **Category 13: Documentation Completion**

- [ ] **TASK-13.1:** Create PIN reset procedure doc
  - **File:** `06_technical_documentation/control-room/pin-reset-procedure.md` (new file)
  - **Content:** PIN setup, reset, security requirements
  - **Time:** 2-3 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Reviewed by security team

- [ ] **TASK-13.2:** Create machine registration guide
  - **File:** `06_technical_documentation/control-room/machine-registration-guide.md` (new file)
  - **Content:** Machine types, required fields, procedures
  - **Time:** 2-3 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Reviewed by operations team

- [ ] **TASK-13.3:** Create supervisor workflow doc
  - **File:** `06_technical_documentation/control-room/supervisor-workflow.md` (new file)
  - **Content:** Supervisor responsibilities, approval process
  - **Time:** 2-3 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Reviewed by supervisors

- [ ] **TASK-13.4:** Create SCADA user guide
  - **File:** `06_technical_documentation/control-room/scada-user-guide.md` (new file)
  - **Content:** SCADA features, usage, troubleshooting
  - **Time:** 2-3 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Reviewed by SCADA team

- [ ] **TASK-13.5:** Create alert response procedures
  - **File:** `06_technical_documentation/control-room/alert-response-procedures.md` (new file)
  - **Content:** Alert types, response procedures, escalation
  - **Time:** 2-3 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Reviewed by operations team

- [ ] **TASK-13.6:** Create architecture documentation
  - **File:** `06_technical_documentation/control-room/architecture.md` (new file)
  - **Content:** Component architecture, data flows
  - **Time:** 3-4 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Reviewed by architecture team

- [ ] **TASK-13.7:** Create data flow diagrams
  - **File:** `06_technical_documentation/control-room/data-flows.md` (new file)
  - **Content:** Data flow diagrams for all operations
  - **Time:** 3-4 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Diagrams accurate and complete

- [ ] **TASK-13.8:** Create caching strategy doc
  - **File:** `06_technical_documentation/control-room/caching-strategy.md` (new file)
  - **Content:** Cache keys, TTL, invalidation, monitoring
  - **Time:** 2-3 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Reviewed by performance team

- [ ] **TASK-13.9:** Create troubleshooting guide
  - **File:** `06_technical_documentation/control-room/troubleshooting.md` (new file)
  - **Content:** Common issues, resolution procedures
  - **Time:** 3-4 hours
  - **Owner:** Technical Writer
  - **Acceptance Criteria:** Reviewed by support team

### **Category 14: Performance Optimization**

- [ ] **TASK-14.1:** Optimize dashboard load performance
  - **File:** `app/(departments)/[department]/page.tsx`
  - **Optimizations:** Code splitting, lazy loading, caching
  - **Time:** 4-6 hours
  - **Owner:** Frontend Developer
  - **Acceptance Criteria:** Load time <2s initial, <500ms subsequent

- [ ] **TASK-14.2:** Optimize real-time update performance
  - **File:** Real-time subscription components
  - **Optimizations:** Batch updates, throttle subscriptions
  - **Time:** 4-6 hours
  - **Owner:** Frontend Developer
  - **Acceptance Criteria:** Update latency <100ms p95

---

## 📋 **Summary Statistics**

### **Task Breakdown by Category**

- **Environment Config:** 1 task (1 hour)
- **Database Setup:** 4 tasks (2.5 hours)
- **Error Handling:** 3 tasks (15-17 hours)
- **Monitoring:** 4 tasks (7 hours)
- **Documentation (Phase 1):** 1 task (2.5 hours)
- **Observability:** 4 tasks (9-13 hours)
- **Security:** 3 tasks (5-8 hours)
- **Testing (Phase 2):** 1 task (6-8 hours)
- **Documentation (Phase 2):** 2 tasks (7-10 hours)
- **Advanced Testing:** 8 tasks (19-25 hours)
- **Data Integrity:** 4 tasks (14-20 hours)
- **Advanced Monitoring:** 3 tasks (10-15 hours)
- **Documentation (Phase 3):** 9 tasks (20-27 hours)
- **Performance Optimization:** 2 tasks (8-12 hours)

### **Resource Requirements**

- **Frontend Developer:** 27-35 hours
- **Backend Developer:** 47-64 hours
- **QA Developer:** 25-33 hours
- **DevOps Engineer:** 14-21 hours
- **Technical Writer:** 29-40 hours
- **DBA Team:** 2.5 hours
- **Operations Lead:** 2.5 hours
- **SCADA Engineer:** 4 hours
- **Training Lead:** 6 hours
- **HR/IT:** 1 hour

### **Timeline Estimate**

- **Phase 1 (Pre-Production):** 19-27 hours (1-3 days with parallel execution)
- **Phase 2 (Week 1):** 25-36 hours (3-5 days with parallel execution)
- **Phase 3 (Month 1):** 56-80 hours (7-10 days with parallel execution)

---

## ✅ **Approval Checklist**

Before implementation begins, ensure:

- [ ] All 45 tasks reviewed and prioritized
- [ ] Resource allocation confirmed for all roles
- [ ] Timeline agreed upon by all stakeholders
- [ ] Dependencies identified and addressed
- [ ] Risk assessment completed
- [ ] Rollback plan defined
- [ ] Success criteria defined for each phase
- [ ] Communication plan established

---

## 🔄 **Implementation Process**

1. **Phase 1 Start:** Environment config and database verification
2. **Phase 1 Complete:** Health checks operational, error boundaries in place
3. **Production Launch:** Phase 1 requirements met
4. **Phase 2 Start:** Observability and security enhancements
5. **Phase 2 Complete:** Monitoring comprehensive, tests passing
6. **Phase 3 Start:** Advanced features and optimization
7. **Phase 3 Complete:** Full production hardening achieved

---

_This TODO list should be updated as tasks are completed, blocked, or re-prioritized._
