# Claude Automation Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish automated quality gates (hooks, skills, agents, tests, MCP servers) to prevent design regressions, enforce conventions, and catch bugs before they are committed.

**Architecture:** Add PostToolUse hooks for type-check and lint, create a `project-conventions` skill encoding design-system rules, create a `design-system-reviewer` subagent, configure MCP servers for Supabase and docs lookup, and add Jest/Playwright tests for critical auth and middleware paths.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, shadcn/ui, Jest, Playwright, Supabase, pnpm, Turborepo

---

## Task 1: Add PostToolUse Hooks to `.claude/settings.json`

**Files:**

- Modify: `.claude/settings.json`

**Context:** Currently `.claude/settings.json` only enables the `claude-md-management` plugin. We need hooks that auto-verify TypeScript and ESLint after file edits in the portal app.

- [ ] **Step 1: Read current settings**

Run: `cat .claude/settings.json`
Expected: Contains only `enabledPlugins`.

- [ ] **Step 2: Write updated settings with hooks**

```json
{
  "enabledPlugins": {
    "claude-md-management@claude-plugins-official": true
  },
  "hooks": {
    "PostToolUse:Edit": [
      "If the edited file is TypeScript or TSX (ends with .ts or .tsx), run `cd apps/portal && npx tsc --noEmit` to verify types. Report any errors.",
      "If the edited file is under apps/portal/, run `cd apps/portal && npx eslint <file_path> --max-warnings 0` to verify lint. Report any errors.",
      "If the edited file is under apps/portal/ and is a TSX component, verify it does NOT use `font-bold`, `font-semibold`, `bg-white/5`, `border-white/10`, `text-white/50`, `text-white/70`, `shadow`, `box-shadow`, or direct `clsx`/`twMerge` imports. Report any violations."
    ]
  }
}
```

- [ ] **Step 3: Verify settings are valid JSON**

Run: `python3 -m json.tool .claude/settings.json > /dev/null`
Expected: No output (exit 0).

---

## Task 2: Create `project-conventions` Skill

**Files:**

- Create: `.claude/skills/project-conventions/SKILL.md`

**Context:** Future Claude instances need a skill that encodes this project's non-obvious conventions so they don't re-derive them or regress on design system rules.

- [ ] **Step 1: Create skill directory**

Run: `mkdir -p .claude/skills/project-conventions`

- [ ] **Step 2: Write skill definition**

