---
name: run-portal
description: Build, start, and drive the Arch-Systems portal on localhost:3000 — run a committed Playwright driver that logs in and screenshots real pages, or serve it for manual browsing. Use when an agent needs to run/start/build/test/screenshot the portal app and interact with the actual running UI.
---

The portal is a Next.js 16 (Turbopack) app. Everything an agent needs lives in this
skill directory: `serve.sh` starts the dev server under pm2 with the one environment
bridge the code needs, and `driver.mjs` is the primary agent path — it opens the real
app in headless Chromium, logs in with the smoke-test credentials from `.env`, and
screenshots each visited page. Do not hand-roll your own Playwright script; the driver
already handles the cookie-consent bar, the login redirect chain, and cwd-independent
path resolution.

All paths below are relative to `apps/portal/`. The harness works from any cwd.

## Prerequisites

- Dev server config keys exist in `.env` (counts only — never print the values):

  ```bash
  rg -c "^SUPABASE_SERVICE_KEY=|^SMOKE_TEST_EMAIL=|^SMOKE_TEST_PASSWORD=" .env
  # -> 3
  ```

- Playwright comes from the global mise install (it is **not** a repo dependency), and
  system Chromium is the browser executable (no Playwright browser cache exists):

  ```bash
  ls /home/timothy/.local/share/mise/installs/npm-playwright/latest/node_modules/playwright/index.mjs >/dev/null && test -x /usr/bin/chromium && echo "playwright + chromium present"
  # -> playwright + chromium present
  ```

## Build

No build step is needed to drive the app — `serve.sh` runs the dev server. Validate the
harness itself before relying on it:

```bash
node --check .claude/skills/run-portal/driver.mjs
# -> (no output, exit 0)
```

## Run (agent path)

1. Start the dev server under pm2 on :3000. `serve.sh` bridges
   `SUPABASE_SERVICE_ROLE_KEY` from `.env`'s `SUPABASE_SERVICE_KEY` (see Gotchas) and
   works from any cwd:

   ```bash
   bash .claude/skills/run-portal/serve.sh
   ```

2. Wait for readiness (Turbopack boots in seconds on a warm cache):

   ```bash
   for i in $(seq 1 30); do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null); [ "$code" = "200" ] && echo "READY ($code)" && break; sleep 2; done
   # -> READY (200)
   ```

3. Drive the app — log in with the smoke-test credentials from `.env` (never printed) and
   screenshot `/hub`. Exit 0 means login succeeded and the hub rendered. Add plain
   paths (e.g. `/hub/executive`) to visit more pages; omit `--login` to browse
   anonymously (`/` and `/hub`):

   ```bash
   node .claude/skills/run-portal/driver.mjs --login
   # -> login: SUCCESS (final url http://localhost:3000/hub)
   #    === /hub -> finalUrl=http://localhost:3000/hub
   #        title="Hub — Arch Systems"
   #        shot=/tmp/portal-shots/hub.png
   #    DRIVER_EXIT=0
   ```

Screenshots land in `/tmp/portal-shots/` (override with `PORTAL_SHOT_DIR`; base URL
override is `PORTAL_BASE`).

## Run (human path)

The same pm2-managed server is the human path — open `http://localhost:3000/login` in
a browser. Inspect server output with:

```bash
pm2 logs portal-dev --lines 20 --nostream
# -> ... GET /api/health 200 in 591ms ...
```

Stop or restart it:

```bash
pm2 stop portal-dev
pm2 restart portal-dev   # -> back to 200 on :3000 within ~2s on warm cache
```

## Gotchas

- **`SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_KEY`.** The service-role client in
  `packages/supabase/src/server.ts` reads `process.env.SUPABASE_SERVICE_ROLE_KEY`, but
  `.env` (and `env/.env.example`) name the key `SUPABASE_SERVICE_KEY`. Without the
  bridge, `/hub` renders an error tile: "Something went wrong — supabaseKey is
  required". `serve.sh` bridges the value at launch. Decision recorded 2026-09-14
  (see `AGENT_TRACER.md`): left as-is — renaming either side is deferred to a human
  because `SUPABASE_SERVICE_KEY` is referenced by deploy scripts and CI, and the
  service-role client code is uncommitted, auth-adjacent work awaiting review. When
  that lands, align the naming and drop the `serve.sh` bridge.
- **Login rate limit: 10 requests per 15 minutes** on `/api/auth/login` (429 with
  `X-RateLimit-Reset`). A driver retry loop can lock itself out — the driver performs
  exactly one login per run; do not wrap it in a retry loop.
- **Cookie-consent bar overlays the login page** and blocks clicks. The driver dismisses
  it ("Decline Optional", then "Accept All") before filling the form. If you write your
  own script, you must do the same.
- **Never print `.env` values.** `SMOKE_TEST_*`, `SUPABASE_*` — the driver reads them
  from `.env` and only ever reports success/failure and the final URL.
- **Screenshots overwrite by path name** (`/hub` → `hub.png`), so consecutive runs
  replace the previous shot. Rename the file if you need to keep one.
- The driver resolves every path from its own location (`import.meta.url`), so a shell
  cwd change cannot break it. An earlier probe failed with `ENOENT apps/portal/.env`
  exactly because it used cwd-relative paths — that failure mode is fixed in the
  committed driver.

## Troubleshooting

- **`FATAL: set SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD in apps/portal/.env`** (driver
  exit 2): the keys are missing from `.env`. Check with the `rg -c` command under
  Prerequisites.
- **`login: FAILED` in driver output**: check the final URL and the screenshot. If the
  URL is still `/login`, re-check the credentials keys in `.env` and the rate-limit
  gotcha above.
- **Readiness loop never prints READY**: inspect `pm2 logs portal-dev --lines 20
--nostream` — compile errors appear there.
