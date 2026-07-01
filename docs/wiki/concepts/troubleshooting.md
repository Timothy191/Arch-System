---
title: Troubleshooting Guide
created: 2026-05-15
updated: 2026-05-15
type: concept
tags: [troubleshooting, ops, support, how-to]
sources: [CLAUDE.md, docs/wiki/concepts/nx-monorepo.md]
confidence: high
---

# Troubleshooting Guide

Common issues and their resolutions for the Arch-Systems portal development environment.

---

## Quick Diagnostic Commands

```bash
# Check versions
node --version  # Should be >=20.17.0
pnpm --version  # Should be 9.12.0

# Verify dependencies
pnpm install
pnpm --filter portal type-check
pnpm lint

# Check Supabase status
cd pkgs/database && pnpm supabase status
```

---

## React Version Issues

### Error: "Cannot find module 'react'" or version conflicts

**Cause**: `apps/overview` uses React 18, while `apps/portal` uses React 19. Sharing components between them causes conflicts.

**Solution**:

```bash
# Never import components from apps/overview into apps/portal
# Keep component sharing limited to @repo/ui
```

**Prevention**: Always use `@repo/ui` for shared components, never cross-import between apps.

---

## Tailwind CSS Violations

### Error: "Forbidden class: font-bold" (or similar)

**Cause**: DeepEval's `DesignSystemComplianceMetric` or pre-commit hooks caught disallowed Tailwind classes.

**Forbidden Classes**:

- `font-bold`, `font-semibold` → Use `font-medium`
- `bg-white/5`, `border-white/10`, `text-white/50`, `text-white/70`
- `shadow-*` → Use CSS shadows from `@repo/theme`
- Direct `clsx` or `tailwind-merge` imports → Use `cn()` from `@repo/ui`

**Solution**:

```tsx
// Wrong
<div className="font-bold bg-white/5 shadow-lg">

// Correct
<div className="font-medium bg-primary">
```

**Check**: Run `pnpm lint` to catch violations early.

---

## Supabase RLS Issues

### Symptom: Query returns empty array but data exists

**Diagnostic Steps**:

1. **Check RLS is enabled**:

```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'your_table';
-- Should show relrowsecurity = true
```

2. **Verify auth context**:

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
console.log("User ID:", user?.id);
```

3. **Test with service role** (bypasses RLS):

```typescript
// Only for debugging, never in production code
const serviceClient = createClient(supabaseUrl, serviceRoleKey);
```

**Common Causes**:

- Missing `employees` row for the authenticated user
- `department_id` mismatch between user and data
- No `accessible_departments` entry for cross-department access

**Solution**: Check `auth.user_department_id()` returns expected UUID:

```sql
SELECT auth.user_department_id();
```

---

## Middleware Auth Loops

### Symptom: Infinite redirects between `/login` and department routes

**Causes**:

1. **Department UUID cache stale** (60s TTL expired, but department renamed)
2. **Restricted route without proper role**
3. **Missing `handle_new_user()` trigger** in Supabase

**Diagnostic**:

```bash
# Check proxy logs
cat apps/portal/proxy.ts | grep -A 5 "redirect"
```

**Solutions**:

1. Clear proxy cache by restarting dev server
2. Verify employee role in Supabase Studio:

```sql
SELECT full_name, role, department_id FROM employees WHERE auth_id = 'user-uuid';
```

3. Check `RESTRICTED_ROUTES` in middleware matches user's role

---

## Migration Sync Failures

### Symptom: "Migration differs from local" or missing tables

**Cause**: `pkgs/database/migrations/` (source of truth) differs from `pkgs/supabase/supabase/migrations/` (deploy copy).

**Solution**:

```bash
# 1. Reset to clean state
cd pkgs/database && pnpm supabase:reset

# 2. Verify migrations exist
ls pkgs/database/migrations/*.sql

# 3. Deploy local (syncs and pushes)
pnpm deploy:local
```

**Prevention**: Always edit migrations in `pkgs/database/migrations/`, never in `pkgs/supabase/`.

---

## Univer CSS Import Issues

### Symptom: Global CSS ordering warnings or broken spreadsheet styling

**Cause**: `@univerjs/preset-sheets-core/lib/index.css` imported multiple times or in wrong location.

**Solution**:

- Import ONLY in `UniverSheet.tsx` component
- NEVER import in `layout.tsx` or global CSS

```typescript
// apps/portal/features/departments/components/tools/UniverSheet.tsx
import "@univerjs/preset-sheets-core/lib/index.css"; // Once only here
```

---

## Build Failures

### Error: "Module not found: @repo/ui" or workspace packages

**Cause**: Nx dependency graph out of sync.

**Solution**:

```bash
# Clean build
pnpm clean  # or rm -rf **/node_modules **/.nx **/dist
pnpm install
pnpm build
```

### Error: TypeScript errors in @repo packages

**Solution**:

```bash
# Build packages first
pnpm --filter @repo/ui build
pnpm --filter @repo/theme build
pnpm --filter @repo/supabase build

# Then build portal
pnpm --filter portal build
```

---

## External Tools Offline

### Symptom: n8n or Flowise shows "offline" in Tools tab

**Diagnostic**:

```bash
# Check tool status endpoint
curl http://localhost:3000/api/tools/status

# Direct tool check
curl -I http://localhost:5678  # n8n default
curl -I http://localhost:3000  # Flowise default
```

**Solutions**:

1. **n8n**: Ensure Docker container is running:

```bash
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
```

2. **Flowise**: Check if Flowise server started on correct port

3. **Environment variables**: Verify `N8N_URL` and `FLOWISE_URL` in `.env`

---

## AI Service Failures

### Symptom: AI chat returns "Service unavailable" or timeouts

**Diagnostic Steps**:

1. Check API keys are set:

```bash
grep -E "GROQ_API_KEY|OPENROUTER_API_KEY|TOGETHER_API_KEY" apps/portal/.env
```

2. Test provider directly:

```bash
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

3. Check provider status pages:

- Groq: <https://status.groq.com>
- OpenRouter: <https://status.openrouter.ai>

**Solutions**:

- Verify keys are valid and not rate-limited
- Check failover is working (Groq → OpenRouter → Together)
- Review `apps/portal/lib/ai/ai-service.ts` for error handling

---

## Playwright E2E Test Failures

### Symptom: Tests fail with "page.goto: net::ERR_CONNECTION_REFUSED"

**Cause**: E2E tests require the dev server to be running.

**Solution**:

```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Run E2E tests
pnpm test:e2e
```

### Symptom: Tests fail on auth flows

**Cause**: Supabase must be running and seeded.

**Solution**:

```bash
cd pkgs/database && pnpm supabase:dev
pnpm deploy:local  # Seeds test data
```

---

## Still Stuck?

1. Check [[supabase-local-dev]] for database setup issues
2. Review [[nx-monorepo]] for workspace problems
3. Consult [[design-system]] for UI/styling questions
4. Check [[auth-middleware]] for auth flow details

## Related

- [[onboarding]] — First-time setup guide
- [[deployment]] — Production deployment steps
- [[incident-response]] — Production incident handling
