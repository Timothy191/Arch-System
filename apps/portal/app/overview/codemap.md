# overview/

**Kind:** page · **Files:** 11

## Responsibility

React Server Component page under the overview route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): AuditReportsSection.tsx, page.tsx, AgenticMonitor.tsx, AuditReportsSection.tsx, BackendArchitecture.tsx, DocumentationMaps.tsx, SystemArchitecture.tsx
- Hooks referenced: useEffect, useState, useEdgesState, useNodesState, useCallback, useMemo
- Exports:
  - `AuditReportsSection.tsx` → AuditReportsSection, default
  - `data.ts` → DEPARTMENTS, TECH_STACK, DATABASE_SCHEMA, BACKEND_SERVICES, BACKEND_CONNECTIONS
  - `page.tsx` → OverviewPage, default
  - `AgenticMonitor.tsx` → AgenticMonitor, default
  - `BackendArchitecture.tsx` → BackendArchitecture, default
  - `DatabaseSchema.tsx` → DatabaseSchema, default
  - `DepartmentBreakdown.tsx` → DepartmentBreakdown, default
  - `DocumentationMaps.tsx` → DocumentationMaps, default
  - `SystemArchitecture.tsx` → SystemArchitecture, default
  - `TechStack.tsx` → TechStack, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: data

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
