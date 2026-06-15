---
title: "Q: How do I debug issues?"
created: 2026-05-15
updated: 2026-05-15
type: query
tags: [troubleshooting, debugging, quick-reference, support]
sources:
  [docs/wiki/concepts/troubleshooting.md, docs/wiki/concepts/onboarding.md]
confidence: high
---

# Q: How do I debug issues?

## Quick Answer: Start Here

```
1. Check console for errors
2. Run diagnostic commands
3. Check [[troubleshooting]] for your symptom
4. Ask in #dev-support with details
```

---

## Diagnostic Commands

Run these first when something is wrong:

```bash
# Check versions
node --version    # Should be >=20.17.0
pnpm --version    # Should be 9.12.0

# Verify install
pnpm install

# Check code quality
pnpm lint
pnpm --filter portal type-check
pnpm --filter portal test

# Check build
pnpm build

# Check Supabase
cd packages/database
pnpm supabase status
```

---

## Common Issues & Quick Fixes

### Issue: "Cannot find module 'react'" or version conflicts

**Diagnose**:

```bash
# Check React versions
pnpm list react

# Should show React 19 in portal, React 18 in overview (expected)
```

**Fix**: Don't share components between `apps/overview` (React 18) and `apps/portal` (React 19). Use `@repo/ui` instead.

### Issue: "Forbidden class: font-bold" in pre-commit

**Fix**:

```tsx
// Wrong
<div className="font-bold">

// Right
<div className="font-medium">
```

Forbidden classes: `font-bold`, `font-semibold`, `shadow-*`, `bg-white/5`, `border-white/10`, `text-white/50`, `text-white/70`

### Issue: Query returns empty data

**See**: [[why-query-returns-empty]] — Full diagnosis guide

Quick check:

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
console.log("User:", user?.id); // Should exist

const { data: employee } = await supabase
  .from("employees")
  .select("*")
  .eq("auth_id", user?.id)
  .single();
console.log("Employee:", employee); // Should exist, not null
```

If `employee` is null → [[why-query-returns-empty]]

### Issue: Infinite redirects (auth loop)

**Check**:

1. `handle_new_user()` trigger exists in Supabase
2. Employee row created for user
3. User has correct role for route

**Fix**:

```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'handle_new_user';

-- Check employee
SELECT * FROM employees WHERE auth_id = 'user-id';
```

### Issue: Build fails

**Steps**:

```bash
# Clean rebuild
rm -rf **/node_modules **/.nx **/dist **/.next
pnpm install
pnpm build
```

If still failing, check specific error:

- TypeScript errors → `pnpm --filter portal type-check`
- Lint errors → `pnpm lint`
- Package errors → Check `pnpm-workspace.yaml`

### Issue: AI chat not working

**Check**:

```bash
# Verify API keys
cat apps/portal/.env | grep -E "GROQ|OPENROUTER|TOGETHER"

# Test provider
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

### Issue: External tools show "offline"

**Check**:

```bash
# Test n8n
curl -I http://localhost:5678

# Test Flowise
curl -I http://localhost:3000

# Check status endpoint
curl http://localhost:3000/api/tools/status
```

---

## Debugging Tools

### Browser DevTools

1. **Console**: Check for red errors
2. **Network**: Check API requests (200? 500?)
3. **Application → Cookies**: Verify `sb-access-token` exists
4. **React DevTools**: Component tree and props

### Supabase Dashboard

1. Go to <https://supabase.com/dashboard>
2. Table Editor: Verify data exists
3. SQL Editor: Run test queries
4. Logs: Check for errors
5. Auth: Verify user exists in `auth.users`

### Vercel Dashboard (Production)

1. Go to <https://vercel.com/dashboard>
2. Functions: Check serverless function logs
3. Analytics: See performance metrics
4. Deployments: Compare working vs broken

### VS Code Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev",
      "cwd": "${workspaceFolder}/apps/portal"
    }
  ]
}
```

---

## Debugging Template

When asking for help in #dev-support, use this format:

```
**Issue**: Brief description

**Error Message**:
```

Paste full error here

```

**What I've Tried**:
- [ ] Checked console
- [ ] Ran pnpm install
- [ ] Checked troubleshooting guide
- [ ] Restarted dev server

**Environment**:
- Node version: x.x.x
- pnpm version: x.x.x
- Branch: feature/xxx

**Reproduction Steps**:
1. Go to...
2. Click...
3. See error...
```

---

## Specific Debugging Guides

| Issue               | Guide                               |
| ------------------- | ----------------------------------- |
| Query returns empty | [[why-query-returns-empty]]         |
| Auth not working    | [[how-does-auth-work]]              |
| Build failing       | [[troubleshooting]] → Build section |
| Deploy failing      | [[how-to-deploy-production]]        |
| Performance slow    | [[monitoring-error-tracking]]       |
| AI not responding   | [[ai-service]]                      |

---

## Emergency Debug Mode

If completely stuck:

```bash
# 1. Clean everything
pnpm clean  # or: rm -rf **/node_modules **/.nx **/dist **/.next

# 2. Fresh install
pnpm install

# 3. Reset Supabase
cd packages/database
pnpm supabase:reset

# 4. Full deploy local
pnpm deploy:local
```

If this doesn't fix it, escalate to #dev-support with full error logs.

---

## Related

- [[troubleshooting]] — Comprehensive troubleshooting guide
- [[why-query-returns-empty]] — Database query issues
- [[how-does-auth-work]] — Authentication debugging
- [[onboarding]] — Common new-dev issues
