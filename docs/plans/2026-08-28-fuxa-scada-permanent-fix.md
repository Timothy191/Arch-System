# Validated Implementation Plan — FUXA SCADA Permanent Resolution

**Created / validated:** 2026-08-28
**Status:** ✅ IMPLEMENTED & LIVE-VERIFIED (all 6 phases, D1=a + D2=a; reverse-flow reachability confirmed end-to-end via FUXA host networking). Verification log in Appendix C.
**Supersedes:** the earlier 4-gap draft (container-only) in this same file.
**RCA method:** Hypothesis-driven falsification + differential diagnosis + reproducibility toggle test (AGENTS.md §12).

---

## Part 1 — Validation Report (was the prior "UI" response accurate?)

| Prior claim                                                                               | Verdict                  | Evidence                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FUXA has its own web UI (Angular HMI) at `:1881`                                          | ✅ CONFIRMED             | `curl :1881/` → full Angular HTML doc titled "FUXA"; upstream README: Angular client + Node.js server                                                                                                                                                                                                             |
| Portal embeds FUXA via `FuxaFrame` iframe with degraded-mode fallback, retry, status pill | ✅ CONFIRMED             | Read `libs/features/departments/ui/src/control-room/FuxaFrame.tsx` in full — localStorage cache (`scada:fuxa:`), 15s timeout, 30/60/120s backoff, `/css/fuxa-light-theme.css` injection                                                                                                                           |
| `ScadaPanel` composes `FuxaFrame`, rendered from `[department]/page.tsx`                  | ✅ CONFIRMED             | `[department]/page.tsx:199` → `<ScadaPanel departmentId={deptId} />` inside `isControlRoom` branch                                                                                                                                                                                                                |
| "No dedicated `/control-room/page.tsx` = a gap"                                           | ❌ WRONG — **corrected** | `/control-room` is **intentionally** served by the dynamic catch-all `[department]/page.tsx` (`dept.type === "control_room"`), gated by `server/proxy.ts:49` + role map `proxy.ts:79`. The e2e spec `e2e/control-room/scada.spec.ts` navigates `/control-room` and passes. **Not a gap — intended architecture.** |
| e2e tolerates FUXA being down                                                             | ✅ CONFIRMED             | Spec asserts `Connected`.or(`Degraded`).or(`Offline`)                                                                                                                                                                                                                                                             |

**Net:** the UI/embedding layer is sound and matches FUXA's model (iframe of a web SCADA HMI). The defects are **below** the UI: container lifecycle + two broken health/ingest endpoints.

---

## Part 2 — Validated Root-Cause Set (6 causes)

### Container lifecycle (original 4 gaps)

- **C1 Orchestration:** FUXA only starts with `pnpm dev -- -t` (`dev.sh:335` → `dev.sh:692-696`). Plain `pnpm dev` leaves it dead → silent degraded mode.
- **C2 Persistence:** `restart: unless-stopped` never revives an explicitly-stopped container (`docker stop`/`make clean-docker`); `dev.sh:984-989` only warns, never remediates.
- **C3 Portability:** `NEXT_PUBLIC_FUXA_URL=http://192.168.1.52:1881` hardcoded in `.env:48` + `apps/portal/.env:19`. `192.168.1.52` is the host's own DHCP LAN IP (`eno1`) — works only on this network/lease. (Validated: `ip addr` → eno1 192.168.1.52; `ip route get` → local.)
- **C4 Unclean shutdown:** exit 137. FUXA's node process ignores SIGTERM → Docker SIGKILLs after 10s grace. `OOMKilled: false` (validated). No data loss (volume `docker_fuxa_data`).

### Endpoint defects (NEWLY validated — these fire even when the container is healthy)

