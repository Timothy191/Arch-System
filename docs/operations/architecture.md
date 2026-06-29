# Control Room Architecture Documentation

**Last Updated:** 2026-06-15  
**Version:** 1.0  
**Audience:** Developers, System Architects, IT Support

---

## Overview

The Control Room system is a real-time operational dashboard for monitoring and managing mining equipment, shift operations, and data integrity. This document describes the system architecture, components, and data flows.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Dashboard│  │  SCADA   │  │  Alert   │  │  Shift   │       │
│  │  Pages   │  │  Panel   │  │  Panel   │  │ Coverage │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│         │             │             │             │              │
└─────────┼─────────────┼─────────────┼─────────────┼──────────────┘
          │             │             │             │
┌─────────┴─────────────┴─────────────┴─────────────┴──────────────┐
│                       API Layer (Next.js API Routes)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Shift    │  │  Admin   │  │ Metrics  │  │  Health  │       │
│  │  Actions │  │  Data    │  │  Endpoint│  │  Checks  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
          │
┌─────────┴───────────────────────────────────────────────────────┐
│                        Data Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Supabase  │  │  Redis   │  │  Inngest │  │  FUXA    │       │
│  │ (Postgres)│  │  Cache   │  │  Jobs    │  │  SCADA   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Frontend (Next.js App Router)

**Technology Stack:**

- Next.js 15+ with App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase Client

**Key Components:**

- **Dashboard Pages:** Main department dashboards
- **SCADA Panel:** Real-time machine status
- **Alert Panel:** Machine alert management
- **Shift Coverage:** Shift completeness tracking
- **Hourly Loads:** Material movement tracking

**Optimization:**

- Dynamic imports for code splitting
- Suspense boundaries for progressive rendering
- Server-side data fetching for initial load
- Redis caching for repeated queries

### API Layer (Next.js API Routes)

**Endpoints:**

- **Shift Actions:** `/api/actions/*` - Server actions for shift operations
- **Admin Data:** `/api/admin/data/[table]` - Generic admin data management
- **Metrics:** `/api/metrics/prometheus` - Prometheus metrics endpoint
- **Health:** `/api/health/*` - Health check endpoints
- **Inngest:** `/api/inngest` - Inngest job registration

**Features:**

- Rate limiting (Redis-backed)
- Authentication checks
- Server-side validation
- OpenTelemetry instrumentation

### Data Layer

#### Supabase (PostgreSQL)

**Purpose:** Primary data store for all operational data

**Key Tables:**

- `machines` - Machine registry and configuration
- `machine_operations` - Machine activity logs
- `hourly_loads` - Material movement data
- `operational_delays` - Delay tracking
- `shift_status` - Shift state management
- `employees` - User and supervisor management
- `shift_completeness_alerts` - Automated shift alerts
- `data_integrity_issues` - Data quality issues

**Features:**

- Row Level Security (RLS)
- Real-time subscriptions
- Automated backups
- Point-in-time recovery

#### Redis

**Purpose:** Caching and rate limiting

**Uses:**

- Shift completeness cache (5-minute TTL)
- Rate limiting store (user-based and machine-based)
- Session storage
- Temporary data storage

**Configuration:**

- Connection via `@repo/redis` package
- Automatic reconnection
- Configurable TTL per category

#### Inngest

**Purpose:** Background job scheduling and execution

**Jobs:**

- `shift-completeness-check` - Every 15 minutes, checks machine entries
- `orphaned-record-detection` - Daily at 02:00, detects data issues
- `shift-integrity-report` - Weekly on Sunday at 03:00, generates reports

**Features:**

- Cron-based scheduling
- Automatic retries
- Job execution tracking
- OpenTelemetry integration

#### FUXA SCADA

**Purpose:** Real-time equipment monitoring and control

**Integration:**

- Embedded via iframe in SCADA Panel
- Status updates via Supabase realtime
- Fallback to cached data when unavailable
- Connection health monitoring

**Data Sources:**

- MQTT for real-time updates
- Modbus for equipment communication
- OPC-UA for industrial automation

## Data Flow

### Shift Closeout Flow

```
User → Dashboard → closeShift() → validateShiftData()
                    ↓
                getShiftCompleteness()
                    ↓
                checkCompleteness()
                    ↓
                verifyPin() → checkPinAttemptLockout()
                    ↓
                closeShift → Update DB → Log Audit
                    ↓
                revalidatePath() → Notify User
```

### Machine Status Update Flow

```
FUXA → Machine Status Change → DB Update (via integration)
                                    ↓
                            Supabase Realtime Trigger
                                    ↓
                        postgres_changes Subscription
                                    ↓
                            Client State Update
                                    ↓
                            UI Re-render
```

### Shift Completeness Check Flow

```
Inngest Schedule → shift-completeness-check job
                          ↓
                    Get Shift Status
                          ↓
                Calculate Completeness
                          ↓
                Check Threshold (30min)
                          ↓
                Generate Alert (if needed)
                          ↓
                Store in shift_completeness_alerts
                          ↓
                Complete Job
```

## Authentication & Authorization

### Authentication Flow

1. User logs in via Supabase Auth
2. Session token stored in cookies
3. Department slug → UUID resolution via middleware
4. Role-based access control via RLS

### Authorization Levels

**Operator:**

- View assigned department data
- Log machine operations
- Update hourly loads
- Report delays

**Supervisor:**

- All operator permissions
- Close shifts with PIN
- Acknowledge alerts
- View audit logs

