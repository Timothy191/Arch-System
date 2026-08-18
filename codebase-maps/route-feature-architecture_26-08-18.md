# Route & Feature Architecture Map

**Generated:** 2026-08-18  
**System:** Arch-System Mining Operations Portal

## Overview

This map details the complete route structure, feature organization, and authentication flow for the portal application.

## Visual Overview

### Route Structure Overview

```mermaid
graph TD
    ROOT[/] --> HUB[/hub]
    ROOT --> AUTH[(auth)]
    ROOT --> DEPT[(departments)]
    ROOT --> DOCS[docs]
    ROOT --> ADMIN[/admin]
    ROOT --> OFFLINE[/offline]
    ROOT --> PRIVACY[/privacy]

    AUTH --> LOGIN[/login]
    AUTH --> RESET[/reset-password]
    AUTH --> UPDATE[/update-password]

    DEPT --> DYNAMIC[[department]]
    DEPT --> ACCESS[/access-control]
    DEPT --> CARD[/access-card-actions]
    DEPT --> DRILL[/drilling]
    DEPT --> TRAIN[/training]
    DEPT --> ENG[/engineering]

    DYNAMIC --> DASH[dashboard]
    DYNAMIC --> LOG[daily-log]
    DYNAMIC --> MACH[machines]
    DYNAMIC --> HIST[history]
    DYNAMIC --> REP[reports]
    DYNAMIC --> TOOLS[tools]

    DOCS --> API[/docs/api]

    style ROOT fill:#e1f5ff
    style HUB fill:#fff4e1
    style AUTH fill:#e8f5e9
    style DEPT fill:#f3e5f5
    style DOCS fill:#ffebee
    style ADMIN fill:#fdcb6e
    style OFFLINE fill:#dfe6e9
    style PRIVACY fill:#dfe6e9
```

### Route Distribution by Group

```mermaid
pie title Route Distribution by Group
    "Departments" : 40
    "API Routes" : 35
    "Authentication" : 10
    "Hub & Admin" : 10
    "Documentation" : 5
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Middleware
    participant Redis
    participant Supabase
    participant Portal

    User->>Middleware: Request
    Middleware->>Middleware: Check auth-exempt routes
    alt Auth-Exempt Route
        Middleware->>Portal: Allow access
    else Protected Route
        Middleware->>Redis: Check department cache
        alt Cache Hit
            Redis-->>Middleware: Department UUID
        else Cache Miss
            Middleware->>Supabase: Fetch department
            Supabase-->>Middleware: Department UUID
            Middleware->>Redis: Cache department
        end
        Middleware->>Middleware: Validate role access
        Middleware->>Portal: Allow/Deny access
    end
```

## 1. Authentication & Middleware Flow

### Custom Proxy Middleware

**File:** `apps/portal/server/proxy.ts`

**Auth-Exempt Routes:**

- `/api/c66` - Badge scanner validation (hardware integration)
- `/api/health/*` - Health check endpoints
- `/api/metrics` - Prometheus metrics
- `/reset-password` - Password reset flow
- `/update-password` - Password update flow

**Static File Exemptions:**

- Images, fonts, PWA manifest, robots.txt, sitemap.xml

**Department Isolation:**

- Validates user access to department routes via `DEPARTMENT_ROUTES`
- Department UUID resolution with Redis caching
- Admin bypass for department access

**Role-Based Access Control:**