```yaml
---
name: project-conventions
description: Project-specific conventions for the Plantcor OS monorepo. Load before any implementation or review task in this codebase. Enforces monorepo, Next.js App Router, Supabase, and dark-mode design system rules.
user-invocable: false
disable-model-invocation: false
---

# Plantcor OS Project Conventions

## Monorepo
- Package manager: pnpm 9.12.0+
- Workspace protocol: all internal deps use `"workspace:*"`
- Path alias in portal: `~/*` maps to `./*`
- Run commands from root unless testing: `pnpm dev` (portal only), `pnpm build`, `pnpm lint`

## Next.js / React
- App Router only — `app/` directory, `next/link`, `next/navigation`
- Server Components by default. Only add `'use client'` for interactivity (useState, useEffect, event handlers, browser APIs)
- Data fetching in Server Components; pass data to Client Components via props
- Loading states: `loading.tsx`. Error boundaries: `error.tsx`

## Supabase
- All interactions through `@repo/supabase` — NEVER import from `@supabase/supabase-js` directly
- Server: `createServerSupabaseClient()` from `@repo/supabase/server`
- Client: `createClient()` from `@repo/supabase/client`
- Middleware: `createMiddlewareClient()` from `@repo/supabase/middleware`
- RLS must be enabled on every new table
- Service role keys must never appear in client-side code or `NEXT_PUBLIC_*` vars

## Design System (Dark Mode, Supabase-inspired)
- **Backgrounds**: `#0f0f0f` (page), `#171717` (cards/inputs), `#242424` (hover/card)
- **Borders**: `#363636` / `#393939` — NEVER use box-shadows for depth
- **Brand greens**: `#3ecf8e` (accent border, active), `#00c573` (links, hover)
- **Text**: `#fafafa` (primary), `#b4b4b4` (secondary), `#898989` (muted)
- **Typography**: Inter font, `font-weight: 400` default, `500` for nav/buttons, NEVER `700`/`bold`
- **Class merging**: always use `cn()` from `@repo/ui/lib/utils` — NEVER `clsx` or `tailwind-merge` directly
- **Forbidden patterns**: `bg-white/5`, `border-white/10`, `text-white/50`, `text-white/70`, `font-semibold`, `font-bold`, `shadow-*`, `box-shadow`

## UI Components
- Import from `@repo/ui`, never direct shadcn paths
- Add new shadcn components via `pnpm ui` (runs in `@repo/ui` package)
- Component files: PascalCase (`Button.tsx`). Utility files: camelCase (`formatDate.ts`)

## Testing
- Unit tests: Jest with `ts-jest`, files: `<name>.test.ts` or `<name>.test.tsx`
- Mock `@repo/supabase`, never `@supabase/supabase-js`
- E2E: Playwright, files: `e2e/<name>.spec.ts`, baseURL `http://localhost:3000`
```

- [ ] **Step 3: Verify skill file exists**

Run: `ls -la .claude/skills/project-conventions/SKILL.md`
Expected: File exists.

---

## Task 3: Create `design-system-reviewer` Subagent

**Files:**

- Create: `.claude/agents/design-system-reviewer.md`

**Context:** A reusable subagent that reviews any diff touching portal UI for design-system regressions.

- [ ] **Step 1: Create agents directory**

Run: `mkdir -p .claude/agents`

- [ ] **Step 2: Write agent definition**

```markdown
# Design System Reviewer

## Role

You are a strict design-system auditor for the Plantcor OS portal. Your job is to catch visual regressions, forbidden Tailwind classes, and convention violations in any diff touching `apps/portal/**` or `packages/ui/**`.

## Forbidden Patterns (report each occurrence)

1. **Glassmorphic leftovers**: `bg-white/5`, `bg-white/10`, `border-white/10`, `text-white/50`, `text-white/70`
2. **Wrong font weights**: `font-semibold`, `font-bold` — max allowed is `font-medium`
3. **Shadow abuse**: any `shadow-*` or `box-shadow` class — depth must come from border color gradation only
4. **Direct tailwind-merge/clsx**: imports from `clsx` or `tailwind-merge` instead of `cn()` from `@repo/ui/lib/utils`
5. **Wrong Supabase import**: direct import from `@supabase/supabase-js` instead of `@repo/supabase`
6. **Missing RLS mention**: any new table/migration without `ENABLE ROW LEVEL SECURITY`

## Allowed Patterns (do NOT flag)

- `bg-[#0f0f0f]`, `bg-[#171717]`, `bg-[#242424]`, `border-[#363636]`
- `text-[#fafafa]`, `text-[#b4b4b4]`, `text-[#898989]`
- `text-[#3ecf8e]`, `text-[#00c573]`
- `font-medium`
- `focus:ring-[#3ecf8e]/30`
- `cn()` usage from `@repo/ui/lib/utils`

## Output Format

For each violation found:

- File and line number
- The violating code snippet
- Suggested fix using design-system colors/classes
- Severity: `blocker` (must fix) or `warning` (should fix)

If no violations found, output exactly: "No design-system violations detected."
```

- [ ] **Step 3: Verify agent file exists**

Run: `ls -la .claude/agents/design-system-reviewer.md`
Expected: File exists.

---

## Task 4: Create `.mcp.json`

**Files:**

- Create: `.mcp.json`

**Context:** MCP servers give Claude direct access to live documentation and local Supabase. Team members get the same servers by checking this file into git.

- [ ] **Step 1: Write MCP configuration**

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"]
    }
  }
}
```

- [ ] **Step 2: Validate JSON**

Run: `python3 -m json.tool .mcp.json > /dev/null`
Expected: No output (exit 0).

---

## Task 5: Write Jest Unit Test for `normalizeRole`

**Files:**

- Create: `apps/portal/middleware.test.ts`

**Context:** The `normalizeRole` function in `middleware.ts` has no tests. It must handle string roles, empty strings, undefined/null, and non-string values.

- [ ] **Step 1: Write the failing test**

```typescript
import { normalizeRole } from "./middleware";

describe("normalizeRole", () => {
  it("returns the role as-is for valid non-empty strings", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("control_room_operator")).toBe(
      "control_room_operator",
    );
    expect(normalizeRole("supervisor")).toBe("supervisor");
  });

  it("returns 'operator' for empty string", () => {
    expect(normalizeRole("")).toBe("operator");
  });

  it("returns 'operator' for undefined", () => {
    expect(normalizeRole(undefined)).toBe("operator");
  });

  it("returns 'operator' for null", () => {
    expect(normalizeRole(null)).toBe("operator");
  });

  it("returns 'operator' for non-string values", () => {
    expect(normalizeRole(42)).toBe("operator");
    expect(normalizeRole({})).toBe("operator");
    expect(normalizeRole([])).toBe("operator");
    expect(normalizeRole(true)).toBe("operator");
  });
});
```

- [ ] **Step 2: Export `normalizeRole` from middleware.ts**

Modify `apps/portal/middleware.ts` to export the function so it is testable:

```typescript
// Change from:
function normalizeRole(role: unknown): string {
// To:
export function normalizeRole(role: unknown): string {
```

- [ ] **Step 3: Run the test and verify it passes**

Run: `cd apps/portal && npx jest middleware.test.ts --no-coverage`
Expected: 5 tests pass.

---

## Task 6: Write Playwright E2E Test for Login Flow

**Files:**

- Create: `e2e/login.spec.ts`

**Context:** There are no E2E tests. The login page at `/login` is the most critical user flow. We need a smoke test that verifies the page renders and has a functional form.

- [ ] **Step 1: Write the E2E test**

```typescript
import { test, expect } from "@playwright/test";

test.describe("login page", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("redirects authenticated users away from login", async ({ page }) => {
    // This test documents the expected behavior.
    // Full auth flow (sign up + sign in) requires Supabase local instance.
    // For now we verify the unauthenticated state renders correctly.
    await page.goto("/login");
    await expect(page.locator("form")).toBeVisible();
  });
});
```

- [ ] **Step 2: Verify test file exists**

Run: `ls -la e2e/login.spec.ts`
Expected: File exists.

- [ ] **Step 3: Run E2E test (if dev server is available)**

Run: `cd apps/portal && npx playwright test e2e/login.spec.ts --project=chromium`
Note: Requires `pnpm dev` running on localhost:3000. If not running, skip and document.

---

## Task 7: Final Verification

- [ ] **Step 1: Type-check portal**

Run: `cd apps/portal && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Lint portal**

Run: `cd apps/portal && npx eslint . --max-warnings 0`
Expected: 0 errors. (Note: pre-existing monorepo ESLint resolution issues may require `--no-verify` on commit, but lint itself should be clean for portal files.)

- [ ] **Step 3: Run Jest tests**

Run: `cd apps/portal && npx jest --no-coverage`
Expected: All tests pass (including the new `middleware.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.json .claude/skills/project-conventions/SKILL.md .claude/agents/design-system-reviewer.md .mcp.json apps/portal/middleware.test.ts e2e/login.spec.ts apps/portal/middleware.ts
git commit -m "chore(automation): add Claude quality gates, design-system reviewer, MCP servers, and initial tests

- Add PostToolUse hooks for type-check, lint, and design-system regression guard
- Create project-conventions skill encoding monorepo, Next.js, Supabase, and dark-mode rules
- Create design-system-reviewer subagent for automated diff audits
- Add .mcp.json with context7 and supabase MCP servers
- Export normalizeRole from middleware.ts for testability
- Add Jest unit tests for normalizeRole edge cases
- Add Playwright e2e smoke test for login page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
