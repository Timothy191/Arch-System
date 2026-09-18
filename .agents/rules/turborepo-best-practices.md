# Turborepo & Monorepo Best Practices

## 0. Purpose & Scope
This document defines the architectural invariants and strict rules for managing the Arch-System enterprise monorepo using Turborepo and pnpm workspaces. These rules ensure seamless functionality, maximize build caching, prevent bundle bloat, and maintain strict dependency boundaries.

---

## 1. Package Graph & Dependencies

**T1 — Explicit Workspace Protocols:** 
Always use the `workspace:*` protocol in `package.json` when linking internal packages (e.g., `"@repo/ui": "workspace:*"`). Never use explicit version strings for internal links, and do not rely on implicit hoisting.
*Why:* Ensures the package manager always links the local source instead of attempting to fetch from an external registry.

**T2 — Strict Directional Flow:**
Internal packages (`@repo/*`) must NEVER import from application packages (`apps/*`). Dependencies must strictly flow one way: `apps` consume `packages`, and `packages` may consume other `packages`.
*Why:* Prevents circular dependencies and maintains the structural integrity of the monorepo graph.

**T3 — Single Responsibility Packages:**
Avoid monolithic "kitchen-sink" packages (e.g., `@repo/shared`). Break functionality into highly granular, single-purpose internal packages (e.g., `@repo/ui`, `@repo/utils`, `@repo/errors`, `@repo/database`).
*Why:* Maximizes cache hit rates. If you change a utility function, you shouldn't invalidate the cache for the entire UI component library.

---

## 2. Exports, Transpilation & Bundle Bloat

**T4 — Source-Level Internal Packages:**
Do NOT use bundlers (tsup, Rollup, Webpack) to pre-compile internal packages unless they are being published to a public registry. Instead, point `package.json` fields directly to the TypeScript source (e.g., `"main": "./src/index.ts"` or `"exports": { ".": "./src/index.ts" }`).
*Why:* Allows the consuming application's bundler (Next.js/Turbopack) to handle the compilation, enabling dead-code elimination, tree-shaking, and seamless hot-module replacement (HMR) across workspace boundaries.

**T5 — Explicit Transpilation in Next.js:**
Because internal packages are provided as raw TypeScript, they MUST be explicitly added to the `transpilePackages` array in the consuming application's `next.config.mjs`.
*Why:* Next.js ignores `node_modules` and symlinked workspaces by default. `transpilePackages` instructs the Next.js compiler to process them.

**T6 — Granular Exports Over Deep Barrel Files:**
Do not export an entire library through a single root `index.ts` (barrel file) if the library is large. Utilize the `exports` field in `package.json` to expose specific entry points (e.g., `"exports": { "./components": "./src/components/index.ts", "./hooks": "./src/hooks/index.ts" }`).
*Why:* Prevents the bundler from parsing massive dependency trees for a single import, severely reducing bundle bloat and memory usage during development.

---

## 3. Turbo Pipeline & Caching Invariants

**T7 — Outputs Are Mandatory:**
Every script in `turbo.json` that generates artifacts (e.g., `build`) MUST define the `outputs` array (e.g., `"outputs": ["dist/**", ".next/**"]`). 
*Why:* If Turborepo doesn't know where the build artifacts are, it cannot cache them, rendering the build system completely ineffective.

**T8 — Topological Execution (`^` Prefix):**
When a task depends on the same task running in its dependencies, you MUST use the `^` prefix in `dependsOn` (e.g., `"dependsOn": ["^build"]`).
*Why:* Ensures Turborepo builds `@repo/ui` *before* attempting to build `apps/portal` which depends on it.

**T9 — Environment Variable Fingerprinting:**
Any environment variable that changes the output of a build MUST be declared in the `env` array for that task in `turbo.json`.
*Why:* Turborepo includes these variables in the cache key fingerprint. If you omit them, switching an env var will not trigger a rebuild, resulting in stale cached artifacts.

---

## 4. Workflows & Orchestration

**T10 — Package-Level Script Definitions:**
Define atomic commands (`lint`, `type-check`, `test`) in individual package `package.json` files, then orchestrate them globally from the root using Turbo (`pnpm turbo run lint`).
*Why:* Reinvents the wheel to write bash scripts looping over packages. Turborepo handles parallelization and caching automatically.

**T11 — Docker Pruning:**
When building Docker images for deployment, ALWAYS utilize `turbo prune --scope=<app-name> --docker` to generate an isolated subset of the monorepo.
*Why:* Prevents copying unrelated packages into the Docker context, drastically reducing image sizes and build times.

---

## 5. Next.js & Turbopack Synergies

**T12 — `optimizePackageImports` for External Barrels:**
For heavy third-party libraries (e.g., `lucide-react`, `@tremor/react`), leverage Next.js `experimental.optimizePackageImports`.
*Why:* Tree-shakes the libraries at the compiler level without needing to resolve the entire dependency tree.

**T13 — Turbopack Monorepo Root:**
When using Turbopack in a monorepo, explicitly configure the root in Next.js config: `turbopack: { root: path.resolve(__dirname, "../..") }`.
*Why:* Ensures Turbopack correctly watches and recompiles files from cross-repo symlinked internal packages.

