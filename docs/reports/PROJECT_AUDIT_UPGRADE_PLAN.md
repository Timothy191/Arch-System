# Arch‑Systems Project Audit & Upgrade Plan

**Date:** 2026-06-15  
**Scope:** Full‑stack audit, restructuring, optimisation, and phased improvement roadmap for the Arch‑Systems monorepo, industrial portal, and on‑premises infrastructure.

---

## 1. Configuration Audit (`toolchain/`)

- [x] `toolchain/` directory audited – correctly structured, no redundant files
- [x] Tool invocation paths documented (scripts in `package.json`)

**Result:** No changes needed; clean and industry‑standard.

---

## 2. Documentation Restructuring (`docs/`)

- [x] Nested `docs/wiki/wiki/` removed, files merged
- [x] Binary assets (videos/images) moved to `public/media/`
- [x] Diagram generation scripts moved to `ops/docs-generators/`
- [x] `runbooks/` and `control-room/` merged into `operations/runbooks/`
- [x] Scattered root‑level files archived (`archive/`)
- [x] `DOCUMENTATION_INDEX.md` updated to reflect new layout
- [ ] Run automated markdown link checker

**New structure:**  
`docs/operations/`, `docs/wiki/`, `docs/archive/`, `docs/reports/`, assets in `public/media/`.

---

## 3. Infrastructure Audit (`infra/`)

- [x] Audit completed – Compose file scattering, obs/observability overlap, orphaned K8s manifest identified
- [ ] **Pending:** Add `infra/README.md`
- [ ] **Optional:** Consolidate Compose files into `infra/docker/`
- [ ] **Optional:** Reorganize Kubernetes manifests or archive `cache-agent.yaml`

---

## 4. Packages Audit & Documentation (`pkgs/`)

- [x] `pkgs/README.md` created with purpose, consumers, and notes
- [x] All 12 `package.json` files have `description` fields
- [x] `redis` vs `rate‑limiter` dependency analysis – keep separate
- [x] Circular dependency check with Knip – clean
- [x] `eval` package purpose clarified (LLM evaluation)
- [x] `errors` package merge evaluation – keep separate
- [x] Package entry points audit – inconsistency noted (dist vs src); low priority for now

**Result:** Well‑designed; no changes needed immediately.

---

## 5. Nx Workspace Optimizations

- [x] `nx-remotecache-s3` implemented for shared caching (MinIO)
- [ ] Transition from `run-many` to `affected` in CI
- [ ] Utilize `namedInputs.production`
- [ ] Convert `sync-assets.sh` into Nx target
- [ ] Clean stale Turborepo config keys
- [ ] Adopt `nrwl-nx-action` for CI simplification
- [ ] Integrate `nx-stylelint`

**Status:** Remote cache is live; other improvements ready for implementation.

---

## 6. External Tool Evaluations

- [x] Syncpack – already configured; value confirmed
- [x] Nx Rocks – no opportunity (JVM/Flutter only)
- [x] nx-dotnet – no opportunity (no .NET)
- [x] `nrwl-nx-action` – valuable for CI simplification (pending adoption)
- [x] Keadex – valuable for architecture diagrams (optional adoption)
- [x] inovex/elements – niche value for control‑room dashboards (optional)
- [x] nest-vue – irrelevant (different stack)

---

## 7. Phased Upgrade Roadmap

- [ ] **Phase 0 – Trivy & tflint:** Security scanning for Docker images and Terraform
- [ ] **Phase 1 – Playwright:** E2E tests with Nx integration
- [ ] **Phase 2 – Storybook + Chromatic:** Visual regression tests
- [x] **Phase 3 – PWA with Serwist:** Completed (see below)
- [ ] **Phase 4 – OpenAPI / Swagger:** API documentation
- [ ] **Phase 5 – `@nx-tools/nx-container`:** Docker layer caching in Nx
- [ ] **Phase 6 – Open WebUI:** AI operator interface (partially integrated via `dev.sh`)

---

## 8. PWA Implementation & Service Worker Fix (Phase 3)

- [x] Serwist integrated with Next.js
- [x] Custom service worker (`sw.ts`) created with precaching & runtime caching
- [x] Web app manifest added with icons
- [x] Offline page created
- [x] Dev SW interference fixed – service worker disabled in development
- [x] Browser SW unregistered, hard reload confirmed working

---

## 9. `dev.sh` Development Script

- [x] Phase 0 & 1 bugs fixed (asset sync, env copy)
- [x] Full stack validation: Supabase, Postgres, Redis, Ollama
- [x] Open WebUI auto‑start integrated
- [x] Next.js portal starts successfully
- [x] Exit code 15 handled gracefully

