---
name: api-guidelines
description: Architecture, validation, error handling, and authorization rules for Next.js App Router API routes and server actions.
paths:
  - "apps/portal/app/api/**/*.{ts,js}"
  - "apps/portal/lib/actions/**/*.{ts,js}"
  - "packages/contract/src/**/*.{ts,js}"
---

# API & Route Handler Development Rules

## 1. Input & Payload Validation

- All incoming payloads must be strictly validated against canonical Zod schemas from `@repo/contract`.
- Never trust client headers or parameters without explicit schema parsing (`schema.safeParse(body)`).
- On validation failure, return a structured `ValidationError` with HTTP 400.

## 2. Authorization & Tenant Isolation

- Verify session authentication on line 1 of every protected handler using `createRouteHandlerSupabaseClient()` or `createServerSupabaseClient()`.
- Explicitly check user permissions against `public.employees` table (`role`, `department_id`, and `accessible_departments`).
- Never perform queries bypassing RLS unless running an explicit service-role background migration.

## 3. Standardized Response & Error Contracts

- Route handlers must return standard JSON response envelopes:

  ```typescript
  // Success
  return NextResponse.json({ success: true, data: result, timestamp: Date.now() });

  // Error
  return NextResponse.json(
    {
      success: false,
      error: appError.message,
      code: appError.code,
      details: appError.details || null,
    },
    { status: appError.statusCode || 500 },
  );
  ```

- Catch and handle all errors using `isAppError(err)`. Never return unhandled generic 500 stack traces to the client.
