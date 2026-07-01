# Agent Tracer - 01_platform_packages/utils

Every line in this file answers the question: "Would an agent miss this without help?"

---

## 2026-06-24: Add Analytics Utility Lint Fixes & Novu SDK Logger Fix

### Purpose

Resolve ESLint `no-console` warnings and fix a broken relative import of `logger` in the Novu notification utility.

### Changes Made

1. **Analytics Utility (`src/analytics.ts`)**:
   - Added `eslint-disable-next-line no-console` comments to server-side `console.log` statements in `track()` and `identify()`.
2. **Novu Utility (`src/novu.ts`)**:
   - Removed broken relative import of `logger` from `./index`.
   - Defined a local lightweight console-based `logger` with eslint-disable comments to prevent dependency bloat and type-checking issues.

### What the Next Agent Should Know

- `analytics` and `novu` utilities provide behavior tracking and notifications, but use lightweight console fallback logs which require ESLint rule suppressions to pass the root quality gate.
