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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const _require = createRequire(import.meta.url);

async function findAllGlassCss() {
  const root = resolve(__dirname, "..");
  const candidates = [
    // Direct resolution from workspace root
    resolve(root, "node_modules/@liqui-design/glass/dist/glass.css"),
  ];

  // Every pnpm virtual-store variant. Peer-dep suffixes differ per consumer,
  // and the build compiles whichever variant the app links — patching only
  // one (e.g. `head -1`) leaves the live variant broken after a relink.
  try {
    const { execSync } = await import("node:child_process");
    const found = execSync(
      'find node_modules/.pnpm -name "glass.css" -path "*liqui-design*" 2>/dev/null',
      { cwd: root, encoding: "utf-8" },
    ).trim();
    if (found) candidates.push(...found.split("\n"));
  } catch {
    // ignore
  }

  return [...new Set(candidates.filter((candidate) => existsSync(candidate)))];
}

async function patch() {
  const glassCssPaths = await findAllGlassCss();

  if (glassCssPaths.length === 0) {
    console.warn("[patch-glass-css] glass.css not found — skipping patch.");
    return;
  }

  let patchedCount = 0;
  for (const glassCssPath of glassCssPaths) {
    const content = readFileSync(glassCssPath, "utf-8");

    if (!content.includes("@layer base")) {
      continue; // already patched
    }

    // Remove @layer base { ... } — extract inner content only
    const patched = content.replace(/@layer base \{\s*\n(.*?)\n\}/gs, (_, inner) => inner);

    if (patched === content) {
      console.warn(`[patch-glass-css] Regex did not match — check glass.css format: ${glassCssPath}`);
      continue;
    }

    writeFileSync(glassCssPath, patched, "utf-8");
    patchedCount++;
    console.log(`[patch-glass-css] ✓ Patched: ${glassCssPath}`);
  }

  console.log(`[patch-glass-css] ${patchedCount} patched of ${glassCssPaths.length} found.`);
}

patch().catch((err) => {
  console.error("[patch-glass-css] Error:", err.message);
  process.exit(1);
});
