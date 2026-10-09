# apps/portal/app/

**Kind:** api-route · **Files:** 113 (+51 test)

## Responsibility

Next.js App Router route handler serving `POST, GET, PUT, DELETE, PATCH` requests.
Route handlers own the HTTP contract: request parsing (Zod), authorization, rate limiting,
and JSON response shaping. Business logic stays in `lib/` or packages; no DB access from client components.

## Design

- HTTP methods: POST, GET, PUT, DELETE, PATCH
- Client components ("use client"): ClientProviders.tsx, ReactQueryProvider.tsx, ServiceWorkerRegister.tsx, error.tsx, page.tsx, page.tsx, page.tsx, error.tsx, global-error.tsx, error.tsx, ReloadButton.tsx, AuditReportsSection.tsx, page.tsx, AgenticMonitor.tsx, AuditReportsSection.tsx, BackendArchitecture.tsx, DocumentationMaps.tsx, SystemArchitecture.tsx
- Hooks referenced: useEffect, useState, useEdgesState, useNodesState, useCallback, useMemo
- Database tables touched: documents, employees, audit_logs, ai_token_usage, badges, personnel, visitors, fleet, equipment, access_logs, machines, operators, sites, machine_operations, daily_logs, departments, tires, tire_inspections, breakdowns, card_printers, machine_telemetry, webhook_endpoints, webhook_delivery_logs
- Exports:
  - `ClientProviders.tsx` → ClientProviders, default
  - `ReactQueryProvider.tsx` → ReactQueryProvider
  - `ServiceWorkerRegister.tsx` → ServiceWorkerRegister
  - `vector-search.ts` → searchBreakdownDiagnosticsAction, searchShiftIntelligenceAction, indexBreakdownAction, indexShiftNoteAction
  - `actions.ts` → logout, speculativeEmbedShiftLog, revalidateRSC, generateMonthlyReport
  - `page.tsx` → PrivacyPage, metadata, default
  - `error.tsx` → HubError, default
  - `layout.tsx` → RootLayout, metadata, viewport, default
  - `loading.tsx` → RootLoading, default
  - `route.ts` → GET
  - `swagger-ui-react.d.ts` → SwaggerUI, default
  - `global-error.tsx` → GlobalError, default
  - `not-found.tsx` → NotFound, default
  - `ReloadButton.tsx` → ReloadButton, default
  - `AuditReportsSection.tsx` → AuditReportsSection, default
  - `data.ts` → DEPARTMENTS, TECH_STACK, DATABASE_SCHEMA, BACKEND_SERVICES, BACKEND_CONNECTIONS
  - `AgenticMonitor.tsx` → AgenticMonitor, default
  - `BackendArchitecture.tsx` → BackendArchitecture, default
  - `DatabaseSchema.tsx` → DatabaseSchema, default
  - `DepartmentBreakdown.tsx` → DepartmentBreakdown, default
  - `DocumentationMaps.tsx` → DocumentationMaps, default
  - `SystemArchitecture.tsx` → SystemArchitecture, default
  - `TechStack.tsx` → TechStack, default

## Flow

Request → auth check → rate limit → parse body/params → validate (Zod) → execute (queue/RPC/service) → JSON response.
Errors are logged via `logError` and surfaced as structured JSON, never as silent 2xx.

- Local imports consumed: ReactQueryProvider, ClientProviders, ServiceWorkerRegister, ReloadButton, data

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Consumed by the portal UI and/or the n8n workflow dispatcher (BullMQ `n8n-workflow-queue`).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
