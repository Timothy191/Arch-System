# Requirements: Vercel React Best Practices Refinement (EARS Notation)

## 1. Server Actions Response & Error Handling

- **REQ-SA-01**: _WHEN_ an unauthenticated client invokes any Server Action _THE SYSTEM SHALL_ return a typed failure response `{ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }` without throwing unhandled server exceptions.
- **REQ-SA-02**: _WHEN_ an unauthorized role attempts to invoke `generateMonthlyReport` _THE SYSTEM SHALL_ return `{ success: false, error: "Forbidden: insufficient permissions", code: "FORBIDDEN" }`.
- **REQ-SA-03**: _WHEN_ invalid payload parameters are submitted to a Server Action _THE SYSTEM SHALL_ catch Zod schema validation errors and return `{ success: false, error: string, code: "VALIDATION_ERROR" }`.
- **REQ-SA-04**: _WHEN_ a Server Action executes successfully _THE SYSTEM SHALL_ return `{ success: true, ...data }` conforming to the server action response contract.
- **REQ-SA-05**: _WHEN_ `logout` is invoked _THE SYSTEM SHALL_ sign out from Supabase and perform `redirect("/login")` (preserving Next.js standard redirect behavior).

## 2. Dynamic Widget Consolidation

- **REQ-WIDGET-01**: _WHEN_ a control room department dashboard renders _THE SYSTEM SHALL_ load the control room widgets (`ScadaPanel`, `AlertPanel`, `ControlRoomActivityFeed`, `ControlRoomChecklistWidget`, `ShiftCoverageSectionClient`) through a consolidated feature component boundary.
- **REQ-WIDGET-02**: _WHEN_ any individual widget is loading or resolving its bundle _THE SYSTEM SHALL_ display fluid pulse skeletons with light-mode token styling (`bg-[var(--bg-tertiary)]`).
- **REQ-WIDGET-03**: _WHEN_ a non-control room department dashboard renders _THE SYSTEM SHALL_ exclude all control room widget chunks from the client bundle.

## 3. Monorepo Quality & Invariant Standards

- **REQ-QA-01**: _WHEN_ `pnpm --filter portal test` or `pnpm type-check` is executed _THE SYSTEM SHALL_ pass 100% of test suites and type checks without TypeScript errors or `@ts-ignore` suppressions.
- **REQ-QA-02**: _WHEN_ UI elements are rendered _THE SYSTEM SHALL_ strictly adhere to light-mode styling invariants (`#f3f4f6` background luminance > 200) and OKLCH design tokens.
