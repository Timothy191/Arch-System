---
title: "Q: How does authentication work?"
created: 2026-05-15
updated: 2026-05-15
type: query
tags: [how-to, auth, security, quick-reference]
sources:
  [
    wiki/concepts/auth-middleware.md,
    wiki/concepts/rls-policy.md,
    wiki/concepts/supabase-local-dev.md,
  ]
confidence: high
---

# Q: How does authentication work?

## Quick Answer

Arch-Systems uses **Supabase Auth (GoTrue)** with a custom employee linking system.

**Flow**: Sign Up/Login → Supabase Auth → Auto-create Employee → Department Access via RLS

---

## Authentication Flow

### 1. User Signs Up/Login

```
User → /login page → Supabase Auth (GoTrue)
                    ↓
              auth.users table
                    ↓
           JWT token returned
                    ↓
              Cookie set
```

### 2. Employee Record Auto-Created

Supabase trigger `handle_new_user()` fires:

```sql
-- Automatically runs on auth.users insert
INSERT INTO employees (auth_id, department_id, full_name, role)
VALUES (
  NEW.id,                          -- from auth.users
  (SELECT id FROM departments LIMIT 1),  -- default department
  NEW.raw_user_meta_data->>'full_name',
  'operator'                     -- default role
);
```

Result: Every auth user has a corresponding `employees` row.

### 3. JWT in Requests

```
Browser Request
      ↓
Cookie: sb-access-token=eyJ...
      ↓
Middleware (decodes JWT)
      ↓
Department isolation check
      ↓
RLS policies (JWT → user ID)
```

---

## Three Client Contexts

Always import from `@repo/supabase`, never directly:

| Context        | Import                      | Use In                           | Purpose                             |
| -------------- | --------------------------- | -------------------------------- | ----------------------------------- |
| **Browser**    | `@repo/supabase/client`     | `'use client'` components, hooks | Real-time subscriptions, auth state |
| **Server**     | `@repo/supabase/server`     | `page.tsx`, Server Actions       | Data fetching, mutations            |
| **Middleware** | `@repo/supabase/middleware` | `proxy.ts` only                  | Route protection, JWT refresh       |

### Browser Client Example

```typescript
"use client";
import { createClient } from "@repo/supabase/client";

export function AlertPanel() {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        callback,
      )
      .subscribe();
  }, []);
}
```

### Server Client Example

```typescript
// page.tsx (Server Component)
import { createServerSupabaseClient } from "@repo/supabase/server";

export default async function Page() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: machines } = await supabase
    .from("machines")
    .select("*")
    .eq("department_id", employee.department_id);
}
```

### Middleware Example

```typescript
// proxy.ts
import { createMiddlewareClient } from "@repo/supabase/middleware";

export async function proxy(req: NextRequest) {
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
```

---

## Department Isolation

### How It Works

1. User logs in → gets JWT
2. Middleware extracts `auth_id` from JWT
3. Looks up `employees` table for:
   - `department_id` (primary department)
   - `accessible_departments` (additional access)
   - `role` (permissions)
4. RLS policies enforce department-scoped queries

### RLS Policy Example

```sql
-- Users only see machines in their department
CREATE POLICY "Users can view their department's machines"
ON machines FOR SELECT
USING (
  department_id = auth.user_department_id()  -- helper function
  OR auth.is_admin()                           -- admins see all
  OR department_id = ANY(auth.has_department_access())  -- cross-dept access
);
```

### Helper Functions

```sql
-- Get current user's department ID
auth.user_department_id() → UUID

-- Check if admin
auth.is_admin() → BOOLEAN

-- Check cross-department access
auth.has_department_access(target_dept UUID) → BOOLEAN
```

---

## Role-Based Access

### Roles Hierarchy

| Role                    | Description                              |
| ----------------------- | ---------------------------------------- |
| `operator`              | Standard user, can view and create logs  |
| `supervisor`            | Can manage operators, access tools tab   |
| `control_room_operator` | Access to control-room restricted routes |
| `admin`                 | Full access, can manage all departments  |

### Restricted Routes

```typescript
// proxy.ts
const RESTRICTED_ROUTES = {
  "control-room": ["control_room_operator", "admin"],
  tools: ["admin", "supervisor"],
  admin: ["admin"],
};
```

---

## Cross-Department Access

Some users need access to multiple departments without changing their primary:

```sql
-- Add accessible_departments array
UPDATE employees
SET accessible_departments = ARRAY[
  (SELECT id FROM departments WHERE name = 'engineering'),
  (SELECT id FROM departments WHERE name = 'safety')
]
WHERE auth_id = 'user-uuid';
```

Now user can view engineering and safety data while remaining in their primary department.

---

## Debugging Auth Issues

### Check Auth State

```typescript
// In browser console
const {
  data: { user },
} = await supabase.auth.getUser();
console.log("User:", user);

// Check employee record
const { data: employee } = await supabase
  .from("employees")
  .select("*")
  .eq("auth_id", user.id)
  .single();
console.log("Employee:", employee);
```

### Check Department Access

```sql
-- In Supabase SQL Editor
SELECT auth.user_department_id();  -- Should return UUID
SELECT auth.is_admin();             -- Should return true/false
```

### Common Issues

| Symptom            | Cause            | Fix                                      |
| ------------------ | ---------------- | ---------------------------------------- |
| Infinite redirects | Middleware loop  | Check `handle_new_user()` trigger exists |
| Empty data         | RLS blocking     | Check `employees` row exists for user    |
| 403 Forbidden      | Wrong role       | Update `employees.role` in database      |
| Wrong department   | Department cache | Restart dev server (60s cache)           |

---

## Security Best Practices

1. **Never use service role in client** — Only server components
2. **Always enable RLS** — Every new table must have RLS
3. **Soft deletes only** — Use `deleted_at` timestamp, never `DELETE`
4. **Validate in middleware** — Auth checks at edge, not just client
5. **Short-lived tokens** — Supabase handles refresh automatically

---

## Related

- [[auth-middleware]] — Detailed middleware logic
- [[rls-policy]] — RLS standards and patterns
- [[database-schema]] — Employee table structure
- [[troubleshooting]] — Common auth issues