- **C5 `scada-status` health probe is broken.** `apps/portal/app/api/control-room/scada-status/route.ts` GETs `${fuxaUrl}/api/health`. **FUXA has no `/api/health`** (validated: `GET /api/health` → 404 "Cannot GET /api/health"). Result: `fuxa_healthy=false` → control room reports `degraded`/`offline` **permanently, even when FUXA is up**. The sibling route `apps/portal/app/api/health/fuxa/route.ts` correctly HEADs the **root** `/` (→ 200). The two routes disagree; scada-status is wrong.
- **C6 Telemetry ingest is architecturally mismatched.** `apps/portal/app/api/telemetry/push/route.ts` POSTs to `${fuxaUrl}/api/tag` in **both** code paths (direct tag + Supabase webhook). **FUXA exposes no `/api/tag` endpoint** (validated: `POST /api/tag` → 404). Upstream docs confirm FUXA ingests external data via a **WebAPI _device_ where FUXA _pulls_ from an external `getTags`/`postTags` URL** (`envParams.js` DEVICES), or via server scripts `$setTag` through `POST /api/runscript` (JWT-gated). `FUXA_API_KEY` is unset anywhere in the repo. Result: every telemetry push returns `synced:false`/`success:false` and only writes the Redis cache — operators in "degraded mode" see Redis-cached values, **FUXA never receives telemetry**, and a healthy FUXA dashboard shows stale/empty tags.

---

## Part 3 — Phased Implementation

> Order is by ascending blast radius. Each phase is independently revertible and
> gated by a reproducibility toggle test (§12). No `--no-verify`; husky honored.

### Phase 4 — Clean shutdown (C4) [lowest blast radius, do first]

**Files:** `infra/docker/compose.tools.yml` fuxa service (lines 218-242).
**Change:** add

```yaml
stop_signal: SIGINT
stop_grace_period: 30s
```

**Gate:** `docker stop plantcor-fuxa` → exit code **0** (not 137); `docker start` → healthy within 30s; volume intact (`docker run --rm -v docker_fuxa_data:/d alpine ls /d`).

### Phase 1 — Orchestration: FUXA on plain `pnpm dev` (C1)

**Approach:** split FUXA into a base compose so heavy tools (Flowise/Langfuse/Qdrant/Prometheus) stay opt-in via `-t`.
**Files:**

1. `infra/docker/compose.scada.yml` — NEW. Move the `fuxa` service + `fuxa_data` volume + `plantcor-tools` network ref here (verbatim incl. P4 stop settings).
2. `infra/docker/compose.tools.yml` — remove the `fuxa:` block + `fuxa_data:` volume; keep `plantcor-tools` network.
3. `scripts/dev.sh` — after Redis auto-start (~line 736), add unconditional base boot:
   ```sh
   # 2c. FUXA SCADA dev-sim — always up (lightweight local container, not real hardware)
   if [ -f "$REPO_ROOT/infra/docker/compose.scada.yml" ]; then
     $COMPOSE_CMD -f "$REPO_ROOT/infra/docker/compose.scada.yml" up -d > /dev/null 2>&1
   fi
   ```

**Gate:** `docker rm -f plantcor-fuxa`; `pnpm dev` (NO `-t`) → `docker inspect` `running`/`healthy`, `curl localhost:1881` → 200 ≤15s. `pnpm dev -- -t` still boots full tools stack w/o duplicate-name conflict.

### Phase 2 — Self-heal stopped container (C2)

**Files:** `scripts/dev.sh` replace warn-only block (984-989) with:

```sh
# 4f. FUXA SCADA — self-heal, then health check
FUXA_URL="${NEXT_PUBLIC_FUXA_URL:-http://localhost:1881}"
fuxa_state="$(docker inspect --format='{{.State.Status}}' plantcor-fuxa 2>/dev/null || true)"
if [ "$fuxa_state" = "exited" ]; then
  echo -e "  ${INFO} FUXA stopped — self-healing..."
  docker start plantcor-fuxa > /dev/null 2>&1 || true
  for i in $(seq 1 15); do
    docker inspect --format='{{.State.Health.Status}}' plantcor-fuxa 2>/dev/null | grep -q healthy && break
    sleep 2
  done
fi
if curl -fs "$FUXA_URL" > /dev/null 2>&1; then
  check "FUXA SCADA" "pass" "$FUXA_URL"
else
  check "FUXA SCADA" "warn" "$FUXA_URL not reachable (SCADA degraded mode will activate)"
fi
```

**Gate:** `docker stop plantcor-fuxa`; `pnpm dev` → report `pass` (self-heal logged). Toggle: re-stop → re-run → pass; `docker rm -f` → graceful `warn` (no container).

### Phase 5 — Fix scada-status health probe (C5)

