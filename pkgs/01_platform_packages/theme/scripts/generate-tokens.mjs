#!/usr/bin/env node
/**
 * generate-tokens.mjs
 * Arch System — Token Generation Script
 *
 * Parses pkgs/theme/src/css/variables.css and emits a typed TypeScript
 * token map at pkgs/theme/src/tokens/generated.ts.
 *
 * Run: node pkgs/theme/scripts/generate-tokens.mjs
 * Turbo task: "codegen" → runs before build
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CSS_SRC = resolve(ROOT, "src/css/variables.css");
const OUT = resolve(ROOT, "src/tokens/generated.ts");

const css = readFileSync(CSS_SRC, "utf8");

const SHADCN_HSL_KEYS = new Set([
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
]);

function toCamelCase(key) {
  return key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** Extract shadcn HSL components (--primary: 240 6% 10%;) */
function extractHsl(cssText) {
  const hsl = {};
  for (const line of cssText.split("\n")) {
    const match = line.match(/^\s*--([\w-]+)\s*:\s*([^;/]+)\s*;/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (!SHADCN_HSL_KEYS.has(name)) continue;
    hsl[toCamelCase(name)] = rawValue.trim();
  }
  return hsl;
}

/** Extract all --token: value; pairs from the :root block */
function extractTokens(cssText) {
  const tokens = {
    color: {
      bg: {},
      border: {},
      text: {},
      accent: {},
      mac: {},
      glass: {},
      vibrancy: {},
    },
    primitives: {},
    hsl: extractHsl(cssText),
    shadow: {},
    radius: {},
    wave: {},
    taskbar: {},
  };

  const lines = cssText.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (!match) continue;
    const [, name, rawValue] = match;
    const value = rawValue.trim();

    // Capture primitives
    if (name.startsWith("--arch") || name === "--white") {
      const key = name.replace("--", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.primitives[key] = value;
      continue;
    }

    // Categorise by name prefix
    if (name.startsWith("--bg-")) {
      const key = name.replace("--bg-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.color.bg[key] = `var(${name})`;
    } else if (name.startsWith("--border-")) {
      const key = name.replace("--border-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.color.border[key] = `var(${name})`;
    } else if (name.startsWith("--text-")) {
      const key = name.replace("--text-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.color.text[key] = `var(${name})`;
    } else if (name.startsWith("--accent-")) {
      const key = name.replace("--accent-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.color.accent[key] = `var(${name})`;
    } else if (name.startsWith("--mac-")) {
      const key = name.replace("--mac-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.color.mac[key] = `var(${name})`;
    } else if (name.startsWith("--glass-")) {
      const key = name.replace("--glass-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.color.glass[key] = `var(${name})`;
    } else if (name === "--vibrancy-surface" || name === "--vibrancy-border") {
      const key = name.replace("--vibrancy-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.color.vibrancy[key] = `var(${name})`;
    } else if (name.startsWith("--shadow-")) {
      const key = name.replace("--shadow-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.shadow[key] = `var(${name})`;
    } else if (name.startsWith("--radius-")) {
      const key = name.replace("--radius-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.radius[key] = `var(${name})`;
    } else if (name.startsWith("--taskbar-")) {
      const key = name.replace("--taskbar-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.taskbar[key] = `var(${name})`;
    } else if (name.startsWith("--wave-")) {
      const key = name.replace("--wave-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tokens.wave[key] = value; // wave tokens are numbers, keep raw value
    }
  }
  return tokens;
}

function renderObject(obj, indent = 2) {
  const pad = " ".repeat(indent);
  const innerPad = " ".repeat(indent + 2);
  const entries = Object.entries(obj);
  if (entries.length === 0) return "{}";
  const lines = entries.map(([k, v]) => {
    if (typeof v === "object") {
      return `${innerPad}${k}: ${renderObject(v, indent + 2)},`;
    }
    return `${innerPad}${k}: ${JSON.stringify(v)},`;
  });
  return `{\n${lines.join("\n")}\n${pad}}`;
}

const tokens = extractTokens(css);

const output = `/**
 * generated.ts — AUTO-GENERATED. DO NOT EDIT.
 *
 * Generated by: pkgs/theme/scripts/generate-tokens.mjs
 * Source:       pkgs/theme/src/css/variables.css
 *
 * Re-run with: node pkgs/theme/scripts/generate-tokens.mjs
 * Or via Turbo: pnpm --filter @repo/theme codegen
 *
 * This file provides typed \`var(--token)\` references for use in:
 * - Framer Motion style props
 * - Canvas/WebGL drawing
 * - Runtime style injection
 *
 * For static Tailwind usage, use the className utilities instead
 * (e.g. \`text-[var(--text-heading)]\` or \`shadow-card\`).
 */

export const tokens = ${renderObject(tokens, 0)} as const;

export type Tokens = typeof tokens;
export type ColorTokens = typeof tokens.color;
export type PrimitiveTokens = typeof tokens.primitives;
export type HslTokens = typeof tokens.hsl;
export type ShadowTokens = typeof tokens.shadow;
export type RadiusTokens = typeof tokens.radius;
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, output, "utf8");
console.log(`✅  Token map generated → ${OUT.replace(process.cwd(), ".")}`);