```mermaid
graph TD
    ADMIN[admin<br/>Full Access]
    SUPERVISOR[supervisor<br/>Dept Management]
    OPERATOR[operator<br/>Operations]
    ACCESS_CTRL[access_control<br/>Security]
    CTRL_ROOM[control_room_operator<br/>SCADA]

    ADMIN -->|Can Access| ACCESS[access-control]
    ADMIN -->|Can Access| CTRL[control-room]
    ADMIN -->|Can Access| TOOLS[tools]
    ADMIN -->|Can Access| ADMIN_ROUTE[admin]
    ADMIN -->|Can Access| CARD[access-card-actions]

    SUPERVISOR -->|Can Access| ACCESS
    SUPERVISOR -->|Can Access| CTRL
    SUPERVISOR -->|Can Access| TOOLS
    SUPERVISOR -->|Can Access| CARD

    OPERATOR -->|Can Access| ACCESS
    OPERATOR -->|Can Access| CTRL
    OPERATOR -->|Can Access| CARD

    ACCESS_CTRL -->|Can Access| ACCESS
    ACCESS_CTRL -->|Can Access| CARD

    CTRL_ROOM -->|Can Access| CTRL
    CTRL_ROOM -->|Can Access| CARD

    style ADMIN fill:#ff6b6b
    style SUPERVISOR fill:#4ecdc4
    style OPERATOR fill:#45b7d1
    style ACCESS_CTRL fill:#fd79a8
    style CTRL_ROOM fill:#a29bfe
    style ACCESS fill:#ffeaa7
    style CTRL fill:#81ecec
    style TOOLS fill:#74b9ff
    style ADMIN_ROUTE fill:#ff6b6b
    style CARD fill:#00cec9
```

**Security Features:**

- Server-side redirect validation (allowlist)
- Role normalization (defaults to "operator")
- Login flow optimization (short-circuits Supabase for unauthenticated)

---

## 2. Route Group Structure

### Root Layout

**File:** `apps/portal/app/layout.tsx`

- Global layout with ArchThemeProvider, RouteBackground, MacMenuBar
- PWA manifest, viewport configuration
- Font loading: Inter, JetBrains Mono, Outfit
- Speculation rules for prerendering department routes

### Route Group: `(auth)` - Authentication

**Layout:** `apps/portal/app/(auth)/layout.tsx`

- Purpose: Unauthenticated user flows
- Routes:
  - `/login` - Login page
  - `/reset-password` - Password reset flow
  - `/update-password` - Password update flow

### Route Group: `(departments)` - Department Routes

#### Dynamic Department Layout

**File:** `apps/portal/app/(departments)/[department]/layout.tsx`

- Handles all department routes via dynamic `[department]` parameter
- Validates department exists in DEPARTMENTS constant
- Provides department-specific tabs via `getDepartmentTabs()`

**Standard Department Routes** (drilling, production, engineering, safety, training):

```mermaid
graph TD
    DEPT[[department]] --> DASH[dashboard]
    DEPT --> LOG[daily-log]
    DEPT --> MACH[machines]
    DEPT --> HIST[history]
    DEPT --> REP[reports]
    DEPT --> TOOLS[tools<br/>Admin/Supervisor]

    style DEPT fill:#f3e5f5
    style DASH fill:#e1f5ff
    style LOG fill:#fff4e1
    style MACH fill:#e8f5e9
    style HIST fill:#ffebee
    style REP fill:#fdcb6e
    style TOOLS fill:#a29bfe
```

**Control Room Specific Routes** (`/control-room`):

```mermaid
graph TD
    CR[control-room] --> CR_DASH[dashboard]
    CR --> CR_LOAD[hourly-loads]
    CR --> CR_OPS[machine-operations]
    CR --> CR_NOTES[engineering-notes]
    CR --> CR_EXCAV[excavator-activity]
    CR --> CR_REP[reports]

    style CR fill:#ff6b6b
    style CR_DASH fill:#e1f5ff
    style CR_LOAD fill:#fff4e1
    style CR_OPS fill:#e8f5e9
    style CR_NOTES fill:#f3e5f5
    style CR_EXCAV fill:#ffebee
    style CR_REP fill:#fdcb6e
```

**Engineering Specific Routes** (`/engineering`):