---

## 10. Stack Completeness Assessment

- [x] Entire stack catalogued and confirmed correct
- [x] TypeScript/Next.js is the right choice; no language/framework change needed
- [x] Polyglot additions only as sidecars if needed

---

## 11. Remaining Documentation & Housekeeping

- [ ] Update `SUPPORT.md` with new structure links, remote cache, operations docs
- [ ] Replace placeholder GitHub URLs
- [ ] Verify all internal links post‑restructure
- [ ] Archive one‑off scripts (`reorganize.mjs`, `deploy-overview.sh`, `deploy-live-local.sh`, `ensure_reachability.py`, `pentest.sh`)
- [ ] Add `infra/README.md`
- [ ] Standardize package entry points (low priority)

---

## 12. Production Hardening (New)

- [ ] **MinIO Cache Bucket Security**: Tighten bucket policies on MinIO. Restrict access specifically to Nx cache operations via dedicated, read/write‑limited IAM policies instead of wide‑open permissions.
- [ ] **PWA Icon Validation**: Validate presence, resolution formats (PNG), and size constraints (e.g., 72x72 up to 512x512) of all referenced icons in `public/icons/` to guarantee compliant application installations across Android/iOS browsers.
- [ ] **Service Worker Cache Versioning**: Implement build‑specific service worker versioning using git commit hashes or build timestamps. Prevents user browsers from serving stale cache versions after portal updates.
- [ ] **`dev.sh` Process & File Cleanup**: Clean temporary files, pid trackers, and ensure rigorous SIGTERM/SIGINT cleanup of Ollama and Open WebUI background processes.
- [ ] **Supabase RLS Policy Audit**: Perform complete audit of Row Level Security (RLS) policies on all database tables in `pkgs/database` to verify authentication boundaries are enforced.

---

## 13. Complete Upgrade Checklist

### Config

- [x] `toolchain/` audited
- [x] Tool paths documented

### Docs

- [x] Nested wiki removed
- [x] Binary assets relocated
- [x] Diagram generators moved
- [x] Runbooks & control‑room merged
- [x] Root files archived
- [x] Index updated
- [ ] Link checker run

### Infra

- [x] Audit done
- [ ] `infra/README.md`
- [ ] Compose consolidation (optional)
- [ ] K8s manifest archived (optional)

### Packages

- [x] `pkgs/README.md` created
- [x] `description` fields added
- [x] `redis`/`rate‑limiter` separation confirmed
- [x] Circular deps clean
- [x] `eval` clarified
- [x] `errors` separate
- [x] Entry point audit done

### Nx

- [x] Remote cache live
- [ ] `affected` in CI
- [ ] `namedInputs.production`
- [ ] `sync-assets` Nx target
- [ ] Turborepo cleanup
- [ ] `nrwl-nx-action`
- [ ] `nx-stylelint`

### CI & Testing

- [ ] Phase 0 – Trivy / tflint
- [ ] Phase 1 – Playwright
- [ ] Phase 2 – Storybook / Chromatic
- [x] Phase 3 – PWA
- [ ] Phase 4 – OpenAPI
- [ ] Phase 5 – Docker caching
- [ ] Phase 6 – Open WebUI

### PWA

- [x] Integration done
- [x] SW created
- [x] Manifest added
- [x] Offline page
- [x] Dev fix applied

### dev.sh

- [x] Bugs fixed
- [x] Stack validation
- [x] Open WebUI optional start
- [x] Portal starts
- [x] SIGTERM cleanup

### Stack assessment

- [x] Stack correct
- [x] No language changes

### Tools

- [x] Syncpack
- [x] Nx Rocks (none)
- [x] nx-dotnet (none)
- [x] nrwl-nx-action (pending)
- [x] Keadex (optional)
- [x] inovex/elements (optional)
- [x] nest-vue (none)

### Housekeeping

- [ ] `SUPPORT.md` update
- [ ] Placeholder URLs
- [ ] Link checker
- [ ] Script archive
- [ ] `infra/README.md`
- [ ] Entry point standardisation (low)

### Production Hardening

- [ ] MinIO bucket policies hardened
- [ ] PWA icons validated in `public/icons/`
- [ ] SW cache versioning implemented (build hashes)
- [ ] `dev.sh` cleanup scripts verified
- [ ] Supabase RLS policies audited

---

_This document is the complete record of the Arch‑Systems project audit, restructuring, and upgrade roadmap as of 2026-06-15._
