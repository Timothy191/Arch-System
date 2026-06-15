---
title: Auth and Middleware
created: 2026-05-15
updated: 2026-05-15
type: concept
tags: [security, policy, system, concept]
sources: [raw/codebase/auth-middleware.md]
confidence: high
---

# Auth and Middleware

The portal uses Supabase Auth with Row Level Security (RLS) for all data access. Department isolation is enforced at the middleware, database, and real-time subscription layers.

## Auth Flow

1. User signs up via Supabase Auth (email/password, OAuth)
2. Auth trigger `handle_new_user()` auto-creates `employees` row
3. Employee defaults to `role = 'operator'` and `department_id = null`
4. Admin assigns department via admin panel
5. User logs in and is redirected to the hub

## Client Contexts

Three Supabase client contexts — always import from `@repo/supabase`, never directly from `@supabase/supabase-js`:

| Context    | Import                      | Use For                                           |
| ---------- | --------------------------- | ------------------------------------------------- |
| Browser    | `@repo/supabase/client`     | Client components, forms, real-time subscriptions |
| Server     | `@repo/supabase/server`     | React Server Components, Server Actions           |
| Middleware | `@repo/supabase/middleware` | Next.js middleware only                           |

## Proxy (`proxy.ts`)

Enforces two layers of protection:

### 1. Authentication

Unauthenticated users redirect to `/login`.

### 2. Department Authorization

Department routes check:

- Employee role and department membership
- `accessible_departments` array for cross-department access
- Admin bypass for all departments

**Critical**: Never commit changes that bypass the unauthenticated redirect without explicit security review.

## RLS Policy Standard

Every operational table follows the same pattern:

```sql
CREATE POLICY "table_select_department"
  ON table FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR e.department_id = table.department_id
          OR table.department_id = ANY(e.accessible_departments)
        )
    )
  );
```

### Role-Based Access

| Role         | Permissions                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `admin`      | Full access to all departments and admin panel                                                                  |
| `supervisor` | Read/write within department. Can INSERT/UPDATE machines, operators, sites. Can update any record they created. |
| `operator`   | Read within department. Can INSERT daily logs, breakdowns, incidents. Can update own records.                   |

### Cross-Department Access

`employees.accessible_departments` (UUID array) allows users to view data in multiple departments without changing their primary `department_id`. Checked in all RLS policies via `department_id = ANY(e.accessible_departments)`.

## Auth Helpers

Security definer functions in `public` schema:

| Function                              | Returns | Purpose                                       |
| ------------------------------------- | ------- | --------------------------------------------- |
| `auth.user_department_id()`           | UUID    | Current user's primary department             |
| `auth.is_admin()`                     | BOOLEAN | Whether user has admin role                   |
| `auth.has_department_access(dept_id)` | BOOLEAN | Whether user can access a specific department |

All functions use `SECURITY DEFINER` with `SET search_path = public`.

## Server Action Auth Pattern

Every server action authenticates before any database operation:

```typescript
"use server";

export async function someAction(departmentId: string, input: SomeInput) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Verify department access
  const { data: employee } = await supabase
    .from("employees")
    .select("role, department_id, accessible_departments")
    .eq("auth_id", user.id)
    .single();

  // Proceed with operation
}
```

## Audit Logging

All authenticated mutations are logged to `audit_logs`. See [[monitoring-error-tracking]] for details.

## Local Dev RLS

For local development, `scripts/local-deploy.sh` disables RLS on all tables after applying migrations:

```sql
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;
```

This simplifies local testing but means local dev does not enforce RLS. Always test RLS policies against a staging instance before deploying.

Related pages: [[rls-policy]], [[database-schema]], [[portal-app-architecture]], [[supabase-local-dev]]
