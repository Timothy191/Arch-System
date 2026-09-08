#!/usr/bin/env node
/**
 * patch-glass-css.mjs
 *
 * Patches @liqui-design/glass/dist/glass.css to remove the @layer base wrapper.
 *
 * PROBLEM:
 *   Turbopack (Next.js 16) processes node_modules CSS files in a standalone
 *   PostCSS pass. glass.css uses `@layer base { .liqui-glass { ... } }` which
 *   requires `@tailwind base` to be present in the same PostCSS run.
 *   Without it, PostCSS throws: "CssSyntaxError: @layer base is used but no
 *   matching @tailwind base directive is present."
 *
 * FIX:
 *   The glass.css comment itself says: "With no Tailwind present the layer is
 *   created here and any unlayered consumer CSS beats it — which is what a
 *   default should do." So it is safe to remove @layer base and declare the
 *   rule directly. Tailwind utilities will still override it.
 *
 * MAINTENANCE:
 *   When upgrading @liqui-design/glass, re-run this script and check if the
 *   upstream package has fixed the Turbopack compatibility issue.
 *
 * USAGE:
 *   node scripts/patch-glass-css.mjs
 *   (also called automatically by pnpm postinstall via package.json)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);

function findGlassCss() {
  // Try direct resolution from workspace root
  const root = resolve(__dirname, "..");
  const candidates = [
    resolve(root, "node_modules/@liqui-design/glass/dist/glass.css"),
    resolve(
      root,
      "node_modules/.pnpm/@liqui-design+glass@0.2.2_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/@liqui-design/glass/dist/glass.css"
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // Fallback: glob search for pnpm virtual store path
  try {
    const { execSync } = await import("node:child_process");
    const result = execSync(
      'find node_modules/.pnpm -name "glass.css" -path "*liqui-design*" 2>/dev/null | head -1',
      { cwd: root, encoding: "utf-8" }
    ).trim();
    if (result && existsSync(result)) return result;
  } catch {
    // ignore
  }

  return null;
}

async function patch() {
  const glassCssPath = await findGlassCss();

  if (!glassCssPath) {
    console.warn("[patch-glass-css] glass.css not found — skipping patch.");
    return;
  }

  const content = readFileSync(glassCssPath, "utf-8");

  if (!content.includes("@layer base")) {
    console.log("[patch-glass-css] Already patched — no @layer base found.");
    return;
  }

  // Remove @layer base { ... } — extract inner content only
  const patched = content.replace(/@layer base \{\s*\n(.*?)\n\}/gs, (_, inner) => inner);

  if (patched === content) {
    console.warn("[patch-glass-css] Regex did not match — check glass.css format.");
    return;
  }

  writeFileSync(glassCssPath, patched, "utf-8");
  console.log(`[patch-glass-css] ✓ Patched: ${glassCssPath}`);
}

patch().catch((err) => {
  console.error("[patch-glass-css] Error:", err.message);
  process.exit(1);
});