```mermaid
graph TD
    ENG[engineering] --> ENG_DASH[dashboard]
    ENG --> ENG_BREAK[breakdowns]
    ENG --> ENG_TIRE[tire-management]
    ENG --> ENG_LOG[daily-log]
    ENG --> ENG_MACH[machines]
    ENG --> ENG_HIST[history]
    ENG --> ENG_REP[reports]
    ENG --> ENG_TOOLS[tools]

    style ENG fill:#4ecdc4
    style ENG_DASH fill:#e1f5ff
    style ENG_BREAK fill:#ffebee
    style ENG_TIRE fill:#fff4e1
    style ENG_LOG fill:#e8f5e9
    style ENG_MACH fill:#f3e5f5
    style ENG_HIST fill:#fdcb6e
    style ENG_REP fill:#a29bfe
    style ENG_TOOLS fill:#74b9ff
```

**Satellite Monitoring Specific Routes** (`/satellite-monitoring`):

```mermaid
graph TD
    SAT[satellite-monitoring] --> SAT_DASH[dashboard]
    SAT --> SAT_SAR[sar<br/>SAR/InSAR]
    SAT --> SAT_HYPER[hyperspectral]
    SAT --> SAT_HIGH[highres]

    style SAT fill:#fd79a8
    style SAT_DASH fill:#e1f5ff
    style SAT_SAR fill:#fff4e1
    style SAT_HYPER fill:#e8f5e9
    style SAT_HIGH fill:#f3e5f5
```

**Drilling Specific Routes** (`/drilling`):

```mermaid
graph TD
    DRILL[drilling] --> DRILL_DASH[dashboard]
    DRILL --> DRILL_OPS[drilling-operations]
    DRILL --> DRILL_TELEM[machine-telemetry]
    DRILL --> DRILL_REP[reports]

    style DRILL fill:#a29bfe
    style DRILL_DASH fill:#e1f5ff
    style DRILL_OPS fill:#fff4e1
    style DRILL_TELEM fill:#e8f5e9
    style DRILL_REP fill:#fdcb6e
```

**Additional Department Pages:**

- `/[department]/breakdowns` - Breakdown tracking
- `/[department]/shift-coverage` - Shift coverage management
- `/[department]/roll-over` - Dozer roll form
- `/[department]/operational-delays` - Operational delays

#### Specialized Department Layouts

**Access Control** (dedicated layout):
**File:** `apps/portal/app/(departments)/access-control/layout.tsx`

```
/access-control
├── /                    - Dashboard
├── /access-logs         - Access logs
├── /badges              - Badge management
├── /visitors            - Visitor management
└── /reports             - Reports
```

**Access Card Actions** (dedicated layout):
**File:** `apps/portal/app/(departments)/access-card-actions/layout.tsx`

```
/access-card-actions
├── /                    - Dashboard
├── /card-actions        - Card actions
├── /print-cards         - Print cards
├── /qr-codes            - QR codes
└── /reports             - Reports
```

**Drilling** (dedicated layout):
**File:** `apps/portal/app/(departments)/drilling/layout.tsx`

```
/drilling
├── /                    - Dashboard
├── /drilling-operations  - Drilling operations
├── /machine-telemetry    - Machine telemetry
└── /reports              - Reports
```

**Training** (dedicated layout):
**File:** `apps/portal/app/(departments)/training/layout.tsx`

```
/training
├── /                    - Overview
├── /certifications      - Certifications
├── /courses             - Courses & LMS
├── /schedules           - Schedules
└── /reports             - Reports
```

**Engineering** (dedicated layout):
**File:** `apps/portal/app/(departments)/engineering/layout.tsx`

```
/engineering
├── /                    - Dashboard
└── /tire-management     - Tire management
```

### Route Group: `hub` - Central Dashboard

**Layout:** `apps/portal/app/hub/layout.tsx`

- Auth-protected layout with mobile bottom navigation
- Fetches accessible departments for user
- Routes:
  - `/hub` - Main hub/dashboard (default redirect from `/`)
  - `/hub/executive` - Executive view

### Route Group: `docs` - Documentation

**Layout:** `apps/portal/app/docs/layout.tsx`

