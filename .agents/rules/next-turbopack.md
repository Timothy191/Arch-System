---
name: next-turbopack
description: Invariants for Next.js Turbopack and Service Workers
---

# Next.js Turbopack PWA Constraints

When implementing Service Workers or PWA caching in a Turbopack-enabled Next.js 16 app, NEVER use `next.config.mjs` PWA plugins (`next-pwa`, `@serwist/next`, etc.) as they natively conflict with the Rust compiler.

Always implement a manual `public/sw.js` and register it via a dedicated Client Component (`<ServiceWorkerRegister />`) injected into the root layout.
