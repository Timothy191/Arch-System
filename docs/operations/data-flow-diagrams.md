# Data Flow Diagrams

**Last Updated:** 2026-06-15  
**Version:** 1.0  
**Audience:** Developers, System Architects

---

## Overview

This document provides detailed data flow diagrams for key Control Room system processes.

## Flow 1: Shift Closeout

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant Validation
    participant Database
    participant Redis
    participant SupabaseRealtime
    participant Audit

    User->>Dashboard: Initiate Shift Closeout
    Dashboard->>Redis: Check Rate Limit
    Redis-->>Dashboard: Rate Limit Result
    alt Rate Limit Exceeded
        Dashboard-->>User: Error: Too Many Attempts
    else Rate Limit Allowed
        Dashboard->>Validation: Validate Shift Data
        Validation->>Database: Get Machines
        Database-->>Validation: Machine List
        Validation->>Database: Get Operations
        Database-->>Validation: Operations Data
        Validation->>Database: Get Hourly Loads
        Database-->>Validation: Loads Data
        Validation->>Validation: Check Completeness
        alt Incomplete
            Validation-->>User: Validation Errors
        else Complete
            Dashboard->>Validation: Verify PIN
            Validation->>Redis: Check PIN Lockout
            Redis-->>Validation: Lockout Status
            alt Locked
                Validation-->>User: Error: Account Locked
            else Not Locked
                Validation->>Database: Get PIN Hash
                Database-->>Validation: PIN Hash
                Validation->>Validation: Compare PIN
                alt Invalid PIN
                    Validation->>Redis: Record Failed Attempt
                    Validation-->>User: Error: Invalid PIN
                else Valid PIN
                    Dashboard->>Database: Close Shift
                    Database->>Database: Update shift_status
                    Database->>Database: Update audit_logs
                    Database->>SupabaseRealtime: Notify Subscribers
                    Dashboard->>Audit: Log Event
                    Dashboard-->>User: Success: Shift Closed
                end
            end
        end
    end
```

## Flow 2: Machine Status Update (SCADA Integration)

```mermaid
sequenceDiagram
    participant FUXA
    participant Integration
    participant Database
    participant SupabaseRealtime
    participant Dashboard
    participant AlertPanel

    FUXA->>FUXA: Poll Equipment Status
    FUXA->>Integration: Status Change Event
    Integration->>Database: Update Machine Status
    Database->>Database: SET active = status
    Database->>SupabaseRealtime: Notify postgres_changes
    SupabaseRealtime->>Dashboard: Real-time Subscription
    Dashboard->>Dashboard: Update Machine List
    alt Machine Goes Offline
        Database->>AlertPanel: Generate Alert
        AlertPanel->>Dashboard: Display Alert
        Dashboard->>Dashboard: Alert Indicator
    end
```

## Flow 3: Shift Completeness Check (Scheduled Job)

```mermaid
sequenceDiagram
    participant Inngest
    participant Job
    participant Database
    participant Redis
    participant AlertSystem

    Inngest->>Job: Trigger (every 15 min)
    Job->>Database: Get Active Departments
    Database-->>Job: Department List
    loop For Each Department
        Job->>Job: Determine Current Shift
        Job->>Database: Get Shift Completeness
        Database-->>Job: Completeness Status
        Job->>Job: Check Missing Machines
        alt Missing Machines > 30min into Shift
            Job->>Database: Create Alert Record
            Database->>Database: INSERT shift_completeness_alerts
            Job->>AlertSystem: Notify
        end
    end
    Job->>Inngest: Job Complete
```

## Flow 4: Orphaned Record Detection (Scheduled Job)

```mermaid
sequenceDiagram
    participant Inngest
    participant Job
    participant Database
    participant IssueTracker

    Inngest->>Job: Trigger (daily at 02:00)
    Job->>Database: Check Machine Operations
    Job->>Database: SELECT WHERE machine_id NOT IN (machines)
    Database-->>Job: Invalid Operations
    Job->>Database: Check Hourly Loads
    Job->>Database: SELECT WHERE machine_id NOT IN (active machines)
    Database-->>Job: Orphaned Loads
    Job->>Database: Check Operators
    Job->>Database: SELECT WHERE operator_id NOT IN (employees)
    Database-->>Job: Invalid Operations
    loop For Each Issue Found
        Job->>Database: Create Data Integrity Issue
        Database->>Database: INSERT data_integrity_issues
    end
    Job->>IssueTracker: Summary Report
    Job->>Inngest: Job Complete
```

## Flow 5: Real-Time Hourly Loads Update

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant Database
    participant SupabaseRealtime
    participant Cache
    participant Validation

    User->>Dashboard: Update Hourly Load
    Dashboard->>Cache: Check Cache Invalidation
    Dashboard->>Database: Update hourly_loads
    Database->>Database: UPDATE total_loads
    Database->>Validation: Validate Load Consistency
    alt Load per Hour Outside Range
        Database-->>User: Validation Warning
    else Valid
        Database->>SupabaseRealtime: Notify Subscribers
        SupabaseRealtime->>Dashboard: Real-time Subscription
        Dashboard->>Dashboard: Update UI
        Dashboard->>Cache: Invalidate Shift Cache
    end
```

## Flow 6: Shift Integrity Report (Weekly)

