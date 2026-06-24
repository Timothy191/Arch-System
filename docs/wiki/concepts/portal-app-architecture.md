---
title: Portal App Architecture
created: 2026-05-15
updated: 2026-06-15
type: concept
tags: [architecture, application, design, pattern]
sources: [raw/codebase/portal-app.md]
confidence: high
---

# Portal App Architecture

The portal is a Next.js 15 application using the App Router with React Server Components (RSC) as the default rendering strategy. It sits in `apps/portal/` within the Nx monorepo.

## Tech Stack

| Layer           | Technology                                                     |
| --------------- | -------------------------------------------------------------- |
| Framework       | Next.js 15 (App Router)                                        |
| React           | React 19                                                       |
| Language        | TypeScript                                                     |
| Styling         | Tailwind CSS + CSS variables (light-only theme)                |
| UI Library      | shadcn/ui primitives + custom @repo/ui components              |
| Animations      | framer-motion / motion, tailwindcss-animate, Motion Primitives |
| State           | Zustand 5 (global), React useState / useReducer (local)        |
| Forms           | Zod validation, useState four-state machine                    |
| Maps            | react-map-gl + maplibre-gl                                     |
| 3D              | @react-three/fiber + @react-three/drei                         |
| Tables          | @tanstack/react-table                                          |
| Drag/Drop       | @atlaskit/pragmatic-drag-and-drop                              |
| Rich Text       | novel (Notion-style WYSIWYG)                                   |
| Code Highlight  | shiki (server-side)                                            |
| QR Codes        | qrcode.react                                                   |
| Signatures      | react-signature-canvas                                         |
| Color Picker    | react-colorful                                                 |
| Command Palette | cmdk                                                           |
| Toasts          | sonner                                                         |

## App Router Structure

```
app/
├── (auth)/
│   └── login/           # Supabase Auth login page
├── (hub)/
│   └── page.tsx         # Department grid + productivity tools
├── (departments)/
│   └── [department]/    # Dynamic department routes
│       ├── dashboard/
│       ├── daily-log/
│       ├── machines/
│       ├── history/
│       ├── reports/
│       ├── tools/         # External tools (n8n, Flowise, Univer)
│       ├── hourly-loads/      # Control room only
│       ├── machine-operations/# Control room only
│       ├── operational-delays/# Control room only
│       ├── engineering-notes/ # Control room only
│       ├── excavator-activity/# Control room only
│       ├── roll-over/         # Control room only
│       ├── satellite/         # Control room only
│       ├── breakdowns/        # Engineering only
│       ├── sar/               # Satellite monitoring
│       ├── hyperspectral/     # Satellite monitoring
│       └── highres/           # Satellite monitoring
├── admin/               # Admin panel
├── api/ai/chat         # AI chat endpoint
└── api/tools/status    # External tool health checks
```

## Department Route Configuration

Department metadata and tab definitions are centralized in `lib/departments.ts`:

- **Standard departments**: dashboard, daily-log, machines, history, reports, tools
- **Control Room**: dashboard, hourly-loads, machine-operations, operational-delays, engineering-notes, excavator-activity, roll-over, machines, reports, satellite
- **Engineering**: dashboard, breakdowns, daily-log, machines, history, reports, tools
- **Satellite Monitoring**: overview, sar, hyperspectral, highres
- **Safety**: dashboard, daily-log, machines, history, reports, tools

Adding a department requires: updating `lib/departments.ts`, creating the route folder, and adding a migration to insert the department row.

## Server Components (RSC)

Default rendering strategy. Server components:

- Fetch data directly via `createServerSupabaseClient()`
- Use `getDepartmentContext(params)` to resolve `{ dept, deptId, supabase, today }`
- Use `requireDepartment(slug, allowed)` to guard tabs to specific departments
- Render static content without client-side JavaScript

### getDepartmentContext

```typescript
import { getDepartmentContext } from "@/lib/dept-context";

export default async function Page({ params }: { params: { department: string } }) {
  const { dept, deptId, supabase, today } = await getDepartmentContext(params);
  // ...fetch data
}
```

Validates department slug, fetches UUID from Supabase, calls `notFound()` on invalid departments.

## Server Actions

All mutations use the server actions pattern:

1. Start with `"use server"`
2. Authenticate via `supabase.auth.getUser()`
3. Use `createServerSupabaseClient()` from `@repo/supabase/server`
4. Call `revalidatePath()` after mutations
5. Soft deletes use `deleted_at` timestamp, not row removal
6. Log mutations via `logAuditEvent()` from `@/lib/audit`

Example: [[breakdowns-actions]]

## Client Components

Used for:

- Interactive forms with form state
- Real-time subscriptions (Supabase channels)
- Charts and visualizations
- Drag-and-drop interfaces
- Rich text editors
- 3D visualizations
- Maps

### Client Form Pattern

Four-state machine: `idle` → `submitting` → `success`/`error`

```typescript
const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
```

- Uses `createBrowserSupabaseClient()` for inserts
- Calls `router.refresh()` for revalidation (not `revalidatePath`)
- Auto-detects current shift via `getCurrentShift()`
- Some forms auto-save drafts to localStorage every 30s

## Real-Time Subscriptions

Components like AlertPanel, ScadaPanel, and ControlRoomActivityFeed use:

```typescript
supabase
  .channel()
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "table_name",
      filter: "department_id=eq." + departmentId,
    },
    callback,
  )
  .subscribe();
```

All real-time subscriptions filter by `department_id` to scope data to the user's department.

## Path Aliases

| Alias | Maps to                              |
| ----- | ------------------------------------ |
| `@/`  | `apps/portal/`                       |
| `~/`  | `apps/portal/` (Jest and TypeScript) |

## Shared Packages

| Package        | Purpose                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| @repo/ui       | Shared components (GlassCard, DepartmentLayout, KPI, FormFields, shadcn primitives) |
| @repo/supabase | Client wrappers (browser, server, middleware) and database types                    |
| @repo/theme    | Design tokens, CSS variables, Tailwind preset                                       |
| @repo/hooks    | useLocalStorage, useDebounce                                                        |
| @repo/utils    | cn, formatDate, getCurrentShift, excel utilities                                    |

## Feature Organization

Department-specific logic lives in `features/departments/components/<dept>/`:

- `control-room/` — Control room specific components
- `engineering/` — Breakdowns, machine operations
- `machines/` — Machine management
- `satellite/` — SAR/InSAR, hyperspectral views
- `shared/` — Cross-department components
- `tools/` — External tool embeds, Univer spreadsheet

Hub components are in `features/hub/components/`.

Related pages: [[nx-monorepo]], [[design-system]], [[rls-policy]], [[supabase-local-dev]]