- Role-restricted: admin and engineering roles only
- Routes:
  - `/docs/api` - API documentation

### Top-Level Routes

- `/` - Redirects to `/hub`
- `/admin` - Admin dashboard (admin role only)
- `/offline` - Offline page
- `/privacy` - Privacy policy

---

## 3. API Routes Structure

### Authentication

**File:** `apps/portal/app/api/auth/login/route.ts`

- `POST /api/auth/login` - User authentication
  - Rate limiting: 5 req/15min
  - CSRF protection

### Hardware Integration

**File:** `apps/portal/app/api/c66/route.ts`

- `POST /api/c66` - Badge scanner validation
  - Auth-exempt
  - Requires scanner token

### Health & Monitoring

```
/api/health
├── /                    - Overall health check (DB + Redis)
├── /cache               - Cache health
├── /fuxa                - FUXA SCADA health
├── /live                - Live status
├── /redis               - Redis health
├── /supabase-realtime   - Supabase Realtime health
└── /warmup              - Warmup endpoint
```

### Metrics

**File:** `apps/portal/app/api/metrics/route.ts`

- `GET /api/metrics` - Prometheus metrics (cache, Inngest jobs, DB queries)
- `GET /api/metrics/prometheus` - Prometheus endpoint

### Telemetry

**File:** `apps/portal/app/api/telemetry/push/route.ts`

- `POST /api/telemetry/push` - Push telemetry to FUXA SCADA
  - Two-level caching

### Export Endpoints

```
/api/export
├── /fuel-logs           - Export fuel logs
├── /machines            - Export machine data
├── /production          - Export production data (JSON/CSV)
└── /safety-incidents    - Export safety incidents
```

### Webhooks

**File:** `apps/portal/app/api/webhooks/route.ts`

```
/api/webhooks
├── GET /                - List webhook endpoints
├── POST /               - Create webhook endpoint
├── GET /[id]            - Get specific webhook
├── POST /[id]           - Update webhook
├── DELETE /[id]         - Delete webhook
└── GET /[id]/logs       - Webhook delivery logs
```

### Admin & Data Access

- `GET /api/admin/data/[table]` - Generic admin data access

### Other API Routes

- `POST /api/control-room/shift-completeness` - Shift completeness check
- `POST /api/csp-violations` - CSP violation reporting
- `GET /api/doc` - Documentation
- `POST /api/feedback` - Feedback submission
- `POST /api/inngest` - Inngest webhook handler
- `POST /api/log` - Logging endpoint
- `POST /api/ml/predictive-maintenance` - ML predictive maintenance
- `POST /api/plugins/rust-telemetry` - Rust telemetry plugin
- `GET /api/printers` - List printers
- `GET /api/printers/[id]` - Get printer details
- `POST /api/printers/scan` - Scan for printers
- `POST /api/sync/playback` - Playback sync events
- `GET /api/tools/status` - Tools status
- `GET /api/weather` - Weather data

---

## 4. Department Configuration

**Source:** `libs/features/departments/data-access/src/departments.ts`

### DEPARTMENTS Array (10 departments)

1. **drilling** - Drill rig operations & bit depth telemetry
2. **production** - Coal yield, tonnage & extraction tracking
3. **access-control** - Site access, badging & security
4. **access-card-actions** - Manage printed badges, print cards & QR generation
5. **engineering** - Equipment specs, maintenance & CAD
6. **control-room** - SCADA systems & real-time monitoring
7. **safety** - Incident logs, compliance & inspections
8. **training** - LMS, certifications & competency tracking
9. **satellite-monitoring** - SAR/InSAR, hyperspectral & high-resolution imagery
10. **admin** - Personnel management, shift oversight & quotas

### Tab Configurations

**DEPARTMENT_TABS** (Standard):

- dashboard, daily-log, machines, history, reports, tools

**CONTROL_ROOM_TABS**:

