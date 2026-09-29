---
name: next-turbopack
description: 'Next.js 16 Turbopack, Lightning CSS, and Lazy Loading runbook: incremental bundling, turbopack.root monorepo resolution, next/dynamic SSR isolation, magic comments, and bundle budgeting.'
version: '1.0.0'
---

# Next.js 16 Turbopack & Lazy Loading Runbook

**Governing Mandate:** Arch-System leverages Next.js 16's native Rust-powered **Turbopack** incremental bundler for development and production compilation. Monorepo module resolution across `@repo/*` workspace packages is anchored by `turbopack.root` in `apps/portal/next.config.mjs`. Large client-side components and heavy libraries (data grids, workflow canvases, PDF generators) must be deferred via `next/dynamic` and dynamic `import()` to enforce a strict client asset budget (<= 1.0 MB max asset size).

---

## 1. Core Invariants & Rules

1. **Rule TURBO-001 (Monorepo Root & Workspace Resolution)**:
   - Turbopack resolves modules relative to its root directory. In a pnpm monorepo with cross-package symlinks, `turbopack.root` in `apps/portal/next.config.mjs` MUST be set to `workspaceRoot` (the monorepo root), paired with `outputFileTracingRoot`.
   - Never rely on default CWD resolution when packages or tools live outside `apps/portal`.

2. **Rule TURBO-002 (SSR Isolation in Dynamic Imports)**:
   - The option `{ ssr: false }` inside `next/dynamic()` is **strictly restricted to Client Components (`'use client'`)**.
   - **Hard Negative**: NEVER pass `{ ssr: false }` to `dynamic()` inside a Server Component. Next.js will throw a build/runtime error. If SSR must be disabled, isolate the dynamic import inside a dedicated client wrapper component.

3. **Rule TURBO-003 (Magic Comments Invariant)**:
   - For runtime-only dynamic imports that should skip bundling, use `/* webpackIgnore: true */` or `/* turbopackIgnore: true */`.
   - For optional features or modules that may not be installed in all environments, use `/* turbopackOptional: true */`.
   - **Hard Negative**: NEVER use `/* webpackOptional: true */` — it is unsupported by Turbopack.

4. **Rule TURBO-004 (Babel & SWC Coexistence in Monorepos)**:
   - Turbopack uses SWC for core transforms and automatically detects Babel if config files are present.
   - In monorepos, use a root `babel.config.json` (or `rootMode: "upward"`), and configure `babelrcRoots: [".", "packages/*"]`.
   - In JS-based Babel configs, ALWAYS manage caching via `api.cache.using(() => process.env.NODE_ENV)` or `api.cache.forever()`; never leave config functions unmemoized.

5. **Rule TURBO-005 (Lightning CSS Precision & Ordering)**:
   - Turbopack compiles CSS using Lightning CSS in Rust with 5-digit decimal precision (`1.47059` vs Webpack's 10 digits `1.4705882353`). Layout and typography calculations must not rely on sub-pixel fractions beyond 5 decimals.
   - CSS Module ordering strictly follows JS import order. When CSS precedence matters, enforce ordering via explicit imports or CSS `@import`.
   - Custom Sass JS functions (`sassOptions.functions`) are unsupported because Turbopack cannot call Node.js JS functions from Rust.

6. **Rule TURBO-006 (Statically Analyzable `import.meta.env`)**:
   - Utilize Turbopack's native compile-time `import.meta.env` (`DEV`, `PROD`, `MODE`, `BASE_URL`, `SSR`) for dead-branch elimination and bundle tree-shaking.

7. **Rule TURBO-007 (Heavy Library Chunk Budget)**:
   - Heavy dependencies (e.g. `@react-pdf/renderer`, `exceljs`, `@xyflow/react`, `recharts`, `swagger-ui-react`) MUST NOT be synchronously imported in root layouts (`app/layout.tsx`).
   - Defer them via `next/dynamic` with skeleton loading states or dynamic `import()` on user interaction.

---

## 2. Implementation Recipes & Code Patterns

### Recipe A: Client Component Lazy Loading with `ssr: false`

```tsx
'use client';

import dynamic from 'next/dynamic';
import { KPISkeleton } from '@repo/ui';

// Heavy visualizer loaded only on the client
export const WorkflowCanvas = dynamic(
  () => import('@repo/ui/WorkflowBuilder').then((mod) => mod.WorkflowBuilder),
  {
    loading: () => <KPISkeleton />,
    ssr: false, // Valid strictly in Client Components
  }
);
```

### Recipe B: Server Component Dynamic Component Streaming

```tsx
import dynamic from 'next/dynamic';

// Server Component dynamically importing a component with SSR enabled
const TelemetryGrid = dynamic(
  () => import('@/components/TelemetryGrid').then((mod) => mod.TelemetryGrid),
  {
    loading: () => <div className="p-4 animate-pulse">Loading telemetry...</div>,
    // Note: ssr: false is NOT permitted here in a Server Component!
  }
);

export default function OperationsPage() {
  return (
    <div className="space-y-4">
      <h1>Pit Operations</h1>
      <TelemetryGrid />
    </div>
  );
}
```

### Recipe C: On-Demand Library Loading on User Action

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@repo/ui';

export function ExportShiftReportButton({ shiftId }: { shiftId: string }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Lazy load heavy Excel generator only when user initiates download
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Shift Closeout');
      sheet.addRow(['Metric', 'Value']);
      sheet.addRow(['Shift ID', shiftId]);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shift-${shiftId}.xlsx`;
      a.click();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading}>
      {loading ? 'Generating...' : 'Export Excel'}
    </Button>
  );
}
```

### Recipe D: Turbopack Magic Comments for Optional Modules

```ts
export async function loadOptionalAddon(addonName: string) {
  try {
    // Turbopack suppresses build errors if the module does not exist on disk
    const addon = await import(/* turbopackOptional: true */ `@arch-addons/${addonName}`);
    return addon.default;
  } catch (err) {
    console.info(`Optional addon ${addonName} is not installed; skipping.`);
    return null;
  }
}
```

### Recipe E: Vite-Compatible Module Globbing with `import.meta.glob`

```ts
// Lazy thunks (default)
const departmentPanels = import.meta.glob('./panels/*.tsx');

export async function loadPanel(panelName: string) {
  const loader = departmentPanels[`./panels/${panelName}.tsx`];
  if (!loader) throw new Error(`Unknown panel: ${panelName}`);
  const module = await loader();
  return module.default;
}
```

---

## 3. Turbopack Configuration Reference (`apps/portal/next.config.mjs`)

```javascript
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
    resolveAlias: {
      // Custom manual module aliases
    },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json', '.mjs'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@tremor/react', '@xyflow/react'],
  },
};
```

---

## 4. Verification & Quality Gates

Run the dedicated Turbopack and lazy loading audit:

```bash
pnpm audit:turbopack
```

Or verify across the full compliance suite:

```bash
pnpm audit:compliance
```
