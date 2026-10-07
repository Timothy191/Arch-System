# Vercel Infrastructure & Fluid Compute Reference

This document synthesizes Vercel's architectural concepts (as of 2026) to guide agents in debugging, deploying, and optimizing applications in this workspace.

## 1. Fluid Compute (Serverless Evolution)

- **Model:** Vercel Functions now use **Fluid Compute** (default since April 2025). This replaces the traditional "one request per instance" serverless model.
- **Optimized Concurrency:** A single function instance can handle _multiple_ concurrent invocations. This maximizes CPU usage and reduces cold starts.
- **Billing:** Billed on **Active CPU** (time your code actually computes, not when it's idle waiting on I/O) and provisioned memory.
- **Background Work:** Use the `waitUntil` API to continue background execution (like logging or analytics) after returning a fast HTTP response to the user.
- **Failover:** Automatic availability zone failover is built-in.

## 2. Request Flow

1. **Anycast Routing:** Requests hit a global load balancer and enter Vercel's private fiber network via the closest PoP.
2. **Security Layer (L3-L7):** TLS termination and system-wide DDoS mitigation analyze fingerprints. Custom WAF rules are applied here. _(Note: When debugging 500s or timeouts, consider WAF or DDoS rules blocking traffic)._
3. **Application-Aware Proxy:** The proxy reads deployment metadata (from `vercel.json` or `next.config.js`) to evaluate Static vs. Dynamic routes, Rewrites, Redirects, and Routing Middleware.
4. **Caching / ISR:** Static assets and Incremental Static Regeneration (ISR) pages are served from the CDN Cache.
5. **Compute:** Dynamic requests hit Fluid Compute instances.

## 3. Build & Deployment Architecture

- **Framework Detection:** Vercel auto-detects frameworks (Next.js, NestJS, Vite, etc.) to set default build commands.
- **Package Managers:** The build process strictly honors lockfiles (`pnpm-lock.yaml`, `package-lock.json`). Vercel intelligently caches dependencies between builds.
- **Build Output API:** All builds ultimately compile down to the `.vercel/output` directory specification, separating static assets and compute functions.
- **Timeouts:** Builds must complete within strict timeout limits depending on the Vercel plan; caching and optimizing `pnpm build` is critical.

## 4. Key Takeaways for Agents

- When debugging Vercel deployment timeouts or 500 errors, evaluate if the traffic is blocked by the **WAF**, failing in the **Routing Middleware**, or dropping connections within **Fluid Compute** state limits.
- Leverage `waitUntil` for non-blocking I/O tasks.
- If dependencies fail to install remotely, ensure the Vercel remote build command explicitly matches the local package manager (e.g., overriding to `pnpm install` if Turborepo or lockfile drift causes Vercel to fallback to `npm`).