**Files:** `apps/portal/app/api/control-room/scada-status/route.ts`.
**Change:** probe `${fuxaUrl}/` (HEAD, 200) instead of `${fuxaUrl}/api/health` (404). Mirror the correct sibling `api/health/fuxa/route.ts`. Keep the Redis-degraded fallback for the down case.
**Gate:** FUXA up → `/api/control-room/scada-status` returns `status: "healthy"`, `fuxa_healthy: true` (today it returns degraded). Toggle: `docker stop plantcor-fuxa` → `degraded`/`offline`; `docker start` → `healthy`. Re-run `apps/portal/app/api/control-room/scada-status/route.test.ts`.

### Phase 6 — Repair telemetry ingest (C6) ⛔ DECISION GATE D2

**Problem:** `POST ${fuxaUrl}/api/tag` 404s always. Three architecturally-correct options exist; the right one depends on the intended data flow, which I will not guess (§5).

**Decision D2 — choose the ingest model:**

- **(D2-a) Reverse the flow — portal exposes the WebAPI endpoint, FUXA pulls.**
  Stand up a portal route `GET /api/scada/tags` returning the FUXA WebAPI tag-array shape (`[{id,name,value,type}]`), configure a FUXA `WebAPI` device with `getTags` = that URL (via `envParams.js` DEVICES, `--env=` boot). Portal telemetry writes to that same store; FUXA polls it. This matches FUXA's native model. Highest fidelity, most moving parts.
- **(D2-b) Write via FUXA server script `$setTag`.**
  Portal `telemetry/push` calls FUXA `POST /api/runscript` with a script invoking `$setTag(tagId, value)`. Requires FUXA security enabled + a JWT/API key (`FUXA_API_KEY`, currently unset) and a pre-authored FUXA script per tag. Lower infra, needs auth setup.
- **(D2-c) Drop FUXA ingest; make Redis the system of record.**
  Accept that FUXA is a visualization-only dashboard fed by its own device connections (OPC-UA/Modbus/MQTT from real PLCs), and the portal's telemetry cache stays in Redis for the control-room degraded view. Remove the dead `POST /api/tag` calls; document FUXA as out-of-band for portal telemetry. Simplest, honest about the architecture.

**Files (pending D2):** `apps/portal/app/api/telemetry/push/route.ts`, `packages/contract/src/schemas/telemetry.schema.ts`, `libs/shared/utils/src/env.ts` (add `FUXA_API_KEY` to schema if D2-b), possibly new `apps/portal/app/api/scada/tags/route.ts` (D2-a), `docs/operations/fuxa-integration-plan.md`.
**Gate (any branch):** send a telemetry push → confirm the chosen target receives it (FUXA tag updates / Redis count increments / script returns OK). Toggle: stop FUXA → push → graceful `synced:false` + Redis cached.

### Phase 3 — Portability of env URL (C3) ⛔ DECISION GATE D1

**Decision D1 — `NEXT_PUBLIC_FUXA_URL` strategy:**

- **(D1-a)** pin `http://localhost:1881` — portable, but LAN-client iframe (operator tablets) can't reach `localhost`.
- **(D1-b)** dynamic LAN IP at boot → generated gitignored `apps/portal/.env.local` (XDG-clean) — best of both.
- **(D1-c)** keep static `192.168.1.52` — accept fragility, document in runbook.
  **Files (pending D1):** `.env`, `apps/portal/.env`, `scripts/dev.sh` (if D1-b), `docs/operations/FUXA_PRODUCTION_CONFIG.md`.
  **Gate:** chosen branch's toggle test (change host IP simulation → iframe + `/api/health/fuxa` + `/api/control-room/scada-status` all 200; restore → 200).

---

## Part 4 — Decision Gates (BLOCKING, §5 Zero Assumptions)

| Gate   | Question                                                                              | Options                                                                                                 |
| ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **D1** | Do other LAN devices load the portal's FUXA iframe, or is this box local/tunnel-only? | a) localhost / b) dynamic LAN IP / c) keep static                                                       |
| **D2** | How should telemetry reach FUXA?                                                      | a) reverse flow (FUXA pulls from portal) / b) `$setTag` via runscript / c) Redis-only, drop FUXA ingest |

I will not implement Phase 3 or Phase 6 until D1 and D2 are answered.