- dashboard, hourly-loads, machine-operations, engineering-notes, excavator-activity, reports

**ENGINEERING_TABS**:

- dashboard, breakdowns, tire-management, daily-log, machines, history, reports, tools

**SATELLITE_MONITORING_TABS**:

- dashboard, sar, hyperspectral, highres

**DRILLING_TABS**:

- dashboard, drilling-operations, machine-telemetry, reports

**ACCESS_CONTROL_TABS**:

- dashboard, access-logs, visitors, badges, reports

**ACCESS_CARD_ACTIONS_TABS**:

- dashboard, card-actions, print-cards, qr-codes, reports

**TRAINING_TABS**:

- dashboard, certifications, courses, schedules, reports

---

## 5. Route Protection Logic

### Middleware Level (server/proxy.ts)

- Department isolation via `DEPARTMENT_ROUTES` check
- Role-based access via `RESTRICTED_ROUTES`
- Admin bypass for department access
- Department UUID resolution with Redis caching

### Layout Level

- **Hub layout:** Fetches accessible departments, redirects unauthorized to login
- **Docs layout:** Role check (admin/engineering only)
- **Admin page:** Role check (admin only) in page component

### Page Level

- Department context validation via `getDepartmentContext()` in `apps/portal/lib/dept-context.ts`
- `requireDepartment()` for department-specific tabs

---

## 6. Key Utility Functions

**File:** `apps/portal/lib/dept-context.ts`

- `getDepartmentContext()` - Resolves department context with Redis caching
- `requireDepartment()` - Validates department access for specific tabs

**File:** `apps/portal/lib/tools.ts`

- `getTools()` - Fetches productivity tools from database
- `EXTERNAL_TOOLS` - External tool configurations (n8n, Flowise)

---

## 7. Role Hierarchy & Permissions

```
admin (highest)
├── Full system access
├── All departments
├── Admin tools
└── Can manage users

supervisor
├── Department management
├── Tools access
├── Reports access
└── Shift oversight

operator
├── Department operations
├── Data entry
├── Reports (view only)
└── Limited tools

access_control
├── Access control system
├── Badge management
├── Visitor management
└── Access logs

control_room_operator
├── Control room operations
├── SCADA monitoring
├── Machine operations
└── Load tracking
```

---

## 8. Feature Organization by Domain

### Access Control

- Personnel management
- Badge printing and QR generation
- Visitor tracking
- Access logs and gate monitoring
- Role-based access control

### Operations

- Machine operations tracking
- Hourly load monitoring
- Excavator activity
- Dozer roll tracking
- Shift management

### Engineering

- Equipment breakdowns
- Tire management
- Maintenance scheduling
- Engineering notes
- CAD integration

### Drilling

- Drill operations logging
- Machine telemetry
- Bit depth tracking
- Production delays
- Performance metrics

### Safety

- Incident reporting
- Compliance tracking
- Safety inspections
- Risk assessment
- Training records

### Training

- LMS integration
- Certification tracking
- Course management
- Competency assessment
- Schedule management

### Satellite Monitoring

- SAR/InSAR imagery
- Hyperspectral data analysis
- High-resolution imagery
- Remote sensing
- Change detection

### Analytics & Reporting

- Production reports
- Safety reports
- Equipment utilization
- Shift completeness
- Executive dashboards

---

## Summary

The portal uses a sophisticated route architecture with:

- **10 departments** with specialized tab configurations
- **Dynamic routing** via `[department]` parameter for standard departments
- **Dedicated layouts** for specialized departments (access-control, drilling, training, engineering)
- **Middleware authentication** with department isolation and role-based access
- **34+ API endpoints** covering auth, telemetry, exports, webhooks, health checks
- **Route groups** for logical separation: `(auth)`, `(departments)`, `hub`, `docs`
- **Role-based protection** at middleware, layout, and page levels
- **Redis caching** for department UUID lookups and employee data
- **Auth-exempt routes** for hardware integration and health monitoring
