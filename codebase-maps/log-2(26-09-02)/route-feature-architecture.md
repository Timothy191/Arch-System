# 🗺️ Route & Feature Architecture Map

**Generated:** 9/2/2026, 9:51:59 AM UTC  
**System:** Arch-Systems Mining Operations Portal (Next.js 16 App Router)

---

## 🏛️ Route Groups & Directory Hierarchy

- `apps/portal/app/`
  - `/` -> Redirects to `/hub`
  - `/hub` — Central Operations Hub & Live Department Grid
  - `/overview` — System Overview Dashboard & Audit Reports
  - `/(auth)/`: Login (`/login`), Password Reset (`/reset-password`), Update Password (`/update-password`)
  - `/(departments)/`:
    - `/control-room` — Live SCADA diagnostics & telemetry monitors
    - `/drilling` — Drill rig operations & bit depth telemetry
    - `/production` — Yield, tonnage & extraction tracking
    - `/engineering` — Maintenance logs, breakdowns & predictive alerts
    - `/access-control` — On-site visitor badging & access logs
    - `/access-card-actions` — Badge printing & QR code generation
    - `/training` — Operator safety certifications & schedules
  - `/api/`: Audit endpoints (`/api/audit`), health checks, webhook handlers

---

## 🔒 Authentication & Middleware Flow
- **Proxy Delegate**: `middleware.ts` delegates token authentication and RBAC checks to `server/proxy.ts`.
- **Exempt Routes**: Auth endpoints (`/login`, `/reset-password`) and system check APIs (`/api/c66`).
- **User Validation**: Server Actions validate credentials at entry via Zod contracts from `@repo/contract`.
