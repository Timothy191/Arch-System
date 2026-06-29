# PWA Audit Report

**Date:** 2025-06-23
**Scope:** Phase 3 – Offline & Progressive Web App Implementation

## Current PWA Status

### ✅ What's Already Configured

1. **PWA Library**: `@ducanh2912/next-pwa` (v10.2.9) is integrated
   - Location: `apps/portal/package.json` (line 8)
   - Config: `apps/portal/next.config.mjs` (lines 161-201)

2. **Web App Manifest**: Complete manifest at `apps/portal/public/manifest.json`
   - Name: "Arch-Systems | Arch OS"
   - Short name: "Arch Portal"
   - Display mode: `standalone`
   - Theme color: `#f5f5f7`
   - Includes app shortcuts for Hub Dashboard and Control Room

3. **Service Worker Configuration** (Workbox-based):
   - **Static assets**: CacheFirst strategy (30 days cache, 200 entries)
   - **API routes (non-auth)**: NetworkFirst with 10s timeout (5 min cache, 50 entries)
   - **General pages**: NetworkFirst with 10s timeout (24 hour cache, 100 entries)
   - PWA only enabled in CI/production (saves build time locally)

4. **Offline Detection**: `OfflineBanner` component (`apps/portal/components/OfflineBanner.tsx`)
   - Tracks online/offline state
   - Monitors IndexedDB sync queue (`ArchSyncDB`)
   - Shows pending action count while offline
   - Displays sync status when reconnecting

5. **PWA Metadata in Root Layout**:
   - `manifest: "/manifest.json"` in metadata
   - Apple web app capable
   - Theme color in viewport config
   - Proper CSP headers for service worker

### ❌ Critical Issues Found

1. **Missing PWA Icons** (CRITICAL)
   - Manifest references 8 icon sizes (72x72 to 512x512) in `/icons/`
   - `public/icons/` directory exists but is **completely empty**
   - **Impact**: PWA cannot be installed; browsers will reject installation
   - **Required**: Generate all icon sizes from existing assets

2. **No Production Service Worker Registration**
   - `ClientProviders.tsx` only unregisters SW in development mode
   - No registration code for production builds
   - **Impact**: Service worker never activates in production
   - **Required**: Add SW registration for production

3. **Library Compatibility Issue**
   - Using `@ducanh2912/next-pwa` (deprecated for Next.js 16)
   - Project uses Next.js 16.2.6
   - **Recommendation**: Migrate to `@serwist/next` (modern successor with full Next.js 16+ support)

4. **No Install Prompt Handling**
   - No `beforeinstallprompt` event listener
   - No UI for users to trigger PWA installation
   - **Impact**: Users won't see install prompts consistently
   - **Required**: Add install button/prompt handler

5. **PWA Disabled in Local Development**
   - PWA config uses `enableHeavyPlugins` check (CI or env var)
   - Service worker only registered in CI/production builds
   - **Impact**: Cannot test PWA behavior locally without env var
   - **Note**: This is intentional to save build time, but makes local PWA testing difficult

### ⚠️ Potential Issues

1. **API Caching Strategy**
   - Current: NetworkFirst for all non-auth APIs with 5 min cache
   - **Risk**: Stale data if offline cache is used for dynamic dashboard data
   - **Recommendation**: Consider StaleWhileRevalidate for real-time telemetry endpoints

2. **Sync Queue Implementation**
   - `OfflineBanner` references `ArchSyncDB` IndexedDB
   - No evidence of actual sync queue implementation in codebase
   - **Question**: Is sync queue functional or just UI stub?

3. **No PWA-Specific Tests**
   - No E2E tests for offline behavior
   - No tests for service worker registration
   - No tests for install prompt flow

## Phase 3 Plan Review

### Original Plan Assessment

| Step                   | Status         | Notes                                                 |
| ---------------------- | -------------- | ----------------------------------------------------- |
| Install @serwist/next  | ✅ Correct     | Migration needed from deprecated @ducanh2912/next-pwa |
| Wrap next.config.js    | ✅ Mostly done | Config exists, needs migration to Serwist             |
| Create manifest.json   | ✅ Done        | Manifest exists and is complete                       |
| Test offline behaviour | ⚠️ Blocked     | Cannot test without icons and SW registration         |
| Verify PWA on mobile   | ❌ Blocked     | Cannot install without icons                          |

### Revised Implementation Plan

**Priority 1 (Critical - Must Fix First):**

1. Generate missing PWA icons from existing logo assets
2. Add production service worker registration
3. Add install prompt handling UI

**Priority 2 (Migration):** 4. Migrate from `@ducanh2912/next-pwa` to `@serwist/next` 5. Review and optimize caching strategies for offline dashboards

**Priority 3 (Testing):** 6. Add E2E tests for offline behavior 7. Test PWA installation on actual mobile/tablet devices

## Phase 4 Plan Assessment (API Documentation)

**Original Plan:** Use `next-swagger-doc` for auto-generating OpenAPI docs

**Assessment:**

- ✅ Feasible and low-risk
- ✅ No conflicts with existing setup
- ⚠️ Consider using `@repo/contract` integration for type safety
- ⚠️ API routes need JSDoc annotations added

**Recommendation:** Proceed with Phase 4 after Phase 3 completion.

## Phase 5 Plan Assessment (Docker Build Caching)

**Original Plan:** Use `@nx-tools/nx-container` for Docker layer caching

**Assessment:**

- ✅ Nx already configured (`nx.json` present)
- ✅ Good alignment with existing Nx task orchestration
- ⚠️ Requires cache registry setup (MinIO or GitHub Actions cache)
- ⚠️ Will need to modify existing Docker Compose workflows

**Recommendation:** Good optimization, but ensure cache registry costs/benefits are evaluated.

