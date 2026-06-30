---
title: "Q: How do I add a new department?"
created: 2026-05-15
updated: 2026-05-15
type: query
tags: [how-to, department, onboarding, quick-reference]
sources:
  [
    06_technical_documentation/wiki/concepts/department-features.md,
    06_technical_documentation/wiki/concepts/database-schema.md,
    06_technical_documentation/wiki/concepts/nx-monorepo.md,
  ]
confidence: high
---

# Q: How do I add a new department?

## Quick Answer (5 steps, ~15 minutes)

### 1. Add Department Metadata

Edit `00_applications/portal/lib/departments.ts`:

```typescript
export const DEPARTMENTS: Department[] = [
  // ... existing departments
  {
    slug: "environmental",
    displayName: "Environmental",
    icon: "Leaf", // from lucide-react
    color: "emerald",
    description: "Environmental monitoring and compliance tracking",
  },
];
```

### 2. Add Tab Configuration

In the same file, add to `DEPARTMENT_TABS`:

```typescript
export const DEPARTMENT_TABS: Record<string, TabConfig[]> = {
  // ... existing departments
  environmental: [
    { slug: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { slug: "monitoring", label: "Monitoring", icon: "Activity" },
    { slug: "compliance", label: "Compliance", icon: "Shield" },
    { slug: "reports", label: "Reports", icon: "FileText" },
    { slug: "tools", label: "Tools", icon: "Wrench" },
  ],
};
```

### 3. Create Route Folder

```bash
mkdir -p 00_applications/portal/app/\(departments\)/environmental/dashboard
mkdir -p 00_applications/portal/app/\(departments\)/environmental/monitoring
mkdir -p 00_applications/portal/app/\(departments\)/environmental/compliance
mkdir -p 00_applications/portal/app/\(departments\)/environmental/reports
mkdir -p 00_applications/portal/app/\(departments\)/environmental/tools
```

### 4. Create Tab Pages

Each tab needs a `page.tsx`:

```typescript
// 00_applications/portal/app/(departments)/environmental/dashboard/page.tsx
import { getDepartmentContext } from '~/lib/dept-context'
import { PageHeader } from '@repo/ui/PageHeader'

export default async function EnvironmentalDashboard({ params }: { params: { department: string } }) {
  const { dept, supabase } = await getDepartmentContext(params)

  const { data: metrics } = await supabase
    .from('environmental_metrics')
    .select('*')
    .eq('department_id', dept.id)

  return (
    <div>
      <PageHeader title={`${dept.displayName} Dashboard`} />
      {/* Your dashboard content */}
    </div>
  )
}
```

### 5. Database Migration

Create `01_platform_packages/database/migrations/XXX_add_environmental_department.sql`:

```sql
-- Add department to database
INSERT INTO departments (id, name, display_name, icon, description, color)
VALUES (
  gen_random_uuid(),
  'environmental',
  'Environmental',
  'Leaf',
  'Environmental monitoring and compliance tracking',
  'emerald'
);

-- Create department-specific table (optional)
CREATE TABLE environmental_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  value NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE environmental_metrics ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY "Users can view environmental metrics"
ON environmental_metrics FOR SELECT
USING (department_id = auth.user_department_id() OR auth.is_admin());
```

Deploy:

```bash
cd 01_platform_packages/database && pnpm supabase:push
```

---

## Full Details

### Department Slug Requirements

- Lowercase letters and hyphens only
- Must match folder name exactly
- Unique across all departments

### Tab Configuration Options

| Option       | Type    | Description                          |
| ------------ | ------- | ------------------------------------ |
| `slug`       | string  | URL segment (e.g., 'dashboard')      |
| `label`      | string  | Display name in sidebar              |
| `icon`       | string  | Lucide icon name                     |
| `href`       | string  | (optional) External link             |
| `restricted` | boolean | (optional) Requires admin/supervisor |

### Icons Available

Any icon from `lucide-react` — use PascalCase name:

- `LayoutDashboard`, `Activity`, `Shield`, `FileText`, `Wrench`
- `Settings`, `Users`, `BarChart3`, `AlertTriangle`, `CheckCircle`

See [Lucide Icons](https://lucide.dev/icons/)

### Colors Available

Must match Tailwind color palette:

- `slate`, `gray`, `zinc`, `neutral`, `stone`
- `red`, `blue`, `blue`, `yellow`, `lime`, `green`, `emerald`
- `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`
- `fuchsia`, `pink`, `rose`

### RLS Policy Template

Every new table needs RLS:

```sql
-- Enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Allow users to see their department's data
CREATE POLICY "Users can view their department data"
ON your_table FOR SELECT
USING (
  department_id = auth.user_department_id()
  OR auth.is_admin()
  OR department_id = ANY(auth.has_department_access())
);

-- Allow admin/supervisor to insert
CREATE POLICY "Admins can insert data"
ON your_table FOR INSERT
WITH CHECK (
  auth.is_admin() OR auth.user_role() IN ('admin', 'supervisor')
);
```

### Testing the New Department

1. Restart dev server: `pnpm dev`
2. Navigate to `/environmental`
3. Verify sidebar tabs render
4. Check database permissions work
5. Test on staging before production

---

## Common Mistakes

### 1. Forgot Database Migration

**Symptom**: Department shows in UI but queries fail
**Fix**: Run `pnpm supabase:push`

### 2. RLS Not Enabled

**Symptom**: Empty data arrays, no errors
**Fix**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

### 3. Mismatched Slug

**Symptom**: 404 errors, not found
**Fix**: Ensure `slug` in `departments.ts` matches folder name

### 4. Missing Icon Import

**Symptom**: Icon doesn't render
**Fix**: Use valid Lucide icon name (PascalCase)

---

## Related

- [[department-features]] — Full department system documentation
- [[database-schema]] — Database structure and RLS patterns
- [[rls-policy]] — RLS policy standards
- [[onboarding]] — New developer setup