```mermaid
sequenceDiagram
    participant Inngest
    participant Job
    participant Database
    participant ReportStorage

    Inngest->>Job: Trigger (weekly Sunday 03:00)
    Job->>Database: Get Shift Status (last 7 days)
    Database-->>Job: Shift Data
    Job->>Database: Get Shift Completeness Alerts
    Database-->>Job: Alert Data
    Job->>Database: Get Data Integrity Issues
    Database-->>Job: Integrity Data
    Job->>Database: Get Machine Operations Count
    Database-->>Job: Operations Data
    Job->>Job: Calculate Metrics
    Job->>Job: Calculate On-Time Close Rate
    Job->>Job: Calculate Data Quality Score
    Job->>Job: Calculate Operational KPIs
    Job->>Database: Store Report
    Database->>Database: INSERT shift_integrity_reports
    Job->>ReportStorage: Summary for Email
    Job->>Inngest: Job Complete
```

## Flow 7: Dashboard Load with Caching

```mermaid
sequenceDiagram
    participant User
    participant NextJS
    participant Middleware
    participant Redis
    participant Database
    participant Components

    User->>NextJS: Request Dashboard
    NextJS->>Middleware: Department Slug Resolution
    Middleware->>Redis: Check Cache (dept_context)
    alt Cache Hit
        Redis-->>Middleware: Department Context
    else Cache Miss
        Middleware->>Database: Get Department
        Database-->>Middleware: Department Data
        Middleware->>Redis: Set Cache
    end
    Middleware-->>NextJS: Department Info
    NextJS->>Database: Get Dashboard Data (Server Component)
    Database-->>NextJS: Summary Grid Data
    NextJS->>Redis: Check Cache (shift_completeness)
    alt Cache Hit
        Redis-->>NextJS: Completeness Data
    else Cache Miss
        NextJS->>Database: Get Completeness
        Database-->>NextJS: Completeness Data
        NextJS->>Redis: Set Cache
    end
    NextJS->>Components: Render Dashboard
    Components->>User: Dashboard Loaded
```

## Flow 8: PIN Verification with Lockout

```mermaid
stateDiagram-v2
    [*] --> PINEntry: User Enters PIN
    PINEntry --> CheckLockout
    CheckLockout --> Locked: Lockout Active
    CheckLockout --> Verification: No Lockout
    Locked --> [*]: Error to User
    Verification --> FetchPINHash
    FetchPINHash --> ComparePIN
    ComparePIN --> Success: PIN Valid
    ComparePIN --> Failure: PIN Invalid
    Failure --> RecordFailure
    RecordFailure --> CheckThreshold
    CheckThreshold --> Increment: < 3 failures
    CheckThreshold --> LockAccount: >= 3 failures
    Increment --> [*]: Error to User
    LockAccount --> [*]: Error to User (Locked 15min)
    Success --> RecordAttempt
    RecordAttempt --> CloseShift
    CloseShift --> [*]: Success to User
```

## Component Data Flow

### SCADA Panel Data Flow

```
FUXA SCADA Server
    ↓ (HTTP/iframe)
SCADA Panel Component
    ↓ (props)
Machine List View
    ↓ (subscription)
Supabase Realtime
    ↓ (postgres_changes)
Machine Status Updates
```

### Alert Panel Data Flow

```
Database (machines table)
    ↓ (trigger)
Supabase Realtime
    ↓ (subscription)
Alert Panel Component
    ↓ (state)
Alert List UI
    ↓ (user action)
Acknowledge/Dismiss
    ↓ (mutation)
Database Update
```

### Shift Coverage Widget Data Flow

```
Database (shift_status, daily_logs)
    ↓ (server component)
Shift Coverage Widget
    ↓ (computed)
Completeness Status
    ↓ (render)
Shift Coverage UI
```

## External System Integration

### FUXA SCADA Integration

**Data Flow:**

```
Equipment → MQTT/Modbus → FUXA → Status Update → Integration Script → Database → Realtime Subscription → UI Update
```

**Fallback Flow:**

```
FUXA Down → Cached Data → UI Display (Stale) → Connection Retry → FUXA Up → Real-time Update
```

### Inngest Job Integration

**Data Flow:**

```
Cron Trigger → Inngest API → Job Execution → Database Queries → Data Processing → Database Updates → Job Completion → Telemetry Logging
```

## Cache Layer Data Flow

### Read Path (Cache Hit)

```
Request → Cache Lookup → Cache Hit → Return Data
```

### Read Path (Cache Miss)

```
Request → Cache Lookup → Cache Miss → Database Query → Cache Set → Return Data
```

### Write Path (Cache Invalidation)

```
Write Operation → Database Update → Cache Invalidate → Next Read = Cache Miss → Fresh Data
```

## Security Data Flow

### Authentication Flow

```
User Credentials → Supabase Auth → JWT Token → Cookie Set → Next Request → Token Validation → User Context
```

### Authorization Flow

```
User Context → RLS Policy Check → Database Query → Filtered Results → UI Display
```

### Rate Limiting Flow

```
Request → Rate Limit Check (Redis) → Counter Increment → Allowed? → Process Request / Return 429
```

## Monitoring Data Flow

### OpenTelemetry Span Flow

```
Operation Start → Create Span → Add Attributes → Add Events → Operation End → Export to OTEL Backend → Dashboard Display
```

### Prometheus Metrics Flow

```
Operation → Metric Increment/Histogram Record → Metric Registry → /api/metrics/prometheus → Prometheus Scrape → Grafana Dashboard → Alert Evaluation
```

## Summary

These data flow diagrams illustrate:

1. **Shift Closeout:** End-to-end process with validation, PIN verification, and database updates
2. **SCADA Integration:** Real-time status updates from FUXA to UI
3. **Scheduled Jobs:** Automated background processes for completeness and integrity
4. **Caching:** Cache lookup, miss, and invalidation patterns
5. **Security:** Authentication, authorization, and rate limiting flows
6. **Monitoring:** Observability data collection and display

---

**Last Review:** 2026-06-15  
**Next Review:** 2026-09-15 (quarterly)
