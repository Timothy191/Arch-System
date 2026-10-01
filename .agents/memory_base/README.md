# Smart Memory Indexing & Auto-Recall

## Overview

This directory manages the `.agents/memory_base/` system, an immutable knowledge base storing error retrospectives, solution patterns, architectural decisions, and hardware quirks. It provides automated indexing and query capabilities to prevent repeat mistakes across autonomous agent runs.

## Index Registry

- `schema.json`: JSON schema definition for retrospective entries.
- `index.json`: Fast lookup index mapped by error signature and category (synchronized via `tools/scripts/smart-indexer.cjs`).
- `retrospectives/`: Discrete immutable error retrospectives (9 indexed entries).

### Current Retrospective Catalog

| ID | Category | Error Signature / Topic |
| :--- | :--- | :--- |
| `err-20260925-vercel-headless-deploy` | `DEPLOYMENT` | Vercel headless deployment fails after login |
| `err-20260925-wayland-playwright-crash` | `E2E_TESTING` | Playwright/Chromium crash with eglCreateImage errors |
| `err-20260928-hardcoded-credentials` | `SECURITY` | Hardcoded Supabase URL and keys in createBearerSupabaseClient |
| `err-20260928-kysely-connection-leak` | `DATABASE` | Kysely Pool exhaustion due to per-request instantiation |
| `err-20260928-unreachable-validation` | `UI_UX` | Unreachable email validation in LoginForm.tsx blur handler |
| `err-20260929-placeholder-secret-false-positive` | `SECURITY` | Regex secret fingerprinting produces false positives on placeholder values |
| `err-20260929-stale-branch-key-lurkers` | `SECURITY` | Deleted main-tip secrets reappear as live files on stale public bot branches |
| `err-20260929-unreachable-object-exposure` | `SECURITY` | History-rewriting refs/heads/* does NOT remove leaked secrets due to refs/pull/<N>/head pins |
| `recovery-20260929-remaining-branch-deletion` | `SECURITY` | Published remote branch tips retained live un-rotated Supabase JWTs post-cleanup |

## Auto-Recall Pre-Flight Check

Run `node tools/scripts/smart-indexer.cjs --query "<domain-or-error>"` to scan for existing retrospectives before modifying code in a specific domain.