## Phase 6 Plan Assessment (AI Operator Interface)

**Original Plan:** Deploy Open WebUI with Ollama for internal documentation chat

**Assessment:**

- ✅ Aligns with existing AI/LLM initiatives
- ⚠️ Requires Ollama deployment (not currently in stack)
- ⚠️ Security consideration: Ensure document access control
- ⚠️ Infrastructure impact: GPU resources for Ollama

**Recommendation:** Evaluate resource requirements and security model before implementation.

## Next Steps

1. **Immediate (Phase 3):**
   - Generate PWA icons
   - Add service worker registration
   - Add install prompt UI
   - Migrate to Serwist
   - Test offline behavior

2. **Short-term (Phase 4):**
   - Integrate `next-swagger-doc`
   - Add JSDoc to API routes
   - Set up `/api-docs` endpoint
   - Validate against `@repo/contract`

3. **Medium-term (Phase 5):**
   - Evaluate `@nx-tools/nx-container`
   - Set up layer cache registry
   - Integrate into Nx task graph

4. **Long-term (Phase 6):**
   - Assess Ollama resource requirements
   - Design document ingestion pipeline
   - Implement access controls for AI interface

## Risk Summary

| Risk                               | Severity   | Mitigation                                      |
| ---------------------------------- | ---------- | ----------------------------------------------- |
| Missing icons blocking PWA install | HIGH       | Generate icons from existing assets immediately |
| SW not registering in production   | HIGH       | Add registration code to ClientProviders        |
| Library deprecation (Next.js 16)   | MEDIUM     | Migrate to Serwist as planned                   |
| Stale data in offline cache        | MEDIUM     | Review caching strategies per endpoint          |
| Ollama resource requirements       | LOW-MEDIUM | Assess before Phase 6                           |

---

## Final Implementation (June 23, 2026)

Due to Turbopack incompatibility with PWA plugins, a manual service worker approach was implemented instead of the planned Serwist migration.

### Implementation Summary

**Completed Tasks:**

1. ✅ **Generated PWA Icons**: All 8 icon sizes created from logo.png using ImageMagick
2. ✅ **Manual Service Worker**: Created `public/sw.js` with custom caching strategies
3. ✅ **SW Registration**: Added production registration in ClientProviders.tsx
4. ✅ **Install Prompt UI**: Created PWAInstallButton component with beforeinstallprompt handling
5. ✅ **Manifest Verification**: Confirmed manifest.json is properly configured

**Turbopack Workaround:**

- Both `@ducanh2912/next-pwa` and `@serwist/next` are incompatible with Next.js 16 + Turbopack
- Service worker plugins fail to generate SW files during Turbopack builds
- **Solution**: Manually maintained service worker at `public/sw.js`
- **Future**: Re-evaluate when Turbopack adds PWA plugin support

### Service Worker Configuration

**Caching Strategies:**

- **Static Assets** (`/_next/static/*`): CacheFirst - permanent cache for optimal performance
- **API Routes** (`/api/*` excluding `/api/auth/*`): NetworkFirst with 10s timeout - ensures fresh data with offline fallback
- **Supabase Images**: CacheFirst - optimize image loading
- **HTML Pages**: NetworkFirst with cache fallback - balance freshness with offline access

**Cache Management:**

- Cache versioning: `arch-portal-v1`, `arch-static-v1`, `arch-api-v1`
- Automatic cleanup of old caches on SW activation
- Skip waiting for immediate updates
- Clients claim for instant activation

### Testing Recommendations

**Offline Behavior Testing:**

1. Use Chrome DevTools Application tab
2. Enable "Offline" mode in Network throttling
3. Navigate to key routes: `/`, `/drilling`, `/control-room`
4. Verify static assets load from cache
5. Test API routes fall back to cache when offline
6. Verify OfflineBanner displays correctly

**Install Testing:**

1. Test on actual mobile/tablet devices (Chrome Android, Safari iOS)
2. Verify install prompt appears on first visit
3. Test PWAInstallButton component functionality
4. Confirm app launches in standalone mode
5. Verify icons and theme color display correctly
6. Test app shortcuts (Hub Dashboard, Control Room)

### Updated Risk Summary (Post-Implementation)

| Risk                                 | Severity | Status      | Mitigation                              |
| ------------------------------------ | -------- | ----------- | --------------------------------------- |
| Turbopack PWA plugin incompatibility | HIGH     | ✅ RESOLVED | Manual service worker implemented       |
| Manual SW maintenance burden         | MEDIUM   | ACCEPTED    | Documented in AGENT_TRACER.md           |
| No automated SW updates              | LOW      | ACCEPTED    | Re-evaluate when Turbopack adds support |
| Testing on actual devices required   | MEDIUM   | PENDING     | Schedule device testing phase           |

### Next Steps

1. **Phase 3 Completion:**
   - ✅ Generate PWA icons
   - ✅ Add service worker registration
   - ✅ Add install prompt UI
   - ⏳ Test offline behavior on actual devices
   - ⏳ Test PWA installation on mobile/tablet

2. **Short-term (Phase 4):**
   - Integrate `next-swagger-doc`
   - Add JSDoc to API routes
   - Set up `/api-docs` endpoint
   - Validate against `@repo/contract`

3. **Medium-term (Phase 5):**
   - Evaluate `@nx-tools/nx-container`
   - Set up layer cache registry
   - Integrate into Nx task graph

4. **Long-term (Phase 6):**
   - Assess Ollama resource requirements
   - Design document ingestion pipeline
   - Implement access controls for AI interface

5. **Future PWA Enhancements:**
   - Re-evaluate PWA plugin migration when Turbopack adds support
   - Consider background sync for offline actions
   - Add push notification support for critical alerts
   - Implement periodic cache updates for dashboard data
