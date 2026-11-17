# Security Policy

## Supported Versions

Arch-System (`Plantcor / Arch OS`) deploys continuously from `main` to Vercel Production (`Next.js 16` + `React 19` on `Node.js >= 24`). Security fixes land directly on `main`.

| Version / Branch | Supported |
| :--------------- | :-------- |
| `main` (`1.6.x`) | Yes       |
| Older snapshots  | No        |

## Reporting a Vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately through [GitHub Private Vulnerability Reporting](https://github.com/Timothy191/Arch-System/security/advisories/new) with:

1. Affected route, Server Action, package, or SQL migration path.
2. Minimal reproduction steps or proof of concept.
3. Impact assessment (authentication, RBAC/RLS tenant boundary, CSP, rate limiting, or supply chain).

Reports are triaged within 48 hours and remediated through the repository's 28-gate verification pipeline (`pnpm agent:verify` + `pnpm policy:security --ci`).

## Enforced Security Controls

- **Edge & Request Protection**: Per-request cryptographic CSP nonces in `apps/portal/proxy.ts` and Supabase SSR claim verification + Redis session privilege revocation in `apps/portal/server/proxy.ts`.
- **Canonical 8-Step Mutation Sequence**: Every Server Action and protected Route Handler enforces `Authenticate -> Authorize -> Validate (@repo/contract Zod 4) -> Rate-limit -> Execute -> Audit log -> Invalidate cache -> Return typed result`.
- **PostgreSQL 17 Row-Level Security**: Every `public` table enables RLS consulting `(SELECT auth.uid())` and `public.employees` (`pnpm audit:rls-matrix`).
- **Secret & Supply-Chain Hygiene**: GitHub Secret Scanning, Push Protection, Dependabot alerts across `npm`, `cargo`, `pip`, and `github-actions`, and `pnpm policy:security --ci` static gates.
