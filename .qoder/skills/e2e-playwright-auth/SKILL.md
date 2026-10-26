---
name: e2e-playwright-auth
description: Write and debug authenticated Playwright specs in Arch-System's e2e suite. Use when an e2e test fails on login, storageState, or missing session cookies, when adding a spec that needs a signed-in department page, or when running test:e2e / test:a11y against a specific spec. Covers the cached auth file, its staleness rules, and the dev-server/BASE_URL interaction.
---

# E2E Playwright Auth

Config is `e2e/playwright.config.ts` only (no root config) and `testDir: '.'`, so spec paths resolve under `e2e/`. Run everything from the repo root.

## 1. Commands

```bash
pnpm test:e2e                                    # playwright test --config=e2e/playwright.config.ts
pnpm test:e2e e2e/login.spec.ts --project=chromium   # one spec, one project
BASE_URL=http://localhost:3000 pnpm test:e2e    # reuse a server you already started
pnpm test:a11y                                   # packages/ui test-storybook — needs Storybook, not the portal
```

`webServer` is conditional (`process.env.BASE_URL ? undefined : {...}`), running `pnpm --filter portal dev` on `http://localhost:3000` with `reuseExistingServer: !CI`. Setting `BASE_URL` disables the auto-start, so it must point at a live server or every test fails to connect. `test:a11y` targets Storybook on :6006 (`pnpm --filter @repo/ui storybook`) — it is not a portal suite.

## 2. How authentication works

Project `setup` runs `e2e/global.setup.ts`; `chromium`, `mobile-chrome`, and `tablet-chrome` declare `dependencies: ['setup']` and `storageState: 'e2e/.auth/user.json'`.

The setup posts to `/api/auth/login` with `page.request.post(...)` so `Set-Cookie` fills the context, then writes `page.context().storageState({ path: authFile })`. It falls back to the `/login` UI form when the API call is not ok.

Cached state is reused only if `e2e/.auth/user.json` exists, is >100 bytes, its `mtime` is within **30 minutes**, and it contains a cookie whose name starts with `sb-`. Otherwise it silently re-authenticates.

## 3. Credentials

Import from `e2e/helpers/credentials.ts` — never hardcode an address or password in a spec. Defaults come from `TEST_EMAIL` / `TEST_PASSWORD` env vars, falling back to the checked-in test user. Overriding env is how you test a non-admin role.

## 4. Forcing a fresh login

```bash
rm e2e/.auth/user.json
```

Do this after changing credentials, after a privilege bump (Redis `bumpPrivilegeVersion` invalidates server-side RBAC that the cached JWT will not reflect), or when a Supabase JWT (`expires_in: 3600`) has aged out. Deleting the file costs a real login, which is rate limited — see below.

## 5. Per-spec storage state

```ts
test.use({ storageState: AUTH_FILE }); // authenticated
test.use({ storageState: { cookies: [], origins: [] } }); // force logged-out
```

`e2e/helpers/auth.ts` also exports `loginWithTestUser` (hydrates cookies straight from the file to avoid extra login requests) and `performMockLogin`, used in `beforeEach` by specs like `authenticated-flows.spec.ts`.

## 6. Failure modes worth checking first

1. Running Playwright from inside `e2e/` — `storageState` paths resolve from CWD, so the auth file is not found.
2. `BASE_URL` set but no server listening.
3. Login rate limit **5 requests / 15 min / IP** (`apps/portal/app/api/auth/login/route.ts`) — a deleted or stale cache file makes every worker log in; reuse `loginWithTestUser` instead of logging in per test.
4. Expecting `test:a11y` to hit the portal — it needs Storybook on :6006.
5. A cached `user.json` older than 30 min or missing the `sb-` cookie, silently re-authenticating with stale env credentials.
