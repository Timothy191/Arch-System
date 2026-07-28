# Bolt's Performance Journal

## 2026-06-25 - prom-client Next.js Edge Runtime Compatibility

**Learning:** Static top-level imports of packages like `prom-client` in utility modules (e.g. `metrics.ts`) that are transitively imported by Edge Middleware (`middleware.ts` -> `proxy.ts` -> `metrics.ts`) will evaluate at compile/boot-time in the Edge Runtime. Since `prom-client` dynamically executes Node-specific APIs like `process.uptime` or imports `cluster` on module evaluation, it crashes the entire Edge Runtime context immediately.

**Action:** Replace top-level static imports of libraries that depend on Node.js globals/APIs with runtime dynamic imports (`await import(...)`) encapsulated inside lazy initialization helper functions (e.g., `ensureInitialized()`). Only invoke these initializers inside Node/Serverless API routes, keeping the Edge execution path completely clean.
