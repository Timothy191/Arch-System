---
title: "Q: Why is my query returning empty/no data?"
created: 2026-05-15
updated: 2026-05-15
type: query
tags: [troubleshooting, rls, database, quick-reference]
sources:
  [
    wiki/concepts/rls-policy.md,
    wiki/concepts/troubleshooting.md,
    wiki/concepts/database-schema.md,
  ]
confidence: high
---

# Q: Why is my query returning empty/no data?

## Quick Diagnostic Checklist

Run through these in order (90% of issues resolved by #3):

```
□ 1. Is data actually in the database?
□ 2. Is RLS enabled on the table?
□ 3. Does the user have an employees row?
□ 4. Is the department_id correct?
□ 5. Are RLS policies correct?
□ 6. Is the user authenticated?
□ 7. Is accessible_departments set (if cross-dept)?
```

---

## Step-by-Step Diagnosis

### Step 1: Verify Data Exists

In Supabase Studio or SQL Editor:

```sql
-- Check if data exists at all
SELECT * FROM machines LIMIT 5;

-- Check if data exists for specific department
SELECT * FROM machines WHERE department_id = 'dept-uuid-here';

-- Count total rows
SELECT COUNT(*) FROM machines;
```

**If no data**: You need to seed data first, not an RLS issue.

---

### Step 2: Check RLS is Enabled

```sql
-- Check if RLS is enabled on the table
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'machines';

-- Expected: relrowsecurity = true
-- If false: ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
```

**If RLS not enabled**: Enable it and create policies.

---

### Step 3: Check User Has Employees Row (MOST COMMON)

This is the #1 cause of empty queries!

In your app code (debugging):

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
console.log("Auth user:", user?.id);

const { data: employee } = await supabase
  .from("employees")
  .select("*")
  .eq("auth_id", user?.id)
  .single();

console.log("Employee record:", employee);
console.log("Department ID:", employee?.department_id);
console.log("Role:", employee?.role);
```

In SQL:

```sql
-- Check if employees row exists for auth user
SELECT * FROM employees
WHERE auth_id = 'user-auth-id-here';

-- If empty, the trigger didn't fire or was deleted
-- Fix: Insert manually or check trigger
```

**Fix**: If no employee row:

```sql
INSERT INTO employees (auth_id, department_id, full_name, role)
VALUES (
  'user-auth-id',
  (SELECT id FROM departments WHERE name = 'production'),
  'User Name',
  'operator'
);
```

---

### Step 4: Verify Department ID Match

```sql
-- Get user's department
SELECT auth.user_department_id();

-- Check if machines exist for that department
SELECT * FROM machines
WHERE department_id = auth.user_department_id();
```

**Common issue**: User's `department_id` doesn't match any machine's `department_id`.

---

### Step 5: Test RLS Policy Directly

```sql
-- Test the exact policy condition
SELECT * FROM machines
WHERE department_id = auth.user_department_id()
   OR auth.is_admin()
   OR department_id = ANY(auth.has_department_access());

-- If this returns data but app doesn't, check:
-- 1. Is the user actually authenticated in the app?
-- 2. Is the JWT token valid?
-- 3. Is middleware setting the session correctly?
```

---

### Step 6: Bypass RLS for Testing (Service Role)

**⚠️ Only for debugging, never in production code!**

```typescript
// Create service role client (bypasses all RLS)
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-only!
);

// Test if data exists without RLS
const { data } = await serviceClient.from("machines").select("*");

console.log("All machines (no RLS):", data);
```

If service role returns data but normal client doesn't → **RLS issue confirmed**.

---

### Step 7: Check accessible_departments (Cross-Department)

If user needs access to multiple departments:

```sql
-- Check user's accessible_departments
SELECT accessible_departments FROM employees WHERE auth_id = 'user-id';

-- Should return array like: {uuid1, uuid2}

-- Check if machine's department is in that array
SELECT * FROM machines
WHERE department_id = ANY(
  SELECT accessible_departments
  FROM employees
  WHERE auth_id = 'user-id'
);
```

---

## Common Scenarios & Fixes

### Scenario A: "It worked yesterday, now returns empty"

**Possible causes**:

- Employee record was deleted
- User changed departments
- RLS policy was modified

**Fix**:

```sql
-- Re-create employee row if missing
SELECT * FROM handle_new_user();
-- Or insert manually
```

### Scenario B: "Admin can see data, operator can't"

**Check**: Admin uses `auth.is_admin()` in policy, operator doesn't meet other conditions.

**Fix**: Verify operator's department_id matches data's department_id.

### Scenario C: "Works in local dev, fails in production"

**Possible causes**:

- Migrations not applied to production
- RLS enabled in prod but not local
- Different seed data

**Fix**:

```bash
# Check production migration status
cd packages/database
pnpm supabase migration list

# Push missing migrations
pnpm supabase:push
```

### Scenario D: "Query was working, now hangs/timeout"

**Possible causes**:

- Missing index on department_id
- Too many rows being scanned
- Connection pool exhausted

**Fix**:

```sql
-- Add index if missing
CREATE INDEX idx_machines_department_id ON machines(department_id);

-- Check connection count
SELECT count(*) FROM pg_stat_activity;
```

---

## Debugging Template

Add this to your component/page for debugging:

```typescript
async function debugDataFetching(supabase: any) {
  // 1. Auth status
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("1. Auth user:", user?.id ?? "NOT AUTHENTICATED");

  // 2. Employee record
  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_id", user?.id)
    .single();
  console.log("2. Employee:", employee ?? "NO EMPLOYEE ROW");

  // 3. Department access
  console.log("3. Department ID:", employee?.department_id);
  console.log("4. Accessible departments:", employee?.accessible_departments);

  // 5. RLS test query
  const { data: testData, error } = await supabase
    .from("machines")
    .select("*")
    .limit(5);
  console.log("5. Query result:", testData?.length ?? 0, "rows");
  console.log("6. Query error:", error ?? "none");
}
```

---

## Quick Reference: RLS Policy Template

If you need to fix RLS, use this template:

```sql
-- 1. Enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if debugging)
DROP POLICY IF EXISTS "Users can view their table" ON your_table;

-- 3. Create policy
CREATE POLICY "Users can view their table"
ON your_table FOR SELECT
USING (
  department_id = auth.user_department_id()
  OR auth.is_admin()
  OR department_id = ANY(auth.has_department_access())
);

-- 4. Test it works
SELECT * FROM your_table;  -- Run as regular user
```

---

## When to Escalate

If you've checked all above and still empty:

1. **Check middleware** — Is auth session being set correctly?
2. **Check JWT** — Decode the token, verify claims
3. **Check Supabase logs** — Dashboard → Logs → Postgres
4. **Ask in #dev-support** — Include debug output from template above

---

## Related

- [[rls-policy]] — RLS standards and patterns
- [[troubleshooting]] — General debugging guide
- [[auth-middleware]] — How auth flows work
- [[database-schema]] — Table structures