**Admin:**

- All supervisor permissions
- Modify machine data
- Manage employees
- Access admin interfaces
- Resolve data integrity issues

**Service Role:**

- System-level access for background jobs
- Bypasses RLS for automated operations
- Used by Inngest jobs

## Real-Time Updates

### Supabase Realtime

**Subscriptions:**

- Machine status updates
- Shift status changes
- Operational delay additions
- Alert generation

**Implementation:**

```typescript
supabase
  .channel("machines")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "machines",
    },
    handleUpdate,
  )
  .subscribe();
```

**Optimizations:**

- Selective column subscriptions
- Efficient change detection
- Automatic reconnection

## Caching Strategy

### Redis Cache Categories

**Shift Data:**

- Key pattern: `shift:{deptId}:{date}:{shift}`
- TTL: 5 minutes
- Invalidation: Manual or TTL expiry

**Department Context:**

- Key pattern: `dept_context:{slug}`
- TTL: 1 hour
- Invalidation: Manual on department changes

**Rate Limiting:**

- Key pattern: `ratelimit:{category}:{key}`
- TTL: Window duration (60s for shift closeout)
- Invalidation: Automatic on window expiry

### Cache Invalidation

**Manual:**

```typescript
await redis.del(`shift:${deptId}:${date}:${shift}`);
```

**Automatic:**

- TTL expiry
- Department context updates
- Configuration changes

## Monitoring & Observability

### OpenTelemetry Instrumentation

**Spans Tracked:**

- Shift validation
- PIN verification
- Shift closeout
- SCADA panel load
- Alert panel load
- Hourly loads updates

**Attributes:**

- Department ID
- Shift type
- Employee ID
- Machine ID
- Success/failure status
- Error counts

### Prometheus Metrics

**Key Metrics:**

- `control_room_shift_closeout_duration_seconds` - Histogram
- `control_room_scada_connection_status` - Gauge
- `control_room_data_integrity_score` - Gauge
- `control_room_api_response_time_seconds` - Histogram
- `control_room_active_alerts` - Gauge

**Alerting Rules:**

- SCADA down >5 minutes
- Shift closeout >60 seconds
- Data integrity score <70%
- API error rate >5%

## Security

### Rate Limiting

**Shift Closeout:**

- 5 attempts per minute per user
- Redis-backed for distributed enforcement
- Graceful degradation if Redis unavailable

**Machine Status:**

- 10 updates per minute per machine
- Per-machine rate limiting
- Prevents rapid status toggling

**API Endpoints:**

- General rate limiting via middleware
- Configurable per endpoint
- Whitelist for trusted IPs

### PIN Protection

**PIN Attempt Lockout:**

- 3 failed attempts within 5 minutes
- 15-minute lockout duration
- Automatic reset after lockout expires
- Manual reset capability

**PIN Requirements:**

- 4 digits
- Bcrypt hashed (salt factor 10)
- Never stored in plain text

### Row Level Security (RLS)

**Policies:**

- Employees can only see their department data
- Supervisors can see department data
- Admins can see all data (with restrictions)
- Service role bypasses RLS for jobs

## Deployment

### Environments

**Development:**

- Local Supabase instance
- Local Redis instance
- Development FUXA URL
- Hot reloading enabled

**Staging:**

- Staging Supabase project
- Staging Redis instance
- Staging FUXA server
- Production-like configuration

**Production:**

- Production Supabase project
- Production Redis cluster
- Production FUXA server
- Optimized builds

### Deployment Process

1. Run database migrations
2. Build Next.js application
3. Deploy to Vercel (or target platform)
4. Configure environment variables
5. Verify health checks
6. Monitor initial performance

## Scalability

### Horizontal Scaling

**Stateless Components:**

- Next.js API routes can be scaled horizontally
- Workers can be added for Inngest jobs
- FUXA can run in cluster mode

**Stateful Components:**

- Supabase: Managed scaling
- Redis: Cluster mode for high availability
- Inngest: Automatic scaling with queue

### Performance Considerations

**Database:**

- Use connection pooling
- Optimize queries with indexes
- Use read replicas for read-heavy workloads

**Caching:**

- Implement Redis cluster for scale
- Use CDN for static assets
- Cache expensive computations

**Real-time:**

- Monitor subscription count
- Optimize subscription queries
- Use batch updates when possible

## Disaster Recovery

### Backup Strategy

**Supabase:**

- Automated daily backups
- Point-in-time recovery (7 days)
- WAL archiving for extended retention

**Redis:**

- AOF persistence enabled
- Regular snapshots
- Cluster replication for HA

**Application:**

- Version-controlled code
- Automated deployment rollback
- Configuration backups

### Recovery Procedures

**Database Recovery:**

1. Identify point of failure
2. Restore from backup or PITR
3. Verify data integrity
4. Resume operations

**Application Recovery:**

1. Deploy to last known good version
2. Verify health checks
3. Monitor for errors
4. Investigate root cause

## Contact Information

- **Development Team:** [Contact details]
- **DevOps Team:** [Contact details]
- **Database Administrator:** [Contact details]
- **SCADA Team:** [Contact details]

## Related Documentation

- **Data Flow Diagrams:** Detailed data flow documentation
- **Caching Strategy:** Cache configuration and management
- **Performance Optimization:** Performance tuning guide
- **Troubleshooting Guide:** Common issues and resolutions

---

**Last Review:** 2026-06-15  
**Next Review:** 2026-09-15 (quarterly)
