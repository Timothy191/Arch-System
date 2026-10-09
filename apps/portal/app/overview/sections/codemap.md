# overview/sections/

**Kind:** module · **Files:** 8

## Responsibility

Supporting module directory for overview/sections.

## Design

- Client components ("use client"): AgenticMonitor.tsx, AuditReportsSection.tsx, BackendArchitecture.tsx, DocumentationMaps.tsx, SystemArchitecture.tsx
- Hooks referenced: useState, useEffect, useEdgesState, useNodesState, useCallback, useMemo
- Exports:
  - `AgenticMonitor.tsx` → AgenticMonitor, default
  - `AuditReportsSection.tsx` → AuditReportsSection, default
  - `BackendArchitecture.tsx` → BackendArchitecture, default
  - `DatabaseSchema.tsx` → DatabaseSchema, default
  - `DepartmentBreakdown.tsx` → DepartmentBreakdown, default
  - `DocumentationMaps.tsx` → DocumentationMaps, default
  - `SystemArchitecture.tsx` → SystemArchitecture, default
  - `TechStack.tsx` → TechStack, default

## Flow

Imported by the parent route; exposes the exports listed above.

- Local imports consumed: data

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