---

## Part 5 — Global Gates, Cascading Sweep, Commit Plan

1. **Execution order:** P4 → P1 → P2 → P5 → (P3 after D1) → (P6 after D2).
2. **Cascading sweep (§9):** after the compose split — `rg -n "plantcor-fuxa\|fuxa_data\|/api/tag\|/api/health"` across repo; confirm no orphan refs. Check `Makefile` `clean-docker` target and `infra/docker/dashy/user-data/conf.yml` (links FUXA). Update `docs/operations/fuxa-integration-plan.md`, `FUXA_PRODUCTION_CONFIG.md`, `fuxa-troubleshooting.md`.
3. **Quality:** `pnpm lint:root`, `pnpm md:lint` (changed docs), `pnpm --filter portal test -- --testPathPatterns "scada-status|telemetry"` (existing `route.test.ts`), and the control-room e2e `e2e/control-room/scada.spec.ts` with portal + FUXA up. Full `pnpm quality` if time permits.
4. **Commits:** one conventional commit per phase (`fix(scada): clean shutdown`, `feat(scada): always-up dev sim`, `fix(scada): self-heal stopped container`, `fix(scada): correct scada-status health probe`, `feat(scada): <chosen telemetry model>`, `chore(scada): <chosen env strategy>`). Append `AGENT_TRACER.md` + `Continue_here.md` per phase.
5. **Rollback:** each phase independently `git revert`-able. `fuxa_data` volume name unchanged → zero data migration.

---

## Appendix A — RCA Reproducibility Log (2026-08-28)

| Step                                | Command / Source                                        | Result                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Observe stopped container           | `docker ps -a \| grep fuxa`                             | `Exited (137) 43h ago`                                                                                                                                                                        |
| Isolate cause of 137                | `docker inspect … OOMKilled`                            | `false` → external SIGKILL, not OOM                                                                                                                                                           |
| Eliminate "remote SCADA" hypothesis | `ip addr` vs env IP                                     | `192.168.1.52` == host `eno1` (LAN IP)                                                                                                                                                        |
| Reproduce fix                       | `docker compose start fuxa`                             | running/healthy, `:1881` HTTP 200                                                                                                                                                             |
| Re-break (toggle)                   | `docker stop plantcor-fuxa`                             | reproduces "not reachable" warn → C1/C2 confirmed                                                                                                                                             |
| Validate health endpoint            | `curl :1881/api/health`                                 | 404 "Cannot GET /api/health" → C5 confirmed                                                                                                                                                   |
| Validate tag endpoint               | `curl -XPOST :1881/api/tag`                             | 404 → C6 confirmed                                                                                                                                                                            |
| Validate FUXA REST surface          | upstream DeepWiki + container source                    | only `/api/runscript`,`/api/runSysFunction`,`/api/settings`,`/api/alarms`,`/api/users`,`/api/signin`; no tag-write endpoint; WebAPI device = FUXA pulls → C6 architectural mismatch confirmed |
| Validate UI/embedding               | read `FuxaFrame.tsx`, `[department]/page.tsx`, e2e spec | embedding layer sound; `/control-room` served by dynamic catch-all (intended)                                                                                                                 |

## Appendix B — FUXA real API surface (v1.3.4-2890, live-verified)

| Endpoint                           | Status                                | Notes                                       |
| ---------------------------------- | ------------------------------------- | ------------------------------------------- |
| `GET /`                            | 200                                   | Angular HMI — correct health target         |
| `HEAD /`                           | 200                                   | used by portal `/api/health/fuxa` (correct) |
| `GET /api/settings`                | 200                                   |                                             |
| `GET /api/alarms`                  | 200                                   |                                             |
| `GET /api/users`                   | 200                                   |                                             |
| `GET /api/health`                  | **404**                               | ❌ used by `scada-status` (broken)          |
| `POST /api/tag`                    | **404**                               | ❌ used by `telemetry/push` (broken)        |
| `POST /api/runscript`              | exists (docs)                         | `$setTag` path (D2-b)                       |
| `POST /api/runSysFunction`         | exists (docs)                         | admin-gated                                 |
| WebAPI device `getTags`/`postTags` | configured via `envParams.js` DEVICES | D2-a path                                   |
